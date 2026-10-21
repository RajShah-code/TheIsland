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
//   stdin  <- commands: "toggle", "next", "prev", "refresh",
//     "stats on", "stats off", "volume <0-100>", "mute on|off|toggle", "brightness <0-100>",
//     "wifi on|off", "bluetooth on|off", "lock", "sleep",
//     "system refresh" (re-sends audio, brightness and radios).
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
using Windows.Devices.Radios;
using Windows.Foundation;
using Windows.Media.Control;
using Windows.Storage.Streams;

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
        AttachAudio(true);
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
                }
                return true;
        }
        return false;
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
        [PreserveSig] int EnumAudioEndpoints(int dataFlow, int stateMask, out IntPtr devices);
        [PreserveSig] int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice device);
        [PreserveSig] int GetDevice([MarshalAs(UnmanagedType.LPWStr)] string id, out IMMDevice device);
        [PreserveSig] int RegisterEndpointNotificationCallback(IMMNotificationClient client);
        [PreserveSig] int UnregisterEndpointNotificationCallback(IMMNotificationClient client);
    }

    [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDevice
    {
        [PreserveSig] int Activate(ref Guid iid, int clsCtx, IntPtr activationParams, [MarshalAs(UnmanagedType.IUnknown)] out object iface);
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
        public int OnDeviceStateChanged(string id, int state) { return 0; }
        public int OnDeviceAdded(string id) { return 0; }
        public int OnDeviceRemoved(string id) { return 0; }
        public int OnDefaultDeviceChanged(int flow, int role, string id)
        {
            // Fires once per role; re-attaching from inside the callback isn't allowed, so do it shortly after.
            if (flow == 0) try { audioReattach.Change(200, Timeout.Infinite); } catch { }
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
            foreach (var r in Wait(Radio.GetRadiosAsync()))
            {
                if (r.Kind != RadioKind.WiFi && r.Kind != RadioKind.Bluetooth) continue;
                r.StateChanged += (x, e) => radioDebounce.Change(100, Timeout.Infinite);
                list.Add(r);
            }
            radios = list;
        }
        catch { }
        EmitRadios();
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

    static void Write(string json)
    {
        lock (gate) { output.WriteLine(json); output.Flush(); }
    }
}
