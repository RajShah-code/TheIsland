# Security

TheIsland can answer Claude Code permission prompts, so security bugs matter more here than in most widgets.

## Reporting a problem

Please don't open a public issue for a security problem. Use GitHub's private reporting instead:
**Security** tab of this repository > **Report a vulnerability**.

Useful things to include: what an attacker can do, the steps to reproduce it, and the TheIsland and
Windows versions you used. You'll get a reply as soon as possible, and credit in the release notes if you want it.

## What counts

For example:

- any way for another program, a web page or another user to send or answer an approval,
- the relay accepting a request without the token, or listening on anything other than 127.0.0.1,
- the hook installer losing or corrupting settings in `%USERPROFILE%\.claude\settings.json`,
- an approval card that shows something different from what Claude Code actually runs,
- prompt text, commands, tokens or calendar addresses written to disk or sent anywhere.

## How it is built

- The hook relay talks to the app over HTTP on 127.0.0.1 only, on a random port, with a random token stored in
  `%USERPROFILE%\.theisland\relay.json`. Requests that carry an `Origin` header (that is, from a browser) are rejected.
- Approvals are answered from the island window over Electron IPC, never over HTTP.
- There is no "Always allow". Each Allow covers only the one request shown.
- If the app is closed, slow or unsure, the hook prints nothing and Claude Code asks in the terminal as usual.
- The calendar address and Google tokens are encrypted with Windows DPAPI and never sent to a renderer.
