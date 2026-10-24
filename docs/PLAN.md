# TheIsland: plan and decisions

A personal "dynamic island" for Windows 11: a small always-on-top pill at the top-centre of the
screen that shows live Claude Code status, lets the user Allow/Deny Claude Code permission prompts,
and hosts widgets (music, calendar, clock). Inspired by github.com/louis-cfm/coucou, but written from
scratch (no code copied) and built safer.

Decided on 2026-10-21 in a planning conversation. Owner: Raj Shah (GitHub: RajShah-code).

## Decisions

- **Stack:** Electron + React + Tailwind (+ TypeScript or JS, builder's call; user knows React/Electron
  from their EduSync app). Tauri was considered and rejected so the user can read all the code.
- **Platform:** Windows 11 only for now. Node v24 is installed. .NET SDK is NOT installed.
- **v1 scope:**
  1. Core: island window + live Claude Code status + Allow/Deny from the widget + safe hook installer.
  2. Music widget ("Spotify"): play/pause/next/prev, track title/artist/art.
  3. Calendar widget: today's / next events.
  4. Clock widget: **12-hour format** (e.g. 3:07 PM).
- **Later (not v1):** a settings/customization UI (choose widgets, order, colours, toggles),
  more widgets (GitHub, Render deploy status, Pomodoro, weather...), Spotify Web API extras.

## Hard requirement: light on the laptop

The user is worried about RAM, CPU and disk. Targets:
- Idle RAM roughly 100-150 MB total, CPU ~0% when nothing is happening.
- One renderer window only. No polling loops faster than needed: event-driven where possible
  (hook events push in; media changes are events). Clock ticks once per minute (aligned to the minute).
- Calendar refresh every 10-15 min, not more.
- Pause animations when collapsed / when nothing changes. No heavy libraries.
- Logs capped in size and rotated. Installed size: whatever Electron needs (~250 MB), nothing extra.
- Measure it (Task Manager / process.getProcessMemoryInfo) and report the numbers.

## Architecture

### Island window
- Frameless, transparent, always-on-top (`screen-saver` level), skipTaskbar, centred at the top of
  the primary display. Collapsed pill; expands on hover or when something needs attention
  (permission request, Claude finished). Click-through when collapsed outside the pill if feasible.
- Should not steal focus when it expands for a notification.

### Claude Code integration (hooks)
- Claude Code runs commands registered under `hooks` in `%USERPROFILE%\.claude\settings.json`
  on events (SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, Notification, Stop,
  SubagentStop, and the permission-request event; check current Claude Code hook docs for exact
  names and the JSON input/output format before writing code).
- A tiny hook relay script (Node) reads the event JSON from stdin and forwards it to the app over a
  **local-only channel** (127.0.0.1 HTTP or a named pipe) authenticated with a **random secret token**
  stored in a user-only file. If the app is not running, the relay exits immediately (<300 ms) and
  Claude Code behaves exactly as if the hook did not exist.
  Update 2026-10-24: the relay is now a small C# exe (`hook/TheIslandRelay.cs`, built with Windows' own
  csc.exe), so hooks work for people without Node.js (Claude Code's native installer doesn't need it).
- **Allow/Deny:** on a permission request the relay waits for the user's click and returns the
  decision in the format Claude Code expects. On timeout, or if the app is closed, it returns
  nothing so the normal terminal prompt appears. Show the exact tool + command/file being approved.
- Status shown: per session (project folder name), state (working / waiting for you / done / idle),
  current tool, and model / cost / context usage via the status line if the user opts in.

### Safety rules (learned from Coucou's open security bugs)
- Hook installer: show what will change, make a timestamped backup of settings.json, merge only our
  entries, and **refuse to write if the file can't be parsed**. Never drop existing settings.
- Uninstall/disable cleanly removes only our hook entries (tagged so we can find them).
- **No "Always allow"** in v1. If added later, it must save exactly what was shown, never broader.
- Only authenticated local clients can send or answer approvals. Never bind to 0.0.0.0.
- One global "approvals off" switch (then the island only shows status).
- Don't log prompt text, command contents or secrets to disk.
- No telemetry. No network calls except ones the user's widgets need.

### Widgets
- Each widget = one React component + small manifest in `src/widgets/<name>/`, registered in one
  place, so new widgets can be added without touching the core. Keep the settings UI in mind
  (each widget declares its options) but don't build that UI yet.
- **Music:** use Windows' built-in media session (GlobalSystemMediaTransportControls, the same
  thing the volume flyout uses). Works with Spotify desktop, browsers, any player; no API key,
  no Spotify Premium needed. Needs a native bridge: pick the lightest option (an existing maintained
  npm/native module, or a tiny helper exe; .NET SDK is not installed, so ask the user before adding
  big toolchains). Avoid spawning PowerShell on a timer (too heavy).
- **Calendar:** v1 reads the user's Google Calendar **secret iCal (ICS) address** (Google Calendar >
  Settings > the calendar > "Secret address in iCal format"). No OAuth needed. Store the URL locally,
  not in the repo. Google Calendar API / Outlook can come later.
  Update 2026-10-22: Google Calendar API added (user's own OAuth Desktop client, loopback + PKCE, no SDK),
  because Google's iCal copy lags by hours. The iCal address stays as the no-setup option.
- **Clock:** 12-hour format with AM/PM.

## Working rules for this project
- Git repo in this folder; ask the user before creating a GitHub remote or pushing.
- No AI attribution in commits/PRs.
- Never use the em dash character in UI text or chat (code comments are fine).
- The user likes work split into subagents.
