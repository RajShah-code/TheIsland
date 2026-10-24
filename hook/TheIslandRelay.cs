// TheIsland hook relay.
//
// Claude Code runs this for each hook event (registered in ~/.claude/settings.json by the
// installer). It reads the event JSON from stdin and forwards a trimmed copy to the TheIsland app
// over 127.0.0.1, authenticated with the token in %USERPROFILE%\.theisland\relay.json.
//
// Built by scripts/build-helper.mjs with the csc.exe that ships with Windows (C# 5, .NET Framework 4),
// so the hooks need neither Node.js nor a .NET SDK. A GUI-subsystem exe, so no console window flashes.
//
// Rules:
// - If the app is not running (no relay.json, connection refused, any error) it exits 0 with no
//   output, so Claude Code behaves exactly as if this hook did not exist.
// - For PermissionRequest it waits for the user's Allow/Deny in the island. If the island answers
//   "no decision" (timeout, approvals off, user picked "Terminal"), it prints nothing and Claude
//   Code shows its normal terminal prompt.
// - It never writes anything to disk and never sends prompt text.
// - Arguments are ignored. The installer passes one so Claude Code spawns it directly (exec form).
using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Globalization;
using System.Text;
using System.Threading;

static class Relay
{
    const int MaxStdin = 4 * 1024 * 1024;
    const int MaxField = 4000;

    static readonly long StartedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

    static int Main()
    {
        AppDomain.CurrentDomain.UnhandledException += (s, e) => Environment.Exit(0);
        try { Run(); } catch { }
        return 0;
    }

    static void Run()
    {
        // Not %APPDATA%, which a packaged app like the Claude desktop app sees a private copy of.
        // %USERPROFILE% first, like Node's os.homedir() in the app.
        string home = Environment.GetEnvironmentVariable("USERPROFILE");
        if (string.IsNullOrEmpty(home)) home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        string dir = Path.Combine(home, ".theisland");
        var conn = Json.Parse(File.ReadAllText(Path.Combine(dir, "relay.json"), Encoding.UTF8)) as Dictionary<string, object>;
        if (conn == null || !(Get(conn, "port") is long) || !(Get(conn, "token") is string)) return;

        // Never hang Claude Code if stdin is not closed for some reason.
        byte[] raw = ReadStdin(3000);
        if (raw == null) return;
        // Strip a UTF-8 BOM (Windows PowerShell adds one when piping).
        var input = Json.Parse(new UTF8Encoding(false).GetString(raw).TrimStart('﻿')) as Dictionary<string, object>;
        if (input == null) return;
        Send(input, Trim(input), (int)(long)conn["port"], (string)conn["token"]);
    }

    static byte[] ReadStdin(int timeoutMs)
    {
        byte[] result = null;
        var reader = new Thread(() =>
        {
            try
            {
                using (var stdin = Console.OpenStandardInput())
                using (var buf = new MemoryStream())
                {
                    var chunk = new byte[65536];
                    int n;
                    while ((n = stdin.Read(chunk, 0, chunk.Length)) > 0)
                    {
                        if (buf.Length + n > MaxStdin) return;
                        buf.Write(chunk, 0, n);
                    }
                    result = buf.ToArray();
                }
            }
            catch { }
        });
        reader.IsBackground = true;
        reader.Start();
        return reader.Join(timeoutMs) ? result : null;
    }

    static object Get(Dictionary<string, object> d, string key)
    {
        object v;
        return d != null && d.TryGetValue(key, out v) ? v : null;
    }

    // JavaScript truthiness, for the `a || b || c` picks below.
    static bool Truthy(object v)
    {
        if (v == null) return false;
        if (v is bool) return (bool)v;
        if (v is string) return ((string)v).Length > 0;
        if (v is long) return (long)v != 0;
        if (v is double) return (double)v != 0 && !double.IsNaN((double)v);
        return true;
    }

