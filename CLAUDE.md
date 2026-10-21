# TheIsland: notes for Claude Code sessions

Read `docs/PLAN.md` for the full decisions. This file is the short version plus how the code fits together.

## Rules

- Windows 11 only. Electron + React 19 + Tailwind 4, built with electron-vite. Plain JavaScript, no TypeScript.
- Keep it light: target idle about 100 to 150 MB private memory and about 0% CPU. Measure after UI changes
  (see "Measuring" below). No polling where an event exists. No new heavy dependencies.
- **No infinite CSS animations.** A running CSS animation makes Chromium repaint the transparent overlay
  every frame (measured at about 50% of a core). Use a slow JS timer if something must blink.
- Never use the em dash character in UI text or chat. No AI attribution in commits.
- Ask the user before installing big toolchains (for example the .NET SDK), creating a GitHub remote, or
  touching the real `%USERPROFILE%\.claude\settings.json` (show the diff first: `npm run hooks:diff`).
- The settings/customization UI is planned but not built yet. Widgets already declare `options` for it.

## Layout

- `src/main/` (Electron main process)
  - `index.js` wires everything; IPC handlers only accept messages from the island window.
  - `window.js` frameless transparent always-on-top window, `focusable: false`, click-through outside the pill.
  - `relay-server.js` 127.0.0.1 HTTP, random port, token in `%APPDATA%\TheIsland\relay.json`, rejects
    requests with an Origin header. Only `POST /event`. Approvals are answered over IPC, never HTTP.
  - `claude.js` sessions and pending approvals from hook events (memory only).
  - `media.js` runs `resources/media-helper.exe` and reads its JSON lines.
  - `calendar.js` fetches the ICS URL every 15 min (and on resume), parses with `ical.js`.
  - `config.js` settings; the calendar URL is encrypted with `safeStorage` (DPAPI).
  - `tray.js` the only settings in v1: approvals switch, hook install/remove, calendar URL, quit.
- `src/shared/hooks-installer.mjs` safe installer used by both the tray and `scripts/hooks.mjs`.
- `hook/theisland-relay.cjs` the script Claude Code runs. Copied to `%APPDATA%\TheIsland` at app start so
  the hook path doesn't depend on this folder. No dependencies, exits 0 silently on any problem.
- `helper/MediaHelper.cs` tiny C# program for Windows media sessions. Built by `scripts/build-helper.mjs`
  with the `csc.exe` that ships with Windows (.NET Framework 4); the exe is gitignored.
- `src/renderer/src/` React UI. `App.jsx` (pill and expanded view), `components/Claude.jsx`,
  `widgets/<name>/index.jsx` + registration in `widgets/index.js`.

## Claude Code hooks

Sessions end on SessionEnd, when the Claude Code process (the relay's parent pid, checked once a minute while
sessions exist) is gone, or by staleness: "working" with no events for 10 min shows as "No updates", quiet
sessions are forgotten after 45 min. See `src/main/claude.js`.

Events used: SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, Notification, Stop, SessionEnd (all
`async: true`), and PermissionRequest (sync, timeout 300 s). Hook entries use exec form
(`command` = node.exe, `args` = [relay path]); ours are found by the relay filename. The relay drops prompt
text and tool output before sending. A PermissionRequest reply is
`{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"|"deny"}}}`;
printing nothing hands the prompt back to the terminal.

Test without Claude Code: pipe event JSON into the relay while the app runs, for example
`echo '{"hook_event_name":"SessionStart","session_id":"t","cwd":"D:/x"}' | node hook/theisland-relay.cjs`
(use forward slashes in paths; backslashes need JSON escaping).

## Commands

- `npm start` build and run. `npm run dev` hot reload.
- `npm run build:helper` rebuild the media helper.
- `npm run hooks:diff | hooks:install | hooks:uninstall | hooks:status`, add `-- --settings <file>` to test on a copy.

## Measuring

```powershell
Get-Process electron,media-helper | Select Name,Id,CPU,@{n='PrivateMB';e={[int]($_.PrivateMemorySize64/1MB)}}
```

Sample CPU twice, 30 s apart, and compare. Baseline on 2026-10-21: idle about 121 MB private, about 0.5% of one core.
