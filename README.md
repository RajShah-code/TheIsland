# TheIsland

A small "dynamic island" for Windows 11: a black notch glued to the top centre of the screen. Hover it to open it:

- **Home** tab, in separate columns: **Music** (only while a player is open; play/pause, next, previous, works with Spotify, no API key), **Clock** (12-hour) and **Calendar** (a day strip and that day's events, from your Google Calendar's secret iCal link).
- **Claude Code** tab (only while a Claude Code session is open): your live sessions, and Allow / Deny buttons for permission prompts. It opens by itself when Claude Code needs an approval.

When nothing is going on, the notch is small and empty; it shows album art and Claude's status on its sides when something is live. When a fullscreen game or video is in front, the notch hides. Touch the top edge of the screen near the centre to bring it back; it hides again a few seconds after you move away.

## Run it

Needs Node.js 24 on Windows 11.

```bash
npm install
npm start
```

`npm start` builds the app and runs it. For development with hot reload, use `npm run dev`.
The tray icon (a small white pill) has the menu: approvals on/off, install/remove hooks, calendar, quit.

## Connect Claude Code

TheIsland gets Claude Code events through hooks in `%USERPROFILE%\.claude\settings.json`.

```bash
npm run hooks:diff        # show what would change, write nothing
npm run hooks:install     # show the diff, ask, back up the file, then install
npm run hooks:uninstall   # remove only TheIsland's entries
```

You can also use **Install Claude Code hooks...** in the tray menu. The installer:

- refuses to touch the file if it can't parse it,
- saves a timestamped backup (`settings.json.theisland-backup-...`) first,
- only adds or removes entries that point at `theisland-relay.cjs`, and keeps all your other settings and hooks.

When TheIsland isn't running, the hooks exit right away and Claude Code works as normal.
If you don't answer an approval in the island within 2 minutes, or press **Answer in terminal**, the normal terminal prompt appears.
There is no "Always allow": each Allow covers only the one request shown.

## Set up the calendar

1. In Google Calendar on the web, open **Settings**, pick your calendar, and copy **Secret address in iCal format**.
2. Open TheIsland **Settings** > **Calendar**, paste it and press **Save** (or use the tray item **Set calendar from copied iCal address**).

The address is stored encrypted with Windows DPAPI in `%USERPROFILE%\.theisland\config.json` and kept until you remove it. The calendar refreshes every 15 minutes.

## Footprint

Measured on 2026-10-21 (Electron 44, software rendering):

| State | Private memory | CPU |
| --- | --- | --- |
| Idle (no session working) | about 121 MB | about 0.5% of one core |
| A Claude session working | about 119 MB | about 6% of one core |

## Files and privacy

Everything lives in `%USERPROFILE%\.theisland` (not `%APPDATA%`, which apps started from a packaged app such as the Claude desktop app see a private copy of): `config.json`, `relay.json` (port and token, deleted on quit), `theisland-relay.cjs` (the hook script), and a small `island.log` (capped at 256 KB, no prompt text, commands or URLs).
No telemetry. The only network calls are to your calendar URL.