    static object Clip(object v, int n)
    {
        var s = v as string;
        return s != null && s.Length > n ? s.Substring(0, n) + " ...[truncated]" : v;
    }

    static object ClipObject(object v)
    {
        var obj = v as Dictionary<string, object>;
        if (obj != null)
        {
            var o = new Dictionary<string, object>();
            foreach (var kv in obj) o[kv.Key] = ClipValue(kv.Value);
            return o;
        }
        var arr = v as List<object>;
        if (arr != null)
        {
            var a = new List<object>(arr.Count);
            foreach (var x in arr) a.Add(ClipValue(x));
            return a;
        }
        return v;
    }

    static object ClipValue(object v)
    {
        return v is string ? Clip(v, MaxField) : ClipObject(v);
    }

    // Like Node's path.basename on Windows: the last part after / or \, ignoring trailing ones.
    static string BaseName(string p)
    {
        string t = p.TrimEnd('/', '\\');
        if (t.Length == 0) return "";
        return t.Substring(t.LastIndexOfAny(new[] { '/', '\\' }) + 1);
    }

    // A one-line hint of what a tool is doing, for the status view.
    static string ToolHint(object toolInput)
    {
        var ti = toolInput as Dictionary<string, object>;
        if (ti == null) return "";
        object v = "";
        foreach (var k in new[] { "command", "file_path", "notebook_path", "url", "pattern", "query", "description" })
        {
            if (Truthy(Get(ti, k))) { v = Get(ti, k); break; }
        }
        var s = v as string;
        if (s == null) return "";
        if (Truthy(Get(ti, "file_path")) || Truthy(Get(ti, "notebook_path"))) s = BaseName(s);
        return (string)Clip(CollapseSpaces(s), 120);
    }

    // Like s.replace(/\s+/g, ' ') in JavaScript (a Regex here costs about 20 ms of startup).
    static string CollapseSpaces(string s)
    {
        var sb = new StringBuilder(s.Length);
        bool space = false;
        foreach (char c in s)
        {
            if (char.IsWhiteSpace(c) || c == '﻿')
            {
                if (!space) sb.Append(' ');
                space = true;
            }
            else
            {
                sb.Append(c);
                space = false;
            }
        }
        return sb.ToString();
    }

    // A short one-line label (subagent description, agent type). Never the prompt.
    static string Label(object v, int n = 60)
    {
        var s = v as string;
        if (s == null) return null;
        string t = CollapseSpaces(s).Trim();
        return t.Length > n ? t.Substring(0, n - 3) + "..." : t;
    }

    // The tool that spawns subagents: "Agent" now, "Task" in older Claude Code versions.
    static bool IsAgentTool(object name)
    {
        return "Agent".Equals(name) || "Task".Equals(name);
    }

    // Leaves out missing values, as JSON.stringify drops undefined.
    static void Put(Dictionary<string, object> d, string key, object v)
    {
        if (v != null) d[key] = v;
    }

