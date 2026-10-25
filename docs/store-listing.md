# Microsoft Store submission: TheIsland

Everything to paste into Partner Center (Apps and games > TheIsland > Start submission), section by section.
Keep this file up to date when the app changes, so later updates only need small edits.

Product identity (already set in `electron-builder.yml`): `RajShah-code.TheIsland`,
`CN=D1CD4C9E-94A4-4892-B57E-2086BBC4BE6C`, publisher display name `RajShah-code`, Store ID `9PFH56G16HFB`.
Package to upload: `dist/TheIsland-Store-<version>.appx` (`npm run dist:store`).

---

## 1. Pricing and availability

| Field | Answer |
|---|---|
| Markets | All markets (default) |
| Discoverability | Make this product available and discoverable in the Store |
| Schedule | As soon as possible after certification |
| Pricing | **Free** |
| Free trial | No free trial |
| Sale pricing | None |

## 2. Properties

| Field | Answer |
|---|---|
| Category | **Productivity** |
| Subcategory | (none) |
| Privacy policy URL | `https://rajshah-code.github.io/TheIsland/privacy.html` |
| Website | `https://rajshah-code.github.io/TheIsland/` |
| Support contact info | `https://rajshah-code.github.io/TheIsland/help.html` |
| Game settings | Not applicable |

**Product declarations** (tick only these):

- **This product accesses, collects, or transmits personal information**: Yes. It reads your calendar events
  (from Google, only if you set it up) and what is playing, all on your PC. The privacy policy covers this.
- This app has been tested to meet accessibility guidelines: leave unticked.
- Customers can install this app to alternate drives or removable storage: leave the default.
- This app depends on non-Microsoft drivers or NT services: **No** (unticked).

**System requirements**: leave the hardware fields empty. In "Additional system requirements" (if shown):
`Windows 11, 64-bit. Claude Code is optional and only needed for the developer features.`

## 3. Age ratings

Choose **App (not a game)** and answer the questionnaire. For TheIsland every content question is **No**:

| Question (wording varies) | Answer |
|---|---|
| Violence, blood, fear, sexuality, nudity, language, drugs, gambling | No |
| Users can interact or exchange content (chat, messaging, sharing) | No |
| Shares the user's physical location with other users | No |
| Digital purchases, in-app purchases | No |
| Unrestricted internet access (a web browser or search engine) | No |
| Collects or shares personal data with third parties | No (it only connects to Google Calendar on your request) |

Expected result: **3+ / Everyone** in every rating system.

## 4. Packages

- Upload `dist/TheIsland-Store-0.1.0.appx`.
- Device families: **Windows 10/11 Desktop** only.

## 5. Store listing (English, United States)

### Description

```
TheIsland puts the little things you check all day into a small notch at the top of your screen. It stays out of the way when nothing is happening, and opens the moment you hover it.

FOR EVERY DAY
• Music: play, pause and skip whatever is playing in Spotify, a browser or any app that uses Windows' media controls, and see the song and its cover art without switching windows. No account or API key needed.
• Calendar: your Google Calendar week, Monday to Sunday, with each day's events one hover away.
• System: CPU, memory and battery at a glance, volume and brightness sliders, and quick toggles like Wi-Fi, Bluetooth and Night light.
• Out of the way: it hides during fullscreen games and videos, and is light on your PC, using about 120 MB of memory and close to 0% CPU at rest.
• Yours to arrange: choose which widgets show, their order, and what the closed notch shows.

FOR DEVELOPERS
TheIsland has first-class support for Claude Code. When Claude Code needs permission to run a command or edit a file, the island opens with the exact command or change, so you can allow or deny it in one click. When Claude asks you a question, you see its options as buttons. Every session and its subagents show live. Connecting Claude Code is optional and done from the tray menu, which shows the change first and saves a backup.

PRIVATE BY DEFAULT
No account, no ads and no tracking. TheIsland only connects to your calendar, and only if you set one up. It is free and open source under the MIT license.

TheIsland is an independent product by Archway. It is not affiliated with or endorsed by Anthropic. Claude and Claude Code are trademarks of Anthropic.
```

