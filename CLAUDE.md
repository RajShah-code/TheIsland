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
  - `calendar.js` merges the events of every enabled calendar account, each fetched on its own
    (`Promise.allSettled`): a failing account keeps its last events and gets its own error (`errors[id]`).
    Refresh interval is the fastest any account wants; also refreshes when the island opens (`touch()`), on
    resume and every minute after a failure. Pushes this week plus the next two (`from`, `to`, `events`, each
    event tagged `source` and `color`); other weeks come from `week(start)` over `island:calendar-week`. Weeks
    run Monday to Sunday (`src/shared/weeks.mjs`).
  - `calendars/` one module per provider, each `connect(payload)` -> `{ label, meta, secrets }`,
    `events(ctx, from, to, fresh)`, `disconnect(ctx)`, `REFRESH_MS`, `STALE_MS`:
    `google.js` (Calendar API, built-in OAuth client from `MAIN_VITE_GOOGLE_CLIENT_ID/_SECRET` at build time,
    or the user's own client), `microsoft.js` (Graph `calendarView`, public client `MAIN_VITE_MS_CLIENT_ID`,
    rotating refresh tokens), `caldav.js` (iCloud or any CalDAV server, app-specific password, tiny regex XML
    reader), `ics.js` (iCal links; its `parse()` also serves CalDAV), `notion.js` (internal integration token,
    one database + date property). `oauth.js` is the shared loopback + PKCE flow. `accounts.js` stores
    `calendarAccounts` (non-secret) in config.json and one DPAPI-encrypted JSON per account
    (`calendarSecret:<id>`); `migrateCalendarAccounts()` turns the old single Google sign-in / ICS URL into
    accounts on first start. Builds without the OAuth client IDs offer only what works (`view.calendar.builtIn`).
  - `config.js` settings; `getSettings()` / `updateSettings(patch)` validate through the shared model. Calendar
    secrets are encrypted with `safeStorage` (DPAPI) and never sent to a renderer.
  - `calendar-url.js` the tray's "Add calendar from copied iCal address". Settings adds accounts over
    `settings:calendar-add` (secrets go in, never back out), `settings:calendar-update`, `settings:calendar-remove`.
  - `updates.js` the update notice, GitHub installer build only (not the Store build): a minute after start
    and every 12 h (or on resume after that) it asks GitHub's latest-release API and reports a newer version.
    Downloads nothing; the tray ("Update available...") and Settings > About link to the site's Download page.
    `updates.check` turns it off. `ISLAND_UPDATE_URL` points it at a fake server for testing.
  - `claude-hooks.js` the install/remove dialogs for the Claude Code hooks (what gets added, then a backup and
    the write), shared by the tray, Settings > Claude Code and the one-time offer a few seconds after a start
    where `%USERPROFILE%\.claude` exists and the hooks aren't installed (`claudeHooksOffered` in config.json;
    asked once, whatever the answer). No installer step: the Store package can't run one.
  - `tray.js` Settings..., hide switch, approvals switch, hook install/remove, calendar URL, quit.
- `src/shared/hooks-installer.mjs` safe installer used by both the tray and `scripts/hooks.mjs`.
- `src/shared/settings-model.mjs` the settings model: defaults, `normalizeSettings` (clamps, drops unknown
  keys), `applySettingsPatch`, `sortByOrder`, `WIDGET_IDS`, `SYSTEM_ITEMS`. Shape: `approvalsEnabled`,
  `approvalTimeoutSec` (30..285, the hook dies at 300 s), `pill { leftFallback, rightFallback }`,
  `widgets { order, hidden }`, `system { order, hidden, controlStyle }`, `claude { buddy }`, `island { ghostOpacity }`, `updates { check }`.
  Start with Windows is a `TheIsland.lnk` in the user's Startup folder (not stored); the Run registry entry
  Electron's login item writes was never launched by Explorer on this machine.