    // Keep only what the island shows. Prompt text and tool output are dropped here.
    static Dictionary<string, object> Trim(Dictionary<string, object> e)
    {
        object ev = Get(e, "hook_event_name");
        var o = new Dictionary<string, object>();
        o["ts"] = StartedAt;
        Put(o, "event", ev);
        Put(o, "session_id", Get(e, "session_id"));
        Put(o, "cwd", Get(e, "cwd"));
        Put(o, "permission_mode", Get(e, "permission_mode"));
        // Set when the hook fired inside a subagent (or on SubagentStart/SubagentStop).
        Put(o, "agent_id", Get(e, "agent_id"));
        Put(o, "agent_type", Label(Get(e, "agent_type")));
        // The process that ran this hook: Claude Code. Lets the app notice when it's gone.
        o["pid"] = ParentPid();

        if ("SessionStart".Equals(ev))
        {
            Put(o, "source", Get(e, "source"));
            Put(o, "model", Get(e, "model"));
            Put(o, "session_title", Get(e, "session_title"));
        }
        else if ("UserPromptSubmit".Equals(ev))
        {
            Put(o, "session_title", Get(e, "session_title"));
        }
        else if ("PreToolUse".Equals(ev) || "PostToolUse".Equals(ev))
        {
            object tool = Get(e, "tool_name");
            Put(o, "tool_name", tool);
            Put(o, "tool_use_id", Get(e, "tool_use_id"));
            o["hint"] = ToolHint(Get(e, "tool_input"));
            if (IsAgentTool(tool))
            {
                // Subagent launch: only the short label and type, never tool_input.prompt.
                var ti = Get(e, "tool_input") as Dictionary<string, object> ?? new Dictionary<string, object>();
                o["hint"] = Label(Get(ti, "description")) ?? "";
                var sub = new Dictionary<string, object>();
                Put(sub, "description", Label(Get(ti, "description")));
                Put(sub, "type", Label(Get(ti, "subagent_type")));
                sub["background"] = true.Equals(Get(ti, "run_in_background"));
                if ("PostToolUse".Equals(ev))
                {
                    // "completed" (foreground finished) or "async_launched" (now in the background). No content.
                    var r = Get(e, "tool_response") as Dictionary<string, object>;
                    Put(sub, "status", Get(r, "status") as string);
                    Put(sub, "agent_id", Get(r, "agentId") as string);
                }
                o["subagent"] = sub;
            }
        }
        else if ("PermissionRequest".Equals(ev))
        {
            Put(o, "tool_name", Get(e, "tool_name"));
            Put(o, "tool_input", ClipObject(Get(e, "tool_input")));
        }
        else if ("Notification".Equals(ev))
        {
            Put(o, "notification_type", Get(e, "notification_type"));
            Put(o, "message", Clip(Get(e, "message"), 300));
        }
        else if ("Stop".Equals(ev))
        {
            Put(o, "last_message", Clip(Get(e, "last_assistant_message"), 200));
        }
        else if ("SessionEnd".Equals(ev))
        {
            Put(o, "reason", Get(e, "reason"));
        }
        return o;
    }

    // A plain HTTP/1.1 request over a loopback socket. HttpWebRequest costs about 300 ms of setup per
    // run, and this runs on every tool call.
    static void Send(Dictionary<string, object> input, Dictionary<string, object> payload, int port, string token)
    {
        var utf8 = new UTF8Encoding(false);
        byte[] body = utf8.GetBytes(Json.Write(payload));
        bool waitForDecision = "PermissionRequest".Equals(Get(payload, "event"));
        // Status events must be quick. Approvals wait for the user; the app enforces its own timeout,
        // and this guard stays under the hook timeout set by the installer (300 s).
        int timeout = waitForDecision ? 290000 : 1500;
        byte[] head = Encoding.ASCII.GetBytes(
            "POST /event HTTP/1.1\r\nHost: 127.0.0.1:" + port + "\r\nContent-Type: application/json\r\n" +
            "Content-Length: " + body.Length + "\r\nx-island-token: " + token + "\r\nConnection: close\r\n\r\n");

        byte[] response;
        using (var socket = new Socket(AddressFamily.InterNetwork, SocketType.Stream, ProtocolType.Tcp))
        {
            socket.SendTimeout = socket.ReceiveTimeout = timeout;
            var connecting = socket.BeginConnect(IPAddress.Loopback, port, null, null);
            if (!connecting.AsyncWaitHandle.WaitOne(1500)) return;
            socket.EndConnect(connecting);
            socket.Send(head);
            socket.Send(body);
            if (!waitForDecision) return;
            using (var buf = new MemoryStream())
            {
                var chunk = new byte[8192];
                int n;
                while ((n = socket.Receive(chunk)) > 0) buf.Write(chunk, 0, n);
                response = buf.ToArray();
            }
        }

        string text = utf8.GetString(response);
        int split = text.IndexOf("\r\n\r\n", StringComparison.Ordinal);
        if (split < 0 || !text.StartsWith("HTTP/1.1 200 ", StringComparison.Ordinal)) return;
        string headers = text.Substring(0, split).ToLowerInvariant();
        string content = text.Substring(split + 4);
        if (headers.Contains("\r\ntransfer-encoding: chunked")) content = Unchunk(content);
        var reply = Json.Parse(content) as Dictionary<string, object>;
        PrintDecision(Get(reply, "decision"), Get(reply, "answers"), input);
    }

