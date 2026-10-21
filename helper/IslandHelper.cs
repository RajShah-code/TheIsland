// TheIsland helper.
//
// A tiny program for the things Electron can't see on its own:
// - Music: Windows' media session API (GlobalSystemMediaTransportControls, the same thing the volume
//   flyout uses). Works with Spotify, browsers and any player that reports to Windows. Event-driven.
// - Fullscreen: whether a fullscreen app (game, video) is in front on the primary display, so the
//   island can get out of the way. One cheap check per second; only changes are reported.
//
// Protocol (one line per message):
//   stdout -> JSON objects: {"type":"media", ...} whenever the track or play state changes,
//             {"type":"fullscreen","on":true|false} when fullscreen starts or ends.
//   stdin  <- commands: "toggle", "next", "prev", "refresh".
// The helper exits when stdin closes, so it never outlives the app.
//
// Built with the C# compiler that ships with Windows (.NET Framework 4), no SDK needed.
// See scripts/build-helper.mjs.

using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
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

        string line;
        while ((line = input.ReadLine()) != null)
        {
            var s = current;
            line = line.Trim();
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

    static void Write(string json)
    {
        lock (gate) { output.WriteLine(json); output.Flush(); }
    }
}
