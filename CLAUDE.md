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
- Settings live in the settings window (tray "Settings..." or the gear in the open island). Widget `options`
  are declared but not shown there yet.

## Layout

- All data (settings, relay.json, the hook script, log, Chromium files) lives in `%USERPROFILE%\.theisland`,
  set as `userData` before anything else (`useDataDir()` in `index.js`, path from `dataDir()` in
  `hooks-installer.mjs`). Not `%APPDATA%`: processes started from the Claude desktop app (MSIX) get a private
  copy of AppData, so `npm start` from there and the login-started island saw different settings and hooks
  read a stale relay.json. The first start copies `config.json` and `Local State` (the DPAPI-wrapped key)
  over from `%APPDATA%\TheIsland`.

- `src/main/` (Electron main process)
  - `index.js` wires everything; `island:*` IPC handlers only accept the island window, `settings:*` only the
    settings window. Every settings change goes through `settingsChanged()`: saves, pushes `island:settings`
    and `settings:changed`, refreshes the tray.
  - `settings-window.js` the settings window: framed, created when opened, destroyed when closed, one at a time.
  - `window.js` frameless transparent always-on-top window, `focusable: false`. It ignores the mouse
    completely (`setIgnoreMouseEvents(true)`, no `forward`) except while the island is open and the pointer
    is on it.
  - `pointer.js` polls `screen.getCursorScreenPoint()` (about 250 ms far away, 40 ms within 40 px of the
    window) and sends `island:pointer` `{ x, y, inside }` only when the point inside the window changes,
    plus one `inside: false` when it leaves. Forwarded mouse moves were dropped by UIPI over elevated
    windows and cost 15 to 25% of a core. No polling while hidden; while interactive the renderer uses
    real mouse events and only a guard runs (cursor outside for 500 ms: mouse handed back). The renderer
    feeds both sources into one handler (`src/renderer/src/pointer.js`, also used by the buddy's eyes).
  - `relay-server.js` 127.0.0.1 HTTP, random port, token in `%USERPROFILE%\.theisland\relay.json`, rejects
    requests with an Origin header. Only `POST /event`. Approvals are answered over IPC, never HTTP.
  - `claude.js` sessions and pending approvals from hook events (memory only).
  - `helper.js` runs `resources/island-helper.exe` (music events + fullscreen on/off) and reads its JSON lines.
  - `calendar.js` fetches the ICS URL every 15 min (and on resume, and every minute after a failure), parses with `ical.js`.
  - `config.js` settings; `getSettings()` / `updateSettings(patch)` validate through the shared model. The
    calendar URL is encrypted with `safeStorage` (DPAPI) and never sent to a renderer.
  - `calendar-url.js` set the calendar from a pasted address or the clipboard / remove it (tray and settings window).
    The settings window sends the address in; it is never sent back out.
  - `tray.js` Settings..., hide switch, approvals switch, hook install/remove, calendar URL, quit.
- `src/shared/hooks-installer.mjs` safe installer used by both the tray and `scripts/hooks.mjs`.
- `src/shared/settings-model.mjs` the settings model: defaults, `normalizeSettings` (clamps, drops unknown
  keys), `applySettingsPatch`, `sortByOrder`, `WIDGET_IDS`, `SYSTEM_ITEMS`. Shape: `approvalsEnabled`,
  `approvalTimeoutSec` (30..285, the hook dies at 300 s), `pill { leftFallback, rightFallback }`,
  `widgets { order, hidden }`, `system { order, hidden, controlStyle }`, `claude { buddy }`, `island { ghostOpacity }`.
  Start with Windows is a `TheIsland.lnk` in the user's Startup folder (not stored); the Run registry entry
  Electron's login item writes was never launched by Explorer on this machine.
- `hook/theisland-relay.cjs` the script Claude Code runs. Copied to `%USERPROFILE%\.theisland` at app start so
  the hook path doesn't depend on this folder. No dependencies, exits 0 silently on any problem.
- `helper/IslandHelper.cs` tiny C# program: Windows media sessions (events) and fullscreen detection (one
  cheap check per second, reports changes only). Built by `scripts/build-helper.mjs`
  with the `csc.exe` that ships with Windows (.NET Framework 4); the exe is gitignored.
- `src/renderer/src/` React UI. `App.jsx` (the notch: closed, open with Home / Claude Code tabs, fullscreen
  hide and top-edge peek), `components/Claude.jsx`, `widgets/<name>/index.jsx` + registration in
  `widgets/index.js`. Each widget is one column of the Home tab (`width`, optional `visible(state)`);
  `orderedWidgets(settings)` applies the user's order and hidden list.
- `src/renderer/settings.html` + `src/renderer/src/settings/` the settings page, a second renderer entry with
  its own preload (`src/preload/settings.js`, `window.settingsApi`) and stylesheet, so none of it loads in
  the island.
- The notch shape is sized in px from React and animated with CSS transitions in `styles.css` (auto sizes
  can't animate). Transitions only run while the shape changes, so it costs nothing at rest.

## Claude Code hooks

Sessions end on SessionEnd, when a finished session's Claude desktop app has no visible window left (closed to the
tray; the helper's "hosts" command), when the Claude Code process (the relay's parent pid, checked every 10 s while
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
Get-Process electron,island-helper | Select Name,Id,CPU,@{n='PrivateMB';e={[int]($_.PrivateMemorySize64/1MB)}}
```

Sample CPU twice, 30 s apart, and compare. Baseline on 2026-10-21: idle about 121 MB private, about 0.5% of one core.