    // AskUserQuestion answered in the island: the island sends one answer per question, in order. They
    // go into the original (unclipped) tool input as "answers", keyed by question text, which is how a
    // hook answers the question. Null when they don't fit the questions, so the terminal asks instead.
    static Dictionary<string, object> AnsweredInput(Dictionary<string, object> input, object answers)
    {
        var list = answers as List<object>;
        var ti = Get(input, "tool_input") as Dictionary<string, object>;
        var questions = Get(ti, "questions") as List<object>;
        if (!"AskUserQuestion".Equals(Get(input, "tool_name")) || list == null || questions == null || list.Count != questions.Count) return null;
        var map = new Dictionary<string, object>();
        for (int i = 0; i < questions.Count; i++)
        {
            var text = Get(questions[i] as Dictionary<string, object>, "question") as string;
            var answer = list[i] as string;
            if (text == null || answer == null) return null;
            map[text] = answer;
        }
        var updated = new Dictionary<string, object>(ti);
        updated["answers"] = map;
        return updated;
    }

    // Decodes a chunked body. The reply is small ASCII JSON, so string lengths equal byte lengths.
    static string Unchunk(string s)
    {
        var sb = new StringBuilder();
        int i = 0;
        while (i < s.Length)
        {
            int eol = s.IndexOf("\r\n", i, StringComparison.Ordinal);
            if (eol < 0) break;
            string size = s.Substring(i, eol - i).Split(';')[0].Trim();
            int n = Convert.ToInt32(size, 16);
            if (n == 0) break;
            sb.Append(s, eol + 2, n);
            i = eol + 2 + n + 2;
        }
        return sb.ToString();
    }

    static void PrintDecision(object d, object answers, Dictionary<string, object> input)
    {
        var decision = new Dictionary<string, object>();
        if ("allow".Equals(d))
        {
            decision["behavior"] = "allow";
            if (answers != null)
            {
                var updated = AnsweredInput(input, answers);
                if (updated == null) return;
                decision["updatedInput"] = updated;
            }
        }
        else if ("deny".Equals(d))
        {
            decision["behavior"] = "deny";
            decision["message"] = "Denied by the user from TheIsland.";
        }
        else return;
        var output = new Dictionary<string, object>();
        output["hookSpecificOutput"] = new Dictionary<string, object> { { "hookEventName", "PermissionRequest" }, { "decision", decision } };
        byte[] bytes = new UTF8Encoding(false).GetBytes(Json.Write(output));
        using (var stdout = Console.OpenStandardOutput())
        {
            stdout.Write(bytes, 0, bytes.Length);
            stdout.Flush();
        }
    }

    [StructLayout(LayoutKind.Sequential)]
    struct ProcessBasicInformation
    {
        public IntPtr ExitStatus;
        public IntPtr PebBaseAddress;
        public IntPtr AffinityMask;
        public IntPtr BasePriority;
        public IntPtr UniqueProcessId;
        public IntPtr InheritedFromUniqueProcessId;
    }

    [DllImport("ntdll.dll")]
    static extern int NtQueryInformationProcess(IntPtr process, int infoClass, ref ProcessBasicInformation info, int size, out int returned);

    [DllImport("kernel32.dll")]
    static extern IntPtr GetCurrentProcess();

