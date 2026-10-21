// TheIsland helper.
//
// A tiny program for the things Electron can't see on its own:
// - Music: Windows' media session API (GlobalSystemMediaTransportControls, the same thing the volume
//   flyout uses). Works with Spotify, browsers and any player that reports to Windows. Event-driven.
// - Fullscreen: whether a fullscreen app (game, video) is in front on the primary display, so the
//   island can get out of the way. One cheap check per second; only changes are reported.
//
// - System: live stats (GPU, disk, network, only while asked for), output volume and mute (Core Audio,
//   event-driven), laptop display brightness (WMI), Wi-Fi and Bluetooth radios (WinRT), lock and sleep.
//
// Protocol (one line per message):
//   stdout -> JSON objects:
//     {"type":"media", ...} whenever the track or play state changes,
//     {"type":"fullscreen","on":true|false} when fullscreen starts or ends,
//     {"type":"stats","gpu":12.3,"diskRead":123456,"diskWrite":789,"netDown":1000,"netUp":200}
//       once per second while stats are on (gpu in %, the rest in bytes/s, null when unreadable),
//     {"type":"audio","available":true,"volume":45,"muted":false} at startup and on any change,
//       or {"type":"audio","available":false},
//     {"type":"brightness","available":true,"value":70} at startup, after a set and on any change,
//       or {"type":"brightness","available":false},
//     {"type":"radios","wifi":true,"bluetooth":false} at startup and on any change (null = no such radio).
//     {"type":"quick","airplane":b,"hotspot":b,"micMuted":b,"micAvailable":true,"nightLight":b,
//       "energySaver":b,"colorFilters":b} (b = true|false|null, null = not available here) at startup,
//       on "system refresh", after any quick command and on a change. Mic mute is event-driven; the
//       rest is only re-read once per second while stats are on.
//     {"type":"outputs","devices":[{"id":"...","name":"Speakers","default":true}]} at startup, on
//       "outputs", "system refresh" and when the default or the set of output devices changes.
//     {"type":"hosts","closed":[pid,...]} answering "hosts": the Claude Code session pids whose Claude
//       desktop app has no visible window (closed to the tray).
//   stdin  <- commands: "toggle", "next", "prev", "refresh",
//     "stats on", "stats off", "volume <0-100>", "mute on|off|toggle", "brightness <0-100>",
//     "wifi on|off", "bluetooth on|off", "lock", "sleep",
//     "airplane on|off", "hotspot on|off", "micmute on|off|toggle", "nightlight on|off",
//     "energysaver on|off" (no public API to set it: only re-sends the state),
//     "colorfilters toggle|on|off" (Win+Ctrl+C, only when the shortcut is enabled in Settings),
//     "keys cast|project|captions|keyboard|screenshot|notifications|quick|emoji",
//     "outputs", "output <device id>", "hosts <pid> <pid> ...",
//     "system refresh" (re-sends audio, brightness, radios, quick and outputs).
// The helper exits when stdin closes, so it never outlives the app.
//
// Built with the C# compiler that ships with Windows (.NET Framework 4), no SDK needed.
// See scripts/build-helper.mjs.

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Management;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using Microsoft.Win32;
using Windows.Devices.Radios;
using Windows.Foundation;
using Windows.Media.Control;
using Windows.Networking.Connectivity;
using Windows.Networking.NetworkOperators;
using Windows.Storage.Streams;
using Windows.System.Power;

class IslandHelper
{
    static GlobalSystemMediaTransportControlsSessionManager manager;
    static GlobalSystemMediaTransportControlsSession current;
    static readonly object gate = new object();
    static Timer debounce;
    static StreamWriter output;
    static string lastArtKey = null;
    static string lastArt = null;
    static bool artChanged = false;

    static T Wait<T>(IAsyncOperation<T> op)
    {
        var done = new ManualResetEvent(false);
        op.Completed = (o, s) => done.Set();
        done.WaitOne();
        return op.GetResults();
    }

    static void Try(IAsyncOperation<bool> op)
    {
        try { Wait(op); } catch { }
    }

    static void Main()
    {
        output = new StreamWriter(Console.OpenStandardOutput(), new UTF8Encoding(false));
        var input = new StreamReader(Console.OpenStandardInput(), Encoding.UTF8);
        debounce = new Timer(_ => Emit(), null, Timeout.Infinite, Timeout.Infinite);
        fullscreenTimer = new Timer(_ => CheckFullscreen(), null, 0, 1000);

        try
        {
            manager = Wait(GlobalSystemMediaTransportControlsSessionManager.RequestAsync());
        }
        catch (Exception)
        {
            Write("{\"type\":\"error\",\"message\":\"media sessions unavailable\"}");
        }

        if (manager != null)
        {
            manager.CurrentSessionChanged += (s, e) => { Attach(); Schedule(); };
            Attach();
            Schedule();
        }

        // System features start in the background so a slow WMI or radio call never delays music.
        statsTimer = new Timer(_ => SampleStats(), null, Timeout.Infinite, Timeout.Infinite);
        radioDebounce = new Timer(_ => EmitRadios(), null, Timeout.Infinite, Timeout.Infinite);
        audioReattach = new Timer(_ => AttachAudio(true), null, Timeout.Infinite, Timeout.Infinite);
        micReattach = new Timer(_ => { AttachMic(); EmitQuick(false); }, null, Timeout.Infinite, Timeout.Infinite);
        outputsDebounce = new Timer(_ => EmitOutputs(), null, Timeout.Infinite, Timeout.Infinite);
        AttachAudio(true);
        AttachMic();
        EmitOutputs();
        var bt = new Thread(BrightnessWorker);
        bt.IsBackground = true;
        bt.Start();
        ThreadPool.QueueUserWorkItem(_ => InitRadios());

        string line;
        while ((line = input.ReadLine()) != null)
        {
            var s = current;
            line = line.Trim();
            try { if (SystemCommand(line)) continue; } catch { }
            if (line == "refresh") { Schedule(); lastFullscreen = null; continue; }
            if (s == null) continue;
            try
            {
                if (line == "toggle") Try(s.TryTogglePlayPauseAsync());
                else if (line == "next") Try(s.TrySkipNextAsync());
                else if (line == "prev") Try(s.TrySkipPreviousAsync());
            }
            catch { }
        }
        // WMI and COM can leave non-background threads behind; make sure we really go away.
        Environment.Exit(0);
    }

    static void Attach()
    {
        lock (gate)
        {
            var s = manager.GetCurrentSession();
            if (s == current) return;
            current = s;
            if (s == null) return;
            s.MediaPropertiesChanged += (x, e) => { if (x == current) Schedule(); };
            s.PlaybackInfoChanged += (x, e) => { if (x == current) Schedule(); };
        }
    }

    // Players often fire several change events in a row; send one update.
    static void Schedule()
    {
        debounce.Change(150, Timeout.Infinite);
    }

    static void Emit()
    {
        var s = current;
        if (s == null)
        {
            Write("{\"type\":\"media\",\"active\":false}");
            return;
        }
        try
        {
            var props = Wait(s.TryGetMediaPropertiesAsync());
            var info = s.GetPlaybackInfo();
            var controls = info.Controls;
            string artKey = s.SourceAppUserModelId + "|" + props.Title + "|" + props.Artist + "|" + props.AlbumTitle;
            if (artKey != lastArtKey)
            {
                lastArtKey = artKey;
                lastArt = ReadThumbnail(props.Thumbnail);
                artChanged = true;
            }
            var sb = new StringBuilder();
            sb.Append("{\"type\":\"media\",\"active\":true");
            Field(sb, "app", s.SourceAppUserModelId);
            Field(sb, "title", props.Title);
            Field(sb, "artist", props.Artist);
            Field(sb, "album", props.AlbumTitle);
            Field(sb, "status", info.PlaybackStatus.ToString());
            sb.Append(",\"canNext\":").Append(controls.IsNextEnabled ? "true" : "false");
            sb.Append(",\"canPrev\":").Append(controls.IsPreviousEnabled ? "true" : "false");
            // Art is large, so it is only sent when it changes; the app keeps the last one.
            if (artChanged) { Field(sb, "art", lastArt ?? ""); artChanged = false; }
            sb.Append("}");
            Write(sb.ToString());
        }
        catch (Exception)
        {
            // The player can vanish between the event and our read; the next event will fix it.
        }
    }

