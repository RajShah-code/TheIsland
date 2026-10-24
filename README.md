# TheIsland

**Approve Claude Code permission prompts without leaving what you're doing.**

TheIsland is a small "dynamic island" for Windows 11: a black notch at the top centre of the screen. It shows
what your Claude Code sessions are doing, pops open with **Allow** / **Deny** when one needs permission, and
holds a few everyday widgets. It stays out of the way and costs about 120 MB of memory and close to 0% CPU at rest.

> TheIsland is an independent project. It is not made by, affiliated with or endorsed by Anthropic.
> "Claude" and "Claude Code" are trademarks of Anthropic.

## What it does

Hover the notch to open it. It has three tabs:

- **Claude Code** (while a session is open): every live session with its project folder, state (working,
  waiting for you, done) and current tool, plus running subagents. When Claude Code asks for permission, the
  island opens by itself and shows the exact command or file, with **Allow**, **Deny** and **Answer in terminal**.
- **Home**: **Music** (play/pause, next, previous, title and cover art; works with Spotify, browsers and any
  player that shows up in Windows' media controls, no account or API key), a 12-hour **Clock**, and a
  **Calendar** with a Monday to Sunday week strip and that day's events from Google Calendar.
- **System**: CPU, memory, GPU, disk, network and battery at a glance, volume and brightness sliders, the sound
  output picker, and quick toggles such as Wi-Fi, Bluetooth, Night light and Mic mute.

When nothing is going on the notch is small and empty. When a fullscreen game or video is in front, it hides;
touch the top edge of the screen near the centre to bring it back.

Order and hide widgets and system controls, change the approval timeout and more in **Settings** (the gear in
the open island, or the tray icon).

## Install

1. Download `TheIsland-Setup-<version>.exe` from the [latest release](../../releases/latest) and run it.
2. The installer isn't code-signed yet, so Windows SmartScreen may say it "protected your PC". Click
   **More info** > **Run anyway**. You can check the download against the SHA-256 listed in the release.
3. TheIsland starts and puts a small white pill in the tray. Right-click it > **Install Claude Code hooks...**

Requires Windows 11 and Claude Code. Node.js is not needed.

## Connect Claude Code

TheIsland gets Claude Code events through [hooks](https://docs.claude.com/en/docs/claude-code/hooks) in
`%USERPROFILE%\.claude\settings.json`. The installer (tray > **Install Claude Code hooks...**):

- shows what will change before writing anything,
- refuses to touch the file if it can't parse it,
- saves a timestamped backup (`settings.json.theisland-backup-...`) first,
- only adds or removes entries that run `theisland-relay.exe`, and keeps all your other settings and hooks.

**Remove Claude Code hooks...** in the same menu takes out only TheIsland's entries.

When TheIsland isn't running, the hooks exit right away and Claude Code works as normal. If you don't answer
an approval in the island in time (2 minutes by default, up to 4 3/4 in Settings), or press **Answer in
terminal**, the normal terminal prompt appears. There is no "Always allow": each Allow covers only the one
request shown. Turn approvals off in the tray menu to only see status.

## Set up the calendar

Two ways, both in **Settings** > **Calendar**:

- **iCal address** (no setup, but Google only updates this copy every few hours). In Google Calendar on the web,
  open **Settings**, pick your calendar and copy **Secret address in iCal format**. Paste it in TheIsland and
  press **Save**. It refreshes every 15 minutes.
- **Google sign-in** (changes show up within seconds, but needs a one-time Google Cloud setup). Create a
  project, enable the **Google Calendar API**, set up the OAuth consent screen (External, add yourself as a test
  user, or publish it so the sign-in doesn't expire every 7 days), and create an OAuth client of type
  **Desktop app**. Paste its client ID and secret and press **Sign in with Google**. TheIsland only asks for
  read-only access and reads the calendars ticked in Google Calendar.

## Privacy

- No telemetry, no accounts, no servers. The only network calls go to your calendar (the iCal address or
  Google's Calendar API).
- Everything lives in `%USERPROFILE%\.theisland`: `config.json` (settings; the calendar address and Google
  tokens are encrypted with Windows DPAPI), `relay.json` (port and token, deleted on quit), `theisland-relay.exe`
  (the small program the hooks run) and `island.log` (capped at 256 KB).
- The hook script drops prompt text and tool output before sending anything to the app, and nothing writes
  prompts, commands or URLs to disk.

See [SECURITY.md](SECURITY.md) for how approvals are protected and how to report a problem.

## Footprint

Measured on 2026-10-21 (Electron 44, software rendering):

| State | Private memory | CPU |
| --- | --- | --- |
| Idle (no session working) | about 121 MB | about 0.5% of one core |
| A Claude session working | about 119 MB | about 6% of one core |

## Build from source

Needs Windows 11 and Node.js 24. The small media and fullscreen helper (`helper/IslandHelper.cs`) is compiled
with the `csc.exe` that ships with Windows, so no .NET SDK is needed.

```bash
npm install
npm start
```

`npm start` builds and runs the app, `npm run dev` runs it with hot reload, and `npm run dist` builds the installer
into `dist/`. The hooks can also be managed from the command line:

```bash
npm run hooks:diff        # show what would change, write nothing
npm run hooks:install     # show the diff, ask, back up the file, then install
npm run hooks:uninstall   # remove only TheIsland's entries
```

To test hooks without Claude Code, pipe an event into the relay while the app runs:

```bash
echo '{"hook_event_name":"SessionStart","session_id":"t","cwd":"D:/x"}' | resources/theisland-relay.exe
```

`docs/PLAN.md` has the design decisions and `CLAUDE.md` explains how the code fits together.

## Contributing

Issues and pull requests are welcome. Keep it light: the app should stay around 100 to 150 MB and about 0% CPU
when idle, so please measure after UI changes (see `CLAUDE.md`), avoid infinite CSS animations and polling, and
don't add heavy dependencies.

## License

[MIT](LICENSE)