    static int ParentPid()
    {
        var info = new ProcessBasicInformation();
        int returned;
        if (NtQueryInformationProcess(GetCurrentProcess(), 0, ref info, Marshal.SizeOf(info), out returned) != 0) return 0;
        return info.InheritedFromUniqueProcessId.ToInt32();
    }
}

// Just enough JSON for hook events: objects become Dictionary<string, object>, arrays List<object>,
// integers long, other numbers double. Strict like JSON.parse; anything else throws, which ends the
// relay quietly. Hand-written because JavaScriptSerializer costs about 175 ms of JIT per run.
static class Json
{
    const int MaxDepth = 512;

    public static object Parse(string s)
    {
        int i = 0;
        object v = Value(s, ref i, 0);
        SkipSpace(s, ref i);
        if (i != s.Length) throw new FormatException("trailing data");
        return v;
    }

    static void SkipSpace(string s, ref int i)
    {
        while (i < s.Length && (s[i] == ' ' || s[i] == '\t' || s[i] == '\n' || s[i] == '\r')) i++;
    }

    static object Value(string s, ref int i, int depth)
    {
        if (depth > MaxDepth) throw new FormatException("too deep");
        SkipSpace(s, ref i);
        if (i >= s.Length) throw new FormatException("end of input");
        char c = s[i];
        if (c == '{')
        {
            var o = new Dictionary<string, object>();
            i++;
            SkipSpace(s, ref i);
            if (i < s.Length && s[i] == '}') { i++; return o; }
            while (true)
            {
                SkipSpace(s, ref i);
                if (i >= s.Length || s[i] != '"') throw new FormatException("expected a key");
                string key = Str(s, ref i);
                SkipSpace(s, ref i);
                if (i >= s.Length || s[i] != ':') throw new FormatException("expected :");
                i++;
                o[key] = Value(s, ref i, depth + 1);
                SkipSpace(s, ref i);
                if (i < s.Length && s[i] == ',') { i++; continue; }
                if (i < s.Length && s[i] == '}') { i++; return o; }
                throw new FormatException("expected , or }");
            }
        }
        if (c == '[')
        {
            var a = new List<object>();
            i++;
            SkipSpace(s, ref i);
            if (i < s.Length && s[i] == ']') { i++; return a; }
            while (true)
            {
                a.Add(Value(s, ref i, depth + 1));
                SkipSpace(s, ref i);
                if (i < s.Length && s[i] == ',') { i++; continue; }
                if (i < s.Length && s[i] == ']') { i++; return a; }
                throw new FormatException("expected , or ]");
            }
        }
        if (c == '"') return Str(s, ref i);
        if (Word(s, ref i, "true")) return true;
        if (Word(s, ref i, "false")) return false;
        if (Word(s, ref i, "null")) return null;
        return Number(s, ref i);
    }

    static bool Word(string s, ref int i, string w)
    {
        if (i + w.Length > s.Length || string.CompareOrdinal(s, i, w, 0, w.Length) != 0) return false;
        i += w.Length;
        return true;
    }

    static string Str(string s, ref int i)
    {
        var sb = new StringBuilder();
        i++;
        while (true)
        {
            if (i >= s.Length) throw new FormatException("unterminated string");
            char c = s[i++];
            if (c == '"') return sb.ToString();
            if (c < ' ') throw new FormatException("control character in string");
            if (c != '\\') { sb.Append(c); continue; }
            if (i >= s.Length) throw new FormatException("bad escape");
            char e = s[i++];
            switch (e)
            {
                case '"': sb.Append('"'); break;
                case '\\': sb.Append('\\'); break;
                case '/': sb.Append('/'); break;
                case 'b': sb.Append('\b'); break;
                case 'f': sb.Append('\f'); break;
                case 'n': sb.Append('\n'); break;
                case 'r': sb.Append('\r'); break;
                case 't': sb.Append('\t'); break;
                case 'u':
                    if (i + 4 > s.Length) throw new FormatException("bad escape");
                    sb.Append((char)int.Parse(s.Substring(i, 4), NumberStyles.AllowHexSpecifier, CultureInfo.InvariantCulture));
                    i += 4;
                    break;
                default: throw new FormatException("bad escape");
            }
        }
    }