    static string ReadThumbnail(IRandomAccessStreamReference thumb)
    {
        if (thumb == null) return null;
        try
        {
            var stream = Wait(thumb.OpenReadAsync());
            ulong size = stream.Size;
            if (size == 0 || size > 2 * 1024 * 1024) return null;
            var reader = new DataReader(stream.GetInputStreamAt(0));
            Wait(reader.LoadAsync((uint)size));
            var bytes = new byte[size];
            reader.ReadBytes(bytes);
            string type = string.IsNullOrEmpty(stream.ContentType) ? "image/png" : stream.ContentType;
            return "data:" + type + ";base64," + Convert.ToBase64String(bytes);
        }
        catch { return null; }
    }

    static void Field(StringBuilder sb, string name, string value)
    {
        sb.Append(",\"").Append(name).Append("\":\"").Append(Escape(value ?? "")).Append("\"");
    }

    static string Escape(string v)
    {
        var sb = new StringBuilder(v.Length + 8);
        foreach (char c in v)
        {
            if (c == '"') sb.Append("\\\"");
            else if (c == '\\') sb.Append("\\\\");
            else if (c < 0x20) sb.Append("\\u").Append(((int)c).ToString("x4"));
            else sb.Append(c);
        }
        return sb.ToString();
    }

    // ---- Fullscreen ----

    static Timer fullscreenTimer;
    static bool? lastFullscreen = null;

    [StructLayout(LayoutKind.Sequential)]
    struct RECT { public int Left, Top, Right, Bottom; }