### Short description

```
A dynamic island for Windows 11: music, your calendar and quick system controls in a small notch at the top of your screen, with first-class Claude Code support for developers.
```

### What's new in this version

```
First release.
```

### Product features (one per line, up to 20)

```
Music controls for Spotify, browsers and any app in Windows' media controls
Song title and cover art at a glance
Your Google Calendar week with each day's events
CPU, memory and battery gauges
Volume and brightness sliders and a sound output picker
Quick toggles for Wi-Fi, Bluetooth, Night light and more
Hides automatically during fullscreen games and videos
Choose and reorder your widgets
Claude Code approvals: allow or deny a command in one click
Claude Code questions answered with clickable options
Every Claude Code session and subagent, live
No account, no ads, no tracking
Light on your PC: about 120 MB and close to 0% CPU at rest
Free and open source under the MIT license
```

### Screenshots

At least one, up to 10. PNG, 1366×768 or larger. Ours are 1600×900 in `docs/store-screenshots/`, taken
from the real app with a separate test profile and sample data only (sample track, sample calendar, sample
Claude Code events, a plain wallpaper, no taskbar). Captions are optional; suggested:

| File | Caption |
|---|---|
| `1-home.png` | Your music, calendar and clock, one glance away |
| `2-system.png` | Quick system controls |
| `3-claude-approval.png` | Approve Claude Code without leaving your work |
| `4-claude-question.png` | Answer Claude's questions with one click |

Store logo (optional): `build/appx/Square150x150Logo.scale-200.png` (300×300).

### Search terms (up to 7)

```
dynamic island
notch
media controls
calendar
quick settings
widgets
productivity
```

### Other listing fields

| Field | Answer |
|---|---|
| Copyright and trademark info | `© 2026 Raj Shah (Archway). Open source under the MIT license.` |
| Additional license terms | the text below |
| Developed by | `Archway` |

**Additional license terms** (so the MIT license applies instead of the Store's standard terms):

```
TheIsland is free and open-source software, licensed under the MIT License:
https://rajshah-code.github.io/TheIsland/license.html

MIT License

Copyright (c) 2026 Raj Shah

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

## 6. Submission options

### Restricted capability: runFullTrust (justification)

```
TheIsland is a desktop (Win32, Electron) app packaged as MSIX. It needs runFullTrust to run as a desktop process: it shows an always-on-top overlay window at the top of the screen, reads Windows media sessions and system status through a bundled helper program, and receives events from Claude Code (an optional developer tool) over a local 127.0.0.1 connection. It installs no drivers or services.
```

### Notes for certification

```
TheIsland is a dynamic island (a small always-on-top notch) for Windows 11. No account or sign-in is needed.

How to test:
1. Start TheIsland. A small black notch appears at the top centre of the primary screen, and a small white pill icon appears in the system tray.
2. Hover the notch to open it. The Home tab shows music (play something in Media Player, Spotify or a browser), the clock and the calendar. The System tab shows CPU, memory and battery gauges, volume and brightness sliders and quick toggles.
3. Settings: right-click the tray icon and choose Settings... The calendar is optional (Settings > Calendar).
4. Claude Code support is optional and only for developers who have Claude Code installed. Tray > "Install Claude Code hooks..." shows the exact change to %USERPROFILE%\.claude\settings.json and asks for confirmation before writing anything, and saves a backup first. Without Claude Code, the Claude Code tab does not appear.

Notes:
- The app starts at sign-in through its startup task. Users can turn this off in Settings > Apps > Startup (also linked from the app's Settings).
- Bundled helpers: island-helper.exe reads Windows media sessions and fullscreen state; theisland-relay.exe is run by Claude Code and forwards its events to the app over 127.0.0.1. Both are part of the open-source project.
- The app stores its settings in %USERPROFILE%\.theisland.
- Source code: https://github.com/RajShah-code/TheIsland
```

## 7. Submit

Click **Submit to the Store**. Certification usually takes up to 3 business days; Microsoft emails the result.
If it fails, the report names the policy and what to change.