- `hook/TheIslandRelay.cs` the relay Claude Code runs, built to `resources/theisland-relay.exe` (C# 5, so
  hooks need no Node.js). Its own small JSON reader/writer and a raw loopback socket, because
  `JavaScriptSerializer` and `HttpWebRequest` each added hundreds of ms per run. Copied to
  `%USERPROFILE%\.theisland` at app start so the hook path doesn't depend on the install folder (a running copy
  is renamed aside first). Exits 0 silently on any problem. It replaced `theisland-relay.cjs`; the installer
  still recognises entries for that file so installing again replaces them.
- `helper/IslandHelper.cs` tiny C# program: Windows media sessions (events) and fullscreen detection (one
  cheap check per second, reports changes only). Built by `scripts/build-helper.mjs` (with the relay)
  with the `csc.exe` that ships with Windows (.NET Framework 4, C# 5 only); the exes are gitignored.
- `src/renderer/src/` React UI. `App.jsx` (the notch: closed, open with Home / Claude Code tabs, fullscreen
  hide and top-edge peek), `components/Claude.jsx`, `widgets/<name>/index.jsx` + registration in
  `widgets/index.js`. Each widget is one column of the Home tab (`width`, optional `visible(state)`);
  `orderedWidgets(settings)` applies the user's order and hidden list.
- `src/renderer/src/components/System.jsx` the System tab, laid out like the Mac's Control Center (modules,
  ring gauges, thick sliders, round buttons). To look at it without the island: `npx vite --config
  src/renderer/preview/vite.config.mjs`, then open /preview/system.html (`?style=both|icon|label`, `&all`) or /preview/calendar.html, /preview/settings.html (`?update`, `?store`; a fake settingsApi).
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
(`command` = the relay exe, `args` = `["--hook"]`, which only forces exec form; without args Claude Code runs
the command through Git Bash or PowerShell); ours are found by the relay filename. The relay drops prompt
text and tool output before sending. A PermissionRequest reply is
`{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"|"deny"}}}`;
printing nothing hands the prompt back to the terminal.

Test without Claude Code: pipe event JSON into the relay while the app runs, for example
`echo '{"hook_event_name":"SessionStart","session_id":"t","cwd":"D:/x"}' | resources/theisland-relay.exe`
(use forward slashes in paths; backslashes need JSON escaping). The relay reads `relay.json` from
`%USERPROFILE%`, so to test against a fake server set `USERPROFILE` for the relay process only.

## Commands

- `npm start` build and run. `npm run dev` hot reload.
- `npm run build:helper` rebuild the media helper and the hook relay.
- `npm test` tests the relay exe against a fake island server (`scripts/test-relay.mjs`).
- `npm run dist` builds the installer (`electron-builder.yml`) into `dist/`. Releases: bump `version` in
  package.json, commit, push a `v<version>` tag; `.github/workflows/release.yml` builds a draft GitHub Release.
- `npm run dist:store` builds the Microsoft Store package (`dist/TheIsland-Store-<version>.appx`, unsigned;
  Microsoft signs it). Its identity in `electron-builder.yml` (`appx`) must match Partner Center. Tiles come
  from `node scripts/make-appx-assets.mjs` (build/appx); the startup task from `build/appx-extensions.xml`.
  In the Store build `process.windowsStore` is true: index.js skips its Startup-folder shortcut and app ID,
  and Settings shows "Open startup settings" (Windows Settings > Apps > Startup) instead of the switch.
  `toolsets.winCodeSign: 1.1.0` is needed: the default 2018 makepri.exe fails on Windows 11.
- `npm run hooks:diff | hooks:install | hooks:uninstall | hooks:status`, add `-- --settings <file>` to test on a copy.

## Measuring

```powershell
Get-Process electron,island-helper | Select Name,Id,CPU,@{n='PrivateMB';e={[int]($_.PrivateMemorySize64/1MB)}}
```

Sample CPU twice, 30 s apart, and compare. Baseline on 2026-10-21: idle about 121 MB private, about 0.5% of one core.