    static bool Digit(string s, int i)
    {
        return i < s.Length && s[i] >= '0' && s[i] <= '9';
    }

    static object Number(string s, ref int i)
    {
        int start = i;
        if (i < s.Length && s[i] == '-') i++;
        if (i < s.Length && s[i] == '0') i++;
        else if (Digit(s, i)) while (Digit(s, i)) i++;
        else throw new FormatException("unexpected character");
        bool integral = true;
        if (i < s.Length && s[i] == '.')
        {
            integral = false;
            i++;
            if (!Digit(s, i)) throw new FormatException("bad number");
            while (Digit(s, i)) i++;
        }
        if (i < s.Length && (s[i] == 'e' || s[i] == 'E'))
        {
            integral = false;
            i++;
            if (i < s.Length && (s[i] == '+' || s[i] == '-')) i++;
            if (!Digit(s, i)) throw new FormatException("bad number");
            while (Digit(s, i)) i++;
        }
        string t = s.Substring(start, i - start);
        long l;
        if (integral && long.TryParse(t, NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture, out l)) return l;
        return double.Parse(t, NumberStyles.Float, CultureInfo.InvariantCulture);
    }

    public static string Write(object v)
    {
        var sb = new StringBuilder();
        Write(sb, v);
        return sb.ToString();
    }

    static void Write(StringBuilder sb, object v)
    {
        if (v == null) { sb.Append("null"); return; }
        var s = v as string;
        if (s != null) { WriteString(sb, s); return; }
        if (v is bool) { sb.Append((bool)v ? "true" : "false"); return; }
        if (v is long) { sb.Append(((long)v).ToString(CultureInfo.InvariantCulture)); return; }
        if (v is int) { sb.Append(((int)v).ToString(CultureInfo.InvariantCulture)); return; }
        if (v is double) { sb.Append(((double)v).ToString("R", CultureInfo.InvariantCulture)); return; }
        var o = v as Dictionary<string, object>;
        if (o != null)
        {
            sb.Append('{');
            bool first = true;
            foreach (var kv in o)
            {
                if (!first) sb.Append(',');
                first = false;
                WriteString(sb, kv.Key);
                sb.Append(':');
                Write(sb, kv.Value);
            }
            sb.Append('}');
            return;
        }
        var a = v as List<object>;
        if (a != null)
        {
            sb.Append('[');
            for (int i = 0; i < a.Count; i++)
            {
                if (i > 0) sb.Append(',');
                Write(sb, a[i]);
            }
            sb.Append(']');
            return;
        }
        throw new ArgumentException("can't write " + v.GetType().Name);
    }

    // Escapes like JSON.stringify, including lone surrogates (which UTF-8 can't carry).
    static void WriteString(StringBuilder sb, string s)
    {
        sb.Append('"');
        for (int i = 0; i < s.Length; i++)
        {
            char c = s[i];
            if (c == '"') sb.Append("\\\"");
            else if (c == '\\') sb.Append("\\\\");
            else if (c == '\n') sb.Append("\\n");
            else if (c == '\r') sb.Append("\\r");
            else if (c == '\t') sb.Append("\\t");
            else if (c == '\b') sb.Append("\\b");
            else if (c == '\f') sb.Append("\\f");
            else if (c < ' ') sb.Append("\\u").Append(((int)c).ToString("x4"));
            else if (char.IsHighSurrogate(c) && i + 1 < s.Length && char.IsLowSurrogate(s[i + 1])) sb.Append(c).Append(s[++i]);
            else if (char.IsSurrogate(c)) sb.Append("\\u").Append(((int)c).ToString("x4"));
            else sb.Append(c);
        }
        sb.Append('"');
    }
}