    [StructLayout(LayoutKind.Sequential)]
    struct MONITORINFO { public int cbSize; public RECT rcMonitor; public RECT rcWork; public uint dwFlags; }

    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
    [DllImport("user32.dll")] static extern bool IsZoomed(IntPtr hWnd);
    [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr hWnd, uint flags);
    [DllImport("user32.dll")] static extern bool GetMonitorInfo(IntPtr hMonitor, ref MONITORINFO info);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr hWnd, StringBuilder name, int max);
    [DllImport("shell32.dll")] static extern int SHQueryUserNotificationState(out int state);

    const int QUNS_RUNNING_D3D_FULL_SCREEN = 3;

    static bool IsFullscreen()
    {
        // Exclusive-mode games.
        int quns;
        if (SHQueryUserNotificationState(out quns) == 0 && quns == QUNS_RUNNING_D3D_FULL_SCREEN) return true;

        // Borderless fullscreen (most games, browser/YouTube fullscreen, video players):
        // the foreground window covers its whole monitor, and that monitor is the primary one.
        IntPtr hwnd = GetForegroundWindow();
        if (hwnd == IntPtr.Zero || IsZoomed(hwnd)) return false;
        var cls = new StringBuilder(64);
        GetClassName(hwnd, cls, cls.Capacity);
        string c = cls.ToString();
        if (c == "Progman" || c == "WorkerW" || c == "Shell_TrayWnd" || c == "Windows.UI.Core.CoreWindow") return false;
        RECT r;
        if (!GetWindowRect(hwnd, out r)) return false;
        var mi = new MONITORINFO();
        mi.cbSize = Marshal.SizeOf(typeof(MONITORINFO));
        if (!GetMonitorInfo(MonitorFromWindow(hwnd, 2), ref mi)) return false;
        if ((mi.dwFlags & 1) == 0) return false;
        var m = mi.rcMonitor;
        return r.Left <= m.Left && r.Top <= m.Top && r.Right >= m.Right && r.Bottom >= m.Bottom;
    }

    static void CheckFullscreen()
    {
        bool on;
        try { on = IsFullscreen(); } catch { on = false; }
        if (lastFullscreen == on) return;
        lastFullscreen = on;
        Write("{\"type\":\"fullscreen\",\"on\":" + (on ? "true" : "false") + "}");
    }

    // ---- System commands ----

    [DllImport("user32.dll")] static extern bool LockWorkStation();
    [DllImport("powrprof.dll")] static extern bool SetSuspendState(bool hibernate, bool force, bool disableWake);

    // Returns true when the line was one of ours (so the media handling below skips it).
    static bool SystemCommand(string line)
    {
        int sp = line.IndexOf(' ');
        string cmd = sp < 0 ? line : line.Substring(0, sp);
        string arg = sp < 0 ? "" : line.Substring(sp + 1).Trim();
        switch (cmd)
        {
            case "stats":
                if (arg == "on") StatsOn();
                else if (arg == "off") StatsOff();
                return true;
            case "volume":
                {
                    int v;
                    if (ParsePercent(arg, out v)) SetVolume(v);
                    return true;
                }
            case "mute":
                if (arg == "on") SetMute(1);
                else if (arg == "off") SetMute(0);
                else if (arg == "toggle") SetMute(-1);
                return true;
            case "brightness":
                {
                    int v;
                    if (ParsePercent(arg, out v)) { Interlocked.Exchange(ref brightPending, v); brightWake.Set(); }
                    return true;
                }
            case "wifi":
            case "bluetooth":
                if (arg == "on" || arg == "off")
                {
                    var kind = cmd == "wifi" ? RadioKind.WiFi : RadioKind.Bluetooth;
                    bool on = arg == "on";
                    ThreadPool.QueueUserWorkItem(_ => SetRadio(kind, on));
                }
                return true;
            case "lock":
                try { LockWorkStation(); } catch { }
                return true;
            case "sleep":
                // SetSuspendState only returns after the machine wakes up again, so keep it off the stdin loop.
                ThreadPool.QueueUserWorkItem(_ => { try { SetSuspendState(false, false, false); } catch { } });
                return true;
            case "system":
                if (arg == "refresh")
                {
                    EmitAudio(true);
                    Interlocked.Exchange(ref brightReadPending, 1);
                    brightWake.Set();
                    radioDebounce.Change(0, Timeout.Infinite);
                    QuickAfter(0);
                    outputsDebounce.Change(0, Timeout.Infinite);
                }
                return true;
            case "airplane":
                if (arg == "on" || arg == "off")
                {
                    bool on = arg == "on";
                    ThreadPool.QueueUserWorkItem(_ => SetAirplane(on));
                }
                return true;
            case "hotspot":
                if (arg == "on" || arg == "off")
                {
                    bool on = arg == "on";
                    ThreadPool.QueueUserWorkItem(_ => SetHotspot(on));
                }
                return true;
            case "micmute":
                if (arg == "on") SetMicMute(1);
                else if (arg == "off") SetMicMute(0);
                else if (arg == "toggle") SetMicMute(-1);
                else return true;
                QuickAfter(0);
                return true;
            case "nightlight":
                if (arg == "on" || arg == "off")
                {
                    bool on = arg == "on";
                    ThreadPool.QueueUserWorkItem(_ => { SetNightLight(on); QuickAfter(0); });
                }
                return true;
            case "energysaver":
                // Windows has no public API to switch energy saver; just re-send the real state.
                if (arg == "on" || arg == "off") QuickAfter(0);
                return true;
            case "colorfilters":
                if (arg == "toggle" || arg == "on" || arg == "off")
                {
                    if (ToggleColorFilters(arg)) QuickAfter(400);
                    else QuickAfter(0);
                }
                return true;
            case "keys":
                {
                    ushort[] combo;
                    if (Shortcuts.TryGetValue(arg, out combo)) SendCombo(combo);
                    QuickAfter(0);
                    return true;
                }
            case "outputs":
                outputsDebounce.Change(0, Timeout.Infinite);
                return true;
            case "output":
                if (arg.Length > 0)
                {
                    string id = arg;
                    ThreadPool.QueueUserWorkItem(_ => { SetDefaultOutput(id); outputsDebounce.Change(150, Timeout.Infinite); QuickAfter(0); });
                }
                return true;
            case "hosts":
                EmitClosedHosts(arg);
                return true;
        }
        return false;
    }

    // ---- Claude desktop windows ----
    // "hosts <pid> <pid> ...": Claude Code session processes. For each one started by the Claude desktop
    // app (its parent is Claude.exe), reports whether that app has no visible window left (closed to the
    // tray). Sessions started anywhere else (a terminal, an editor) are never reported.

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct PROCESSENTRY32
    {
        public uint dwSize, cntUsage, th32ProcessID;
        public IntPtr th32DefaultHeapID;
        public uint th32ModuleID, cntThreads, th32ParentProcessID;
        public int pcPriClassBase;
        public uint dwFlags;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string szExeFile;
    }
    delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("kernel32.dll", SetLastError = true)] static extern IntPtr CreateToolhelp32Snapshot(uint flags, uint pid);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern bool Process32FirstW(IntPtr snap, ref PROCESSENTRY32 e);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern bool Process32NextW(IntPtr snap, ref PROCESSENTRY32 e);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lParam);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
    [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr hWnd, uint cmd);

    static void EmitClosedHosts(string arg)
    {
        var wanted = new List<uint>();
        foreach (var part in arg.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries))
        {
            uint p;
            if (uint.TryParse(part, NumberStyles.None, CultureInfo.InvariantCulture, out p) && p > 0 && wanted.Count < 64) wanted.Add(p);
        }
        var closed = new List<uint>();
        try
        {
            // pid -> (parent pid, exe name), one snapshot for all of them.
            var procs = new Dictionary<uint, KeyValuePair<uint, string>>();
            IntPtr snap = CreateToolhelp32Snapshot(0x2, 0); // TH32CS_SNAPPROCESS
            if (snap != IntPtr.Zero && snap != new IntPtr(-1))
            {
                try
                {
                    var e = new PROCESSENTRY32 { dwSize = (uint)Marshal.SizeOf(typeof(PROCESSENTRY32)) };
                    for (bool ok = Process32FirstW(snap, ref e); ok; ok = Process32NextW(snap, ref e))
                        procs[e.th32ProcessID] = new KeyValuePair<uint, string>(e.th32ParentProcessID, e.szExeFile ?? "");
                }
                finally { CloseHandle(snap); }
            }
            var hosts = new Dictionary<uint, uint>(); // session pid -> desktop app pid
            foreach (var p in wanted)
            {
                KeyValuePair<uint, string> me, parent;
                if (!procs.TryGetValue(p, out me) || !procs.TryGetValue(me.Key, out parent)) continue;
                if (string.Equals(parent.Value, "Claude.exe", StringComparison.OrdinalIgnoreCase)) hosts[p] = me.Key;
            }
            if (hosts.Count > 0)
            {
                // Desktop app processes that own a visible top-level window (not owned by another window).
                var open = new HashSet<uint>();
                EnumWindows((h, l) =>
                {
                    uint wp;
                    if (IsWindowVisible(h) && GetWindow(h, 4) == IntPtr.Zero && GetWindowThreadProcessId(h, out wp) != 0) open.Add(wp);
                    return true;
                }, IntPtr.Zero);
                foreach (var kv in hosts) if (!open.Contains(kv.Value)) closed.Add(kv.Key);
            }
        }
        catch { }
        var sb = new StringBuilder("{\"type\":\"hosts\",\"closed\":[");
        for (int i = 0; i < closed.Count; i++) sb.Append(i > 0 ? "," : "").Append(closed[i].ToString(CultureInfo.InvariantCulture));
        Write(sb.Append("]}").ToString());
    }

    static bool ParsePercent(string s, out int v)
    {
        double d;
        v = 0;
        if (!double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out d) || double.IsNaN(d)) return false;
        v = (int)Math.Round(Math.Max(0, Math.Min(100, d)));
        return true;
    }

    static string Num(double? v, string format)
    {
        return v.HasValue ? v.Value.ToString(format, CultureInfo.InvariantCulture) : "null";
    }

    static string Bool(bool? v)
    {
        return v.HasValue ? (v.Value ? "true" : "false") : "null";
    }

    // ---- Stats ----
    //
    // Each tick reads every performance category once (one registry perf-data read each) and works
    // out the rates from the previous tick's raw samples. A PerformanceCounter per GPU engine
    // instance would re-read the whole category once per counter, which with a few hundred engine
    // instances costs far more. New instances (processes, adapters) are picked up for free, so the
    // instance list never needs a separate refresh.

    class RateSource
    {
        readonly string category;
        readonly string counter;
        readonly Func<string, bool> filter;
        Dictionary<string, CounterSample> prev;

        public RateSource(string category, string counter, Func<string, bool> filter)
        {
            this.category = category;
            this.counter = counter;
            this.filter = filter;
        }

        public void Reset() { prev = null; }

        public double? Next(Dictionary<string, InstanceDataCollectionCollection> tick)
        {
            try
            {
                var data = ReadCategory(tick, category);
                var col = data == null ? null : data[counter];
                if (col == null) { prev = null; return null; }
                var now = new Dictionary<string, CounterSample>();
                double sum = 0;
                bool any = false;
                foreach (InstanceData d in col.Values)
                {
                    if (!filter(d.InstanceName)) continue;
                    now[d.InstanceName] = d.Sample;
                    CounterSample old;
                    if (prev != null && prev.TryGetValue(d.InstanceName, out old))
                    {
                        float r = CounterSample.Calculate(old, d.Sample);
                        if (r > 0 && !float.IsNaN(r) && !float.IsInfinity(r)) sum += r;
                        any = true;
                    }
                }
                bool primed = prev != null;
                prev = now;
                if (!primed) return null;
                // No matching instance at all (no GPU engines right now) is a real 0, not "unknown".
                return any || now.Count == 0 ? (double?)sum : null;
            }
            catch { prev = null; return null; }
        }
    }

    static readonly object statsLock = new object();
    static volatile bool statsWanted = false;
    static Timer statsTimer;
    static RateSource gpu, diskRead, diskWrite, netDown, netUp;
    static readonly Dictionary<string, PerformanceCounterCategory> categories = new Dictionary<string, PerformanceCounterCategory>();
    static readonly Dictionary<string, DateTime> categoryRetry = new Dictionary<string, DateTime>();

    static InstanceDataCollectionCollection ReadCategory(Dictionary<string, InstanceDataCollectionCollection> tick, string name)
    {
        InstanceDataCollectionCollection data;
        if (tick.TryGetValue(name, out data)) return data;
        data = null;
        DateTime retry;
        if (!categoryRetry.TryGetValue(name, out retry) || DateTime.UtcNow >= retry)
        {
            try
            {
                PerformanceCounterCategory cat;
                if (!categories.TryGetValue(name, out cat)) categories[name] = cat = new PerformanceCounterCategory(name);
                data = cat.ReadCategory();
            }
            catch
            {
                // Missing category (or a broken perf registry): don't hammer it every second.
                categoryRetry[name] = DateTime.UtcNow.AddSeconds(10);
            }
        }
        tick[name] = data;
        return data;
    }

    static void StatsOn()
    {
        statsWanted = true;
        ThreadPool.QueueUserWorkItem(_ =>
        {
            lock (statsLock)
            {
                try
                {
                    // Created lazily on the first "stats on" and kept for the next time.
                    if (gpu == null)
                    {
                        gpu = new RateSource("GPU Engine", "Utilization Percentage", n => n.Contains("engtype_3D"));
                        diskRead = new RateSource("PhysicalDisk", "Disk Read Bytes/sec", n => n == "_Total");
                        diskWrite = new RateSource("PhysicalDisk", "Disk Write Bytes/sec", n => n == "_Total");
                        netDown = new RateSource("Network Interface", "Bytes Received/sec", n => true);
                        netUp = new RateSource("Network Interface", "Bytes Sent/sec", n => true);
                    }
                    // Fresh baseline so the first value isn't an average over the time stats were off.
                    gpu.Reset(); diskRead.Reset(); diskWrite.Reset(); netDown.Reset(); netUp.Reset();
                    ReadAll();
                }
                catch { }
                // "stats off" may have arrived while the first (slow) read ran.
                if (statsWanted) statsTimer.Change(1000, 1000);
            }
        });
    }

    static void StatsOff()
    {
        statsWanted = false;
        statsTimer.Change(Timeout.Infinite, Timeout.Infinite);
    }

    static double?[] ReadAll()
    {
        var tick = new Dictionary<string, InstanceDataCollectionCollection>();
        return new double?[] { gpu.Next(tick), diskRead.Next(tick), diskWrite.Next(tick), netDown.Next(tick), netUp.Next(tick) };
    }

    static void SampleStats()
    {
        // A slow read must not stack up behind the next tick.
        if (!statsWanted || !Monitor.TryEnter(statsLock)) return;
        try
        {
            if (gpu == null) return;
            var v = ReadAll();
            if (!statsWanted) return;
            double? g = v[0];
            if (g.HasValue) g = Math.Max(0, Math.Min(100, g.Value));
            var sb = new StringBuilder();
            sb.Append("{\"type\":\"stats\",\"gpu\":").Append(Num(g, "0.#"));
            sb.Append(",\"diskRead\":").Append(Num(v[1], "0"));
            sb.Append(",\"diskWrite\":").Append(Num(v[2], "0"));
            sb.Append(",\"netDown\":").Append(Num(v[3], "0"));
            sb.Append(",\"netUp\":").Append(Num(v[4], "0"));
            sb.Append("}");
            Write(sb.ToString());
            // Quick settings without events ride on the stats tick: nothing extra runs while stats are off.
            ReadQuickAll(true);
            EmitQuick(false);
        }
        catch { }
        finally { Monitor.Exit(statsLock); }
    }

    // ---- Audio (Core Audio COM) ----

    [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
    class MMDeviceEnumeratorCom { }

    [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDeviceEnumerator
    {
        [PreserveSig] int EnumAudioEndpoints(int dataFlow, int stateMask, out IMMDeviceCollection devices);
        [PreserveSig] int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice device);
        [PreserveSig] int GetDevice([MarshalAs(UnmanagedType.LPWStr)] string id, out IMMDevice device);
        [PreserveSig] int RegisterEndpointNotificationCallback(IMMNotificationClient client);
        [PreserveSig] int UnregisterEndpointNotificationCallback(IMMNotificationClient client);
    }

    [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDevice
    {
        [PreserveSig] int Activate(ref Guid iid, int clsCtx, IntPtr activationParams, [MarshalAs(UnmanagedType.IUnknown)] out object iface);
        [PreserveSig] int OpenPropertyStore(int access, out IPropertyStore store);
        [PreserveSig] int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
        [PreserveSig] int GetState(out int state);
    }

    [ComImport, Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDeviceCollection
    {
        [PreserveSig] int GetCount(out uint count);
        [PreserveSig] int Item(uint index, out IMMDevice device);
    }

    [ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IPropertyStore
    {
        [PreserveSig] int GetCount(out uint count);
        [PreserveSig] int GetAt(uint index, out PropertyKey key);
        [PreserveSig] int GetValue(ref PropertyKey key, out PropVariant value);
    }

    [StructLayout(LayoutKind.Sequential)]
    struct PropVariant { public ushort vt; public ushort r1, r2, r3; public IntPtr p; public IntPtr p2; }

    [DllImport("ole32.dll")] static extern int PropVariantClear(ref PropVariant pv);

    // Undocumented but stable since Windows 7; what the Sound control panel uses to pick the default.
    [ComImport, Guid("870AF99C-171D-4F9E-AF0D-E63DF40C2BC9")]
    class PolicyConfigClient { }

    [ComImport, Guid("F8679F50-850A-41CF-9C72-430F290290C8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IPolicyConfig
    {
        [PreserveSig] int GetMixFormat([MarshalAs(UnmanagedType.LPWStr)] string id, IntPtr format);
        [PreserveSig] int GetDeviceFormat([MarshalAs(UnmanagedType.LPWStr)] string id, int def, IntPtr format);
        [PreserveSig] int ResetDeviceFormat([MarshalAs(UnmanagedType.LPWStr)] string id);
        [PreserveSig] int SetDeviceFormat([MarshalAs(UnmanagedType.LPWStr)] string id, IntPtr endpointFormat, IntPtr mixFormat);
        [PreserveSig] int GetProcessingPeriod([MarshalAs(UnmanagedType.LPWStr)] string id, int def, IntPtr defaultPeriod, IntPtr minPeriod);
        [PreserveSig] int SetProcessingPeriod([MarshalAs(UnmanagedType.LPWStr)] string id, IntPtr period);
        [PreserveSig] int GetShareMode([MarshalAs(UnmanagedType.LPWStr)] string id, IntPtr mode);
        [PreserveSig] int SetShareMode([MarshalAs(UnmanagedType.LPWStr)] string id, IntPtr mode);
        [PreserveSig] int GetPropertyValue([MarshalAs(UnmanagedType.LPWStr)] string id, int fxStore, IntPtr key, IntPtr value);
        [PreserveSig] int SetPropertyValue([MarshalAs(UnmanagedType.LPWStr)] string id, int fxStore, IntPtr key, IntPtr value);
        [PreserveSig] int SetDefaultEndpoint([MarshalAs(UnmanagedType.LPWStr)] string id, int role);
        [PreserveSig] int SetEndpointVisibility([MarshalAs(UnmanagedType.LPWStr)] string id, int visible);
    }

    [ComImport, Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioEndpointVolume
    {
        [PreserveSig] int RegisterControlChangeNotify(IAudioEndpointVolumeCallback callback);
        [PreserveSig] int UnregisterControlChangeNotify(IAudioEndpointVolumeCallback callback);
        [PreserveSig] int GetChannelCount(out uint count);
        [PreserveSig] int SetMasterVolumeLevel(float db, ref Guid context);
        [PreserveSig] int SetMasterVolumeLevelScalar(float level, ref Guid context);
        [PreserveSig] int GetMasterVolumeLevel(out float db);
        [PreserveSig] int GetMasterVolumeLevelScalar(out float level);
        [PreserveSig] int SetChannelVolumeLevel(uint channel, float db, ref Guid context);
        [PreserveSig] int SetChannelVolumeLevelScalar(uint channel, float level, ref Guid context);
        [PreserveSig] int GetChannelVolumeLevel(uint channel, out float db);
        [PreserveSig] int GetChannelVolumeLevelScalar(uint channel, out float level);
        [PreserveSig] int SetMute([MarshalAs(UnmanagedType.Bool)] bool mute, ref Guid context);
        [PreserveSig] int GetMute([MarshalAs(UnmanagedType.Bool)] out bool mute);
    }

    [ComImport, Guid("657804FA-D6AD-4496-8A60-352752AF4F89"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioEndpointVolumeCallback
    {
        [PreserveSig] int OnNotify(IntPtr data);
    }

    [StructLayout(LayoutKind.Sequential)]
    struct PropertyKey { public Guid fmtid; public int pid; }

    [ComImport, Guid("7991EEC9-7E89-4D85-8390-6C703CEC60C0"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMNotificationClient
    {
        [PreserveSig] int OnDeviceStateChanged([MarshalAs(UnmanagedType.LPWStr)] string id, int state);
        [PreserveSig] int OnDeviceAdded([MarshalAs(UnmanagedType.LPWStr)] string id);
        [PreserveSig] int OnDeviceRemoved([MarshalAs(UnmanagedType.LPWStr)] string id);
        [PreserveSig] int OnDefaultDeviceChanged(int flow, int role, [MarshalAs(UnmanagedType.LPWStr)] string id);
        [PreserveSig] int OnPropertyValueChanged([MarshalAs(UnmanagedType.LPWStr)] string id, PropertyKey key);
    }

    class VolumeCallback : IAudioEndpointVolumeCallback
    {
        public int OnNotify(IntPtr data)
        {
            // AUDIO_VOLUME_NOTIFICATION_DATA: GUID context (16 bytes), BOOL muted, float master volume.
            try
            {
                bool muted = Marshal.ReadInt32(data, 16) != 0;
                float level = BitConverter.ToSingle(BitConverter.GetBytes(Marshal.ReadInt32(data, 20)), 0);
                EmitAudioValues(true, (int)Math.Round(level * 100), muted, false);
            }
            catch { }
            return 0;
        }
    }

    class DeviceCallback : IMMNotificationClient
    {
        // The output list changes when a device appears, goes away or is enabled/disabled.
        public int OnDeviceStateChanged(string id, int state) { try { outputsDebounce.Change(300, Timeout.Infinite); } catch { } return 0; }
        public int OnDeviceAdded(string id) { return 0; }
        public int OnDeviceRemoved(string id) { return 0; }
        public int OnDefaultDeviceChanged(int flow, int role, string id)
        {
            // Fires once per role; re-attaching from inside the callback isn't allowed, so do it shortly after.
            try
            {
                if (flow == 0) { audioReattach.Change(200, Timeout.Infinite); outputsDebounce.Change(250, Timeout.Infinite); }
                else if (flow == 1) micReattach.Change(200, Timeout.Infinite);
            }
            catch { }
            return 0;
        }
        public int OnPropertyValueChanged(string id, PropertyKey key) { return 0; }
    }

    static readonly object audioGate = new object();
    static IMMDeviceEnumerator audioEnum;
    static IAudioEndpointVolume endpoint;
    static readonly VolumeCallback volumeCallback = new VolumeCallback();
    static readonly DeviceCallback deviceCallback = new DeviceCallback();
    static Timer audioReattach;
    static string lastAudio = null;

    static void AttachAudio(bool emit)
    {
        lock (audioGate)
        {
            try
            {
                if (endpoint != null)
                {
                    try { endpoint.UnregisterControlChangeNotify(volumeCallback); } catch { }
                    try { Marshal.ReleaseComObject(endpoint); } catch { }
                    endpoint = null;
                }
                if (audioEnum == null)
                {
                    audioEnum = (IMMDeviceEnumerator)new MMDeviceEnumeratorCom();
                    audioEnum.RegisterEndpointNotificationCallback(deviceCallback);
                }
                IMMDevice device;
                // eRender, eMultimedia: the device the volume flyout controls.
                if (audioEnum.GetDefaultAudioEndpoint(0, 1, out device) == 0 && device != null)
                {
                    var iid = typeof(IAudioEndpointVolume).GUID;
                    object o;
                    if (device.Activate(ref iid, 23 /* CLSCTX_ALL */, IntPtr.Zero, out o) == 0)
                    {
                        endpoint = (IAudioEndpointVolume)o;
                        endpoint.RegisterControlChangeNotify(volumeCallback);
                    }
                    try { Marshal.ReleaseComObject(device); } catch { }
                }
            }
            catch { endpoint = null; }
        }
        if (emit) EmitAudio(true);
    }

    static void EmitAudio(bool force)
    {
        int vol = 0;
        bool muted = false;
        bool ok = false;
        lock (audioGate)
        {
            try
            {
                float level;
                if (endpoint != null && endpoint.GetMasterVolumeLevelScalar(out level) == 0 && endpoint.GetMute(out muted) == 0)
                {
                    vol = (int)Math.Round(level * 100);
                    ok = true;
                }
            }
            catch { ok = false; }
        }
        EmitAudioValues(ok, vol, muted, force);
    }

    static void EmitAudioValues(bool ok, int vol, bool muted, bool force)
    {
        string json = ok
            ? "{\"type\":\"audio\",\"available\":true,\"volume\":" + Math.Max(0, Math.Min(100, vol)).ToString(CultureInfo.InvariantCulture)
              + ",\"muted\":" + (muted ? "true" : "false") + "}"
            : "{\"type\":\"audio\",\"available\":false}";
        // The endpoint can report the same state several times (balance changes, our own set); send changes only.
        lock (audioGate)
        {
            if (!force && json == lastAudio) return;
            lastAudio = json;
        }
        Write(json);
    }

    static void SetVolume(int v)
    {
        lock (audioGate)
        {
            try
            {
                var ctx = Guid.Empty;
                if (endpoint != null) endpoint.SetMasterVolumeLevelScalar(v / 100f, ref ctx);
            }
            catch { }
        }
    }

    // mode: 1 = mute, 0 = unmute, -1 = toggle.
    static void SetMute(int mode)
    {
        lock (audioGate)
        {
            try
            {
                if (endpoint == null) return;
                bool now;
                if (endpoint.GetMute(out now) != 0) return;
                bool want = mode < 0 ? !now : mode == 1;
                var ctx = Guid.Empty;
                endpoint.SetMute(want, ref ctx);
            }
            catch { }
        }
    }

    // ---- Brightness (WMI) ----
    //
    // WMI calls can take a few hundred ms, so they all run on one worker thread. A slider sends many
    // values; only the latest pending one is applied.

    static readonly AutoResetEvent brightWake = new AutoResetEvent(false);
    static int brightPending = -1;
    static int brightReadPending = 0;
    static ManagementEventWatcher brightWatcher;

    static void BrightnessWorker()
    {
        bool available = ReadBrightness();
        if (available) StartBrightnessWatcher();
        while (true)
        {
            brightWake.WaitOne();
            int v = Interlocked.Exchange(ref brightPending, -1);
            bool read = Interlocked.Exchange(ref brightReadPending, 0) == 1;
            if (v >= 0)
            {
                SetBrightness(v);
                // Another value already arrived: apply that one first, report once things settle.
                if (Volatile.Read(ref brightPending) >= 0) { brightWake.Set(); continue; }
                read = true;
            }
            if (read)
            {
                bool was = available;
                available = ReadBrightness();
                if (available && !was) StartBrightnessWatcher();
            }
        }
    }

    static bool ReadBrightness()
    {
        try
        {
            using (var searcher = new ManagementObjectSearcher(@"root\WMI", "SELECT CurrentBrightness FROM WmiMonitorBrightness WHERE Active=TRUE"))
            using (var results = searcher.Get())
            {
                foreach (ManagementObject mo in results)
                {
                    int value = Convert.ToInt32(mo["CurrentBrightness"], CultureInfo.InvariantCulture);
                    mo.Dispose();
                    EmitBrightness(value, true);
                    return true;
                }
            }
        }
        catch { }
        Write("{\"type\":\"brightness\",\"available\":false}");
        return false;
    }

    static void SetBrightness(int v)
    {
        try
        {
            using (var searcher = new ManagementObjectSearcher(@"root\WMI", "SELECT * FROM WmiMonitorBrightnessMethods WHERE Active=TRUE"))
            using (var results = searcher.Get())
            {
                foreach (ManagementObject mo in results)
                {
                    try { mo.InvokeMethod("WmiSetBrightness", new object[] { (uint)1, (byte)v }); } catch { }
                    mo.Dispose();
                }
            }
        }
        catch { }
    }

    static void StartBrightnessWatcher()
    {
        if (brightWatcher != null) return;
        try
        {
            // Fires when brightness changes from anywhere (keys, Settings, power plan, us).
            var w = new ManagementEventWatcher(new ManagementScope(@"root\WMI"), new EventQuery("SELECT * FROM WmiMonitorBrightnessEvent"));
            w.EventArrived += (s, e) =>
            {
                try { EmitBrightness(Convert.ToInt32(e.NewEvent["Brightness"], CultureInfo.InvariantCulture), false); } catch { }
            };
            w.Start();
            brightWatcher = w;
        }
        catch { }
    }

    static int lastBrightness = -1;

    // Reads (startup, after a set, refresh) always report so the UI can resync; WMI events only on a
    // change, since a set also fires an event with the value we just reported.
    static void EmitBrightness(int value, bool force)
    {
        value = Math.Max(0, Math.Min(100, value));
        if (!force && Interlocked.Exchange(ref lastBrightness, value) == value) return;
        lastBrightness = value;
        Write("{\"type\":\"brightness\",\"available\":true,\"value\":" + value.ToString(CultureInfo.InvariantCulture) + "}");
    }

    // ---- Radios (WinRT) ----

    static List<Radio> radios = null;
    static Timer radioDebounce;

    static void InitRadios()
    {
        try
        {
            // Desktop apps are normally allowed; ask anyway so SetStateAsync doesn't get refused later.
            try { Wait(Radio.RequestAccessAsync()); } catch { }
            var list = new List<Radio>();
            var all = new List<Radio>();
            foreach (var r in Wait(Radio.GetRadiosAsync()))
            {
                r.StateChanged += (x, e) => radioDebounce.Change(100, Timeout.Infinite);
                all.Add(r);
                if (r.Kind == RadioKind.WiFi || r.Kind == RadioKind.Bluetooth) list.Add(r);
            }
            radios = list;
            allRadios = all;
        }
        catch { }
        EmitRadios();
        // Airplane falls back to the radio list, so the first quick report waits for it.
        QuickAfter(0);
    }

    static bool? RadioOn(RadioKind kind)
    {
        var list = radios;
        if (list == null) return null;
        bool? on = null;
        foreach (var r in list)
        {
            if (r.Kind != kind) continue;
            try { on = (on ?? false) || r.State == RadioState.On; } catch { }
        }
        return on;
    }

    static void EmitRadios()
    {
        try
        {
            Write("{\"type\":\"radios\",\"wifi\":" + Bool(RadioOn(RadioKind.WiFi)) + ",\"bluetooth\":" + Bool(RadioOn(RadioKind.Bluetooth)) + "}");
        }
        catch { }
        // A radio change is also the moment airplane mode may have flipped; cheap to re-check here.
        try
        {
            bool? a = ReadAirplane();
            lock (quickLock) { qAirplane = a; }
            if (quickReady) EmitQuick(false);
        }
        catch { }
    }

    static void SetRadio(RadioKind kind, bool on)
    {
        var list = radios;
        if (list == null) return;
        foreach (var r in list)
        {
            if (r.Kind != kind) continue;
            try { Wait(r.SetStateAsync(on ? RadioState.On : RadioState.Off)); } catch { }
        }
        // If the switch was refused (airplane mode, policy) there is no StateChanged, so report anyway.
        radioDebounce.Change(100, Timeout.Infinite);
    }

    // ---- Quick settings ----
    //
    // The controls of the taskbar's Quick Settings panel. Mic mute is event-driven (Core Audio); the rest
    // has no cheap change event, so it is re-read on the stats tick (only while stats are on), at startup,
    // on "system refresh" and after our own commands. Only differences are sent, except for those
    // explicit moments, which always send so the UI can resync.

    static readonly object quickLock = new object();
    static bool? qAirplane, qHotspot, qMic, qNight, qEnergy, qColor;
    static volatile bool quickReady = false;
    static string lastQuick = null;

    // tick = the per-second stats re-read, which may reuse slow lookups (see GetTether).
    static void ReadQuickAll(bool tick = false)
    {
        bool? a = null, h = null, m = null, n = null, e = null, c = null;
        try { a = ReadAirplane(); } catch { }
        try { h = ReadHotspot(!tick); } catch { }
        try { m = ReadMicMute(); } catch { }
        try { n = ReadNightLight(); } catch { }
        try { e = ReadEnergySaver(); } catch { }
        try { c = ReadColorFilters(); } catch { }
        lock (quickLock)
        {
            qAirplane = a; qHotspot = h; qMic = m; qNight = n; qEnergy = e; qColor = c;
        }
        quickReady = true;
    }

    static void EmitQuick(bool force)
    {
        if (!quickReady) return;
        string json;
        lock (quickLock)
        {
            json = "{\"type\":\"quick\",\"airplane\":" + Bool(qAirplane) + ",\"hotspot\":" + Bool(qHotspot)
                + ",\"micMuted\":" + Bool(qMic) + ",\"micAvailable\":" + (qMic.HasValue ? "true" : "false")
                + ",\"nightLight\":" + Bool(qNight) + ",\"energySaver\":" + Bool(qEnergy)
                + ",\"colorFilters\":" + Bool(qColor) + "}";
            if (!force && json == lastQuick) return;
            lastQuick = json;
        }
        Write(json);
    }

    // Full re-read and a forced report, off the stdin loop (hotspot and registry reads can take a moment).
    static void QuickAfter(int delayMs)
    {
        ThreadPool.QueueUserWorkItem(_ =>
        {
            try
            {
                if (delayMs > 0) Thread.Sleep(delayMs);
                ReadQuickAll();
                EmitQuick(true);
            }
            catch { }
        });
    }

    // -- Airplane mode --
    // Windows' own airplane switch is not reachable from a desktop app. Reading uses the radio
    // manager's system state when it is there; "on" turns every radio off and "off" restores them.

    static List<Radio> allRadios = null;
    static Dictionary<Radio, RadioState> radiosBeforeAirplane = null;

    static bool? ReadAirplane()
    {
        try
        {
            using (var k = Registry.LocalMachine.OpenSubKey(@"SYSTEM\CurrentControlSet\Control\RadioManagement\SystemRadioState"))
            {
                if (k != null)
                {
                    object v = k.GetValue("");
                    if (v is int) return (int)v == 1;
                }
            }
        }
        catch { }
        var list = allRadios;
        if (list == null || list.Count == 0) return null;
        foreach (var r in list)
        {
            try { if (r.State == RadioState.On) return false; } catch { }
        }
        return true;
    }

    static void SetAirplane(bool on)
    {
        var list = allRadios;
        if (list != null)
        {
            if (on)
            {
                var saved = new Dictionary<Radio, RadioState>();
                foreach (var r in list)
                {
                    try { saved[r] = r.State; } catch { }
                }
                radiosBeforeAirplane = saved;
                foreach (var r in list)
                {
                    try { Wait(r.SetStateAsync(RadioState.Off)); } catch { }
                }
            }
            else
            {
                // Restore what we switched off; without a record of that, turn everything back on.
                var saved = radiosBeforeAirplane;
                radiosBeforeAirplane = null;
                foreach (var r in list)
                {
                    RadioState was;
                    bool want = saved == null || !saved.TryGetValue(r, out was) || was == RadioState.On;
                    if (!want) continue;
                    try { Wait(r.SetStateAsync(RadioState.On)); } catch { }
                }
            }
        }
        radioDebounce.Change(100, Timeout.Infinite);
        QuickAfter(300);
    }

    // -- Mobile hotspot --

    static NetworkOperatorTetheringManager tether = null;
    static string tetherProfile = null;
    static DateTime tetherChecked = DateTime.MinValue;
    static readonly object tetherLock = new object();

    // Looking up the internet profile costs several ms, so on the per-second tick it is only redone
    // every 10 s (or after an error); forced reads (startup, refresh, commands) always redo it.
    static NetworkOperatorTetheringManager GetTether(bool fresh)
    {
        lock (tetherLock)
        {
            try
            {
                if (!fresh && tether != null && DateTime.UtcNow - tetherChecked < TimeSpan.FromSeconds(10)) return tether;
                tetherChecked = DateTime.UtcNow;
                var p = NetworkInformation.GetInternetConnectionProfile();
                if (p == null) { tether = null; tetherProfile = null; return null; }
                string name = p.ProfileName ?? "";
                if (tether == null || name != tetherProfile)
                {
                    tether = null;
                    tetherProfile = name;
                    tether = NetworkOperatorTetheringManager.CreateFromConnectionProfile(p);
                }
                return tether;
            }
            catch { tether = null; tetherProfile = null; return null; }
        }
    }

    static bool? ReadHotspot(bool fresh)
    {
        var t = GetTether(fresh);
        if (t == null) return null;
        try
        {
            var s = t.TetheringOperationalState;
            if (s == TetheringOperationalState.On) return true;
            if (s == TetheringOperationalState.Off) return false;
            if (s == TetheringOperationalState.InTransition) { lock (quickLock) { return qHotspot ?? false; } }
            return null;
        }
        catch { lock (tetherLock) { tether = null; } return null; }
    }

    static void SetHotspot(bool on)
    {
        var t = GetTether(true);
        if (t != null)
        {
            try
            {
                if (on) Wait(t.StartTetheringAsync());
                else Wait(t.StopTetheringAsync());
            }
            catch { }
        }
        QuickAfter(0);
    }

    // -- Microphone mute (default capture endpoint, eConsole: the "Default Device" for recording) --

    static IAudioEndpointVolume micEndpoint;
    static readonly MicCallback micCallback = new MicCallback();
    static Timer micReattach;

    class MicCallback : IAudioEndpointVolumeCallback
    {
        public int OnNotify(IntPtr data)
        {
            try
            {
                bool muted = Marshal.ReadInt32(data, 16) != 0;
                lock (quickLock) { qMic = muted; }
                EmitQuick(false);
            }
            catch { }
            return 0;
        }
    }

    static void AttachMic()
    {
        lock (audioGate)
        {
            try
            {
                if (micEndpoint != null)
                {
                    try { micEndpoint.UnregisterControlChangeNotify(micCallback); } catch { }
                    try { Marshal.ReleaseComObject(micEndpoint); } catch { }
                    micEndpoint = null;
                }
                if (audioEnum == null) return;
                IMMDevice device;
                if (audioEnum.GetDefaultAudioEndpoint(1 /* eCapture */, 0 /* eConsole */, out device) == 0 && device != null)
                {
                    var iid = typeof(IAudioEndpointVolume).GUID;
                    object o;
                    if (device.Activate(ref iid, 23, IntPtr.Zero, out o) == 0)
                    {
                        micEndpoint = (IAudioEndpointVolume)o;
                        micEndpoint.RegisterControlChangeNotify(micCallback);
                    }
                    try { Marshal.ReleaseComObject(device); } catch { }
                }
            }
            catch { micEndpoint = null; }
        }
        try
        {
            bool? m = ReadMicMute();
            lock (quickLock) { qMic = m; }
        }
        catch { }
    }

    static bool? ReadMicMute()
    {
        lock (audioGate)
        {
            try
            {
                bool m;
                if (micEndpoint != null && micEndpoint.GetMute(out m) == 0) return m;
            }
            catch { }
        }
        return null;
    }

    // mode: 1 = mute, 0 = unmute, -1 = toggle.
    static void SetMicMute(int mode)
    {
        lock (audioGate)
        {
            try
            {
                if (micEndpoint == null) return;
                bool now;
                if (micEndpoint.GetMute(out now) != 0) return;
                bool want = mode < 0 ? !now : mode == 1;
                if (want == now) return;
                var ctx = Guid.Empty;
                micEndpoint.SetMute(want, ref ctx);
            }
            catch { }
        }
    }

    // -- Night light --
    //
    // Undocumented: a CloudStore value holding a Bond CompactBinary v1 struct (layout as reverse-engineered
    // by github.com/kvnxiao/win-nightlight-cli, docs/nightlight-registry-format.md, checked on 26100/26300):
    //   43 42 01 00 | 0A 02 01 00 | 2A 06 <varint unix seconds> 2A 2B 0E <varint n> <n inner bytes> 00 00 00
    // The inner struct is 43 42 01 00, then fields in ascending id order, then 00:
    //   field 0  (10 00)                 present = night light is on now
    //   field 10 (D0 0A <zigzag varint>)  1 = last change was manual
    //   field 20 (C6 14 <varint>)         FILETIME of the last on/off change
    // Windows (Settings, Quick Settings) toggles it by writing only this value with field 0 set or cleared,
    // field 10 = 1, field 20 = now and the envelope stamped max(now, previous + 2). We do exactly that,
    // keep any other field, and refuse to write anything we can't fully parse.

    const string NightKey = @"Software\Microsoft\Windows\CurrentVersion\CloudStore\Store\DefaultAccount\Current\default$windows.data.bluelightreduction.bluelightreductionstate\windows.data.bluelightreduction.bluelightreductionstate";
    static readonly byte[] NightPrefix = { 0x43, 0x42, 0x01, 0x00, 0x0A, 0x02, 0x01, 0x00, 0x2A, 0x06 };
    static readonly object nightLock = new object();

    class NightField { public int id; public byte[] bytes; }

    static bool ReadVarint(byte[] b, ref int pos, int end, out ulong v)
    {
        v = 0;
        for (int shift = 0; shift < 64 && pos < end; shift += 7)
        {
            byte x = b[pos++];
            v |= (ulong)(x & 0x7F) << shift;
            if ((x & 0x80) == 0) return true;
        }
        return false;
    }

    static void WriteVarint(List<byte> o, ulong v)
    {
        while (v >= 0x80) { o.Add((byte)(v | 0x80)); v >>= 7; }
        o.Add((byte)v);
    }

    // Splits the value into the envelope timestamp and the inner fields; false if it isn't the known shape.
    static bool ParseNight(byte[] d, out ulong stamp, out List<NightField> fields)
    {
        stamp = 0;
        fields = null;
        if (d == null || d.Length < NightPrefix.Length + 12) return false;
        for (int i = 0; i < NightPrefix.Length; i++) if (d[i] != NightPrefix[i]) return false;
        int pos = NightPrefix.Length;
        if (!ReadVarint(d, ref pos, d.Length, out stamp)) return false;
        if (pos + 3 > d.Length || d[pos] != 0x2A || d[pos + 1] != 0x2B || d[pos + 2] != 0x0E) return false;
        pos += 3;
        ulong n;
        if (!ReadVarint(d, ref pos, d.Length, out n)) return false;
        int start = pos;
        if (n < 5 || (ulong)(d.Length - start) != n + 3) return false;
        int end = start + (int)n;
        if (d[end] != 0 || d[end + 1] != 0 || d[end + 2] != 0) return false;
        if (d[start] != 0x43 || d[start + 1] != 0x42 || d[start + 2] != 0x01 || d[start + 3] != 0x00) return false;
        if (d[end - 1] != 0) return false;
        var list = new List<NightField>();
        pos = start + 4;
        while (true)
        {
            if (pos >= end) return false;
            int fieldStart = pos;
            byte h = d[pos++];
            if (h == 0) break;
            int type = h & 0x1F;
            int idBits = h >> 5;
            int id;
            if (idBits == 6) { if (pos >= end) return false; id = d[pos++]; }
            else if (idBits == 7) { if (pos + 1 >= end) return false; id = d[pos] | (d[pos + 1] << 8); pos += 2; }
            else id = idBits;
            switch (type)
            {
                case 2: case 3: case 14: // bool, uint8, int8: one byte
                    if (pos >= end) return false;
                    pos++;
                    break;
                case 4: case 5: case 6: case 15: case 16: case 17: // (u)int16/32/64: varint
                    {
                        ulong ignore;
                        if (!ReadVarint(d, ref pos, end, out ignore)) return false;
                        break;
                    }
                default:
                    return false; // a type we don't know how to skip: don't guess
            }
            var f = new NightField();
            f.id = id;
            f.bytes = new byte[pos - fieldStart];
            Array.Copy(d, fieldStart, f.bytes, 0, f.bytes.Length);
            list.Add(f);
        }
        if (pos != end) return false;
        fields = list;
        return true;
    }

    static byte[] ReadNightRaw()
    {
        using (var k = Registry.CurrentUser.OpenSubKey(NightKey))
        {
            return k == null ? null : k.GetValue("Data") as byte[];
        }
    }

    static bool? ReadNightLight()
    {
        try
        {
            ulong stamp;
            List<NightField> fields;
            if (!ParseNight(ReadNightRaw(), out stamp, out fields)) return null;
            foreach (var f in fields) if (f.id == 0) return true;
            return false;
        }
        catch { return null; }
    }

    static void SetNightLight(bool on)
    {
        lock (nightLock)
        {
            try
            {
                var data = BuildNight(ReadNightRaw(), on, DateTime.UtcNow);
                if (data == null) return;
                using (var k = Registry.CurrentUser.OpenSubKey(NightKey, true))
                {
                    if (k != null) k.SetValue("Data", data, RegistryValueKind.Binary);
                }
            }
            catch { }
        }
    }

    // The new value for the wanted state, or null when there is nothing to do or the old value isn't understood.
    static byte[] BuildNight(byte[] old, bool on, DateTime utcNow)
    {
        try
        {
            ulong stamp;
            List<NightField> fields;
            if (!ParseNight(old, out stamp, out fields)) return null;
            bool now = false;
            foreach (var f in fields) if (f.id == 0) now = true;
            if (now == on) return null;

            var keep = new List<NightField>();
            foreach (var f in fields) if (f.id != 0 && f.id != 10 && f.id != 20) keep.Add(f);
            if (on) keep.Add(new NightField { id = 0, bytes = new byte[] { 0x10, 0x00 } });
            keep.Add(new NightField { id = 10, bytes = new byte[] { 0xD0, 0x0A, 0x02 } });
            var t = new List<byte> { 0xC6, 0x14 };
            WriteVarint(t, (ulong)utcNow.ToFileTimeUtc());
            keep.Add(new NightField { id = 20, bytes = t.ToArray() });
            keep.Sort((a, b) => a.id.CompareTo(b.id));

            var inner = new List<byte> { 0x43, 0x42, 0x01, 0x00 };
            foreach (var f in keep) inner.AddRange(f.bytes);
            inner.Add(0x00);

            ulong unixNow = (ulong)Math.Max(0, (utcNow - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalSeconds);
            ulong newStamp = Math.Max(unixNow, stamp + 2);
            var o = new List<byte>(NightPrefix);
            WriteVarint(o, newStamp);
            o.Add(0x2A); o.Add(0x2B); o.Add(0x0E);
            WriteVarint(o, (ulong)inner.Count);
            o.AddRange(inner);
            o.Add(0x00); o.Add(0x00); o.Add(0x00);
            var data = o.ToArray();

            // Self-check before touching the registry: our own output must parse back to the wanted state.
            ulong s2;
            List<NightField> f2;
            if (!ParseNight(data, out s2, out f2)) return null;
            bool back = false;
            foreach (var f in f2) if (f.id == 0) back = true;
            return back == on ? data : null;
        }
        catch { return null; }
    }

    // -- Energy saver (read only: Windows has no public API to switch it) --

    static bool? ReadEnergySaver()
    {
        try
        {
            var s = PowerManager.EnergySaverStatus;
            if (s == EnergySaverStatus.On) return true;
            if (s == EnergySaverStatus.Off) return false;
        }
        catch { }
        return null;
    }

    // -- Color filters --
    // State: HKCU\Software\Microsoft\ColorFiltering "Active". The only way to switch it from outside
    // without restarting anything is its own shortcut (Win+Ctrl+C), which works only when the user
    // enabled it in Settings > Accessibility > Color filters ("HotkeyEnabled" = 1).

    static int? ReadColorFilterValue(string name)
    {
        using (var k = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\ColorFiltering"))
        {
            if (k == null) return null;
            object v = k.GetValue(name);
            if (v is int) return (int)v;
            return null;
        }
    }

    static bool? ReadColorFilters()
    {
        try
        {
            // Missing key or value: the feature was never used, which means off.
            int? v = ReadColorFilterValue("Active");
            return v.HasValue && v.Value != 0;
        }
        catch { return null; }
    }

    // Returns true when the shortcut was sent.
    static bool ToggleColorFilters(string arg)
    {
        try
        {
            int? hk = ReadColorFilterValue("HotkeyEnabled");
            if (!hk.HasValue || hk.Value != 1) return false;
            if (arg != "toggle")
            {
                bool? now = ReadColorFilters();
                if (now.HasValue && now.Value == (arg == "on")) return false;
            }
            SendCombo(new ushort[] { VK_LWIN, VK_LCONTROL, 0x43 /* C */ });
            return true;
        }
        catch { return false; }
    }

    // -- Shortcuts (SendInput) --

    const ushort VK_LWIN = 0x5B, VK_LCONTROL = 0xA2, VK_LSHIFT = 0xA0;

    static readonly Dictionary<string, ushort[]> Shortcuts = new Dictionary<string, ushort[]>
    {
        { "cast", new ushort[] { VK_LWIN, 0x4B } },                       // Win+K
        { "project", new ushort[] { VK_LWIN, 0x50 } },                    // Win+P
        { "captions", new ushort[] { VK_LWIN, VK_LCONTROL, 0x4C } },      // Win+Ctrl+L
        { "keyboard", new ushort[] { VK_LWIN, 0x20 } },                   // Win+Space
        { "screenshot", new ushort[] { VK_LWIN, VK_LSHIFT, 0x53 } },      // Win+Shift+S
        { "notifications", new ushort[] { VK_LWIN, 0x4E } },              // Win+N
        { "quick", new ushort[] { VK_LWIN, 0x41 } },                      // Win+A
        { "emoji", new ushort[] { VK_LWIN, 0xBE } },                      // Win+Period
    };

    [StructLayout(LayoutKind.Sequential)]
    struct MOUSEINPUT { public int dx, dy; public uint mouseData, dwFlags, time; public IntPtr dwExtraInfo; }

    [StructLayout(LayoutKind.Sequential)]
    struct KEYBDINPUT { public ushort wVk, wScan; public uint dwFlags, time; public IntPtr dwExtraInfo; }

    [StructLayout(LayoutKind.Explicit)]
    struct InputUnion { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }

    [StructLayout(LayoutKind.Sequential)]
    struct INPUT { public uint type; public InputUnion u; }

    [DllImport("user32.dll", SetLastError = true)] static extern uint SendInput(uint count, INPUT[] inputs, int size);

    // Presses the keys in order and releases them in reverse, as one atomic SendInput batch.
    static void SendCombo(ushort[] vks)
    {
        try
        {
            var list = new INPUT[vks.Length * 2];
            for (int i = 0; i < vks.Length; i++)
            {
                list[i] = KeyInput(vks[i], false);
                list[vks.Length * 2 - 1 - i] = KeyInput(vks[i], true);
            }
            SendInput((uint)list.Length, list, Marshal.SizeOf(typeof(INPUT)));
        }
        catch { }
    }

    static INPUT KeyInput(ushort vk, bool up)
    {
        var inp = new INPUT();
        inp.type = 1; // INPUT_KEYBOARD
        inp.u.ki.wVk = vk;
        uint flags = up ? 2u : 0u; // KEYEVENTF_KEYUP
        if (vk == VK_LWIN) flags |= 1; // KEYEVENTF_EXTENDEDKEY
        inp.u.ki.dwFlags = flags;
        return inp;
    }

    // -- Output devices --

    static Timer outputsDebounce;
    static readonly PropertyKey PKEY_Device_FriendlyName = new PropertyKey { fmtid = new Guid("A45C254E-DF1C-4EFD-8020-67D146A850E0"), pid = 14 };

    class OutputDevice { public string id; public string name; }

    static List<OutputDevice> ListOutputs(out string defaultId)
    {
        var result = new List<OutputDevice>();
        defaultId = null;
        lock (audioGate)
        {
            if (audioEnum == null) return result;
            try
            {
                IMMDevice def;
                // eRender, eMultimedia: the same device the volume control follows.
                if (audioEnum.GetDefaultAudioEndpoint(0, 1, out def) == 0 && def != null)
                {
                    try { string id; if (def.GetId(out id) == 0) defaultId = id; } catch { }
                    try { Marshal.ReleaseComObject(def); } catch { }
                }
            }
            catch { }
            IMMDeviceCollection col = null;
            try
            {
                if (audioEnum.EnumAudioEndpoints(0 /* eRender */, 1 /* DEVICE_STATE_ACTIVE */, out col) != 0 || col == null) return result;
                uint count;
                if (col.GetCount(out count) != 0) return result;
                for (uint i = 0; i < count && i < 64; i++)
                {
                    IMMDevice dev = null;
                    try
                    {
                        if (col.Item(i, out dev) != 0 || dev == null) continue;
                        string id;
                        if (dev.GetId(out id) != 0 || string.IsNullOrEmpty(id)) continue;
                        var od = new OutputDevice();
                        od.id = id;
                        od.name = FriendlyName(dev) ?? id;
                        result.Add(od);
                    }
                    catch { }
                    finally { if (dev != null) try { Marshal.ReleaseComObject(dev); } catch { } }
                }
            }
            catch { }
            finally { if (col != null) try { Marshal.ReleaseComObject(col); } catch { } }
        }
        return result;
    }

    static string FriendlyName(IMMDevice dev)
    {
        IPropertyStore store = null;
        try
        {
            if (dev.OpenPropertyStore(0 /* STGM_READ */, out store) != 0 || store == null) return null;
            var key = PKEY_Device_FriendlyName;
            PropVariant pv;
            if (store.GetValue(ref key, out pv) != 0) return null;
            try
            {
                return pv.vt == 31 /* VT_LPWSTR */ && pv.p != IntPtr.Zero ? Marshal.PtrToStringUni(pv.p) : null;
            }
            finally { try { PropVariantClear(ref pv); } catch { } }
        }
        catch { return null; }
        finally { if (store != null) try { Marshal.ReleaseComObject(store); } catch { } }
    }

    static void EmitOutputs()
    {
        try
        {
            string def;
            var list = ListOutputs(out def);
            var sb = new StringBuilder();
            sb.Append("{\"type\":\"outputs\",\"devices\":[");
            for (int i = 0; i < list.Count; i++)
            {
                if (i > 0) sb.Append(',');
                sb.Append("{\"id\":\"").Append(Escape(list[i].id)).Append("\",\"name\":\"").Append(Escape(list[i].name))
                  .Append("\",\"default\":").Append(list[i].id == def ? "true" : "false").Append('}');
            }
            sb.Append("]}");
            Write(sb.ToString());
        }
        catch { }
    }

    static void SetDefaultOutput(string id)
    {
        try
        {
            string def;
            bool known = false;
            foreach (var d in ListOutputs(out def)) if (d.id == id) known = true;
            if (!known) return;
            object o = null;
            try
            {
                o = new PolicyConfigClient();
                var pc = (IPolicyConfig)o;
                pc.SetDefaultEndpoint(id, 0); // eConsole
                pc.SetDefaultEndpoint(id, 1); // eMultimedia
                pc.SetDefaultEndpoint(id, 2); // eCommunications
            }
            finally { if (o != null) try { Marshal.ReleaseComObject(o); } catch { } }
        }
        catch { }
    }

    static void Write(string json)
    {
        lock (gate) { output.WriteLine(json); output.Flush(); }
    }
}
