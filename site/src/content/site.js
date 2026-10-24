// All copy and links for the TheIsland site. Edit text here; no component code needs to change.
// Anything marked TODO is waiting for a final link or wording.

const repo = 'https://github.com/RajShah-code/TheIsland'

export const site = {
  name: 'TheIsland',
  studio: 'Archway',
  // TODO: the Archway site's public URL once it is deployed (used for "by Archway" links).
  studioUrl: '',

  // Public URL of this site once deployed. Used for the canonical link and the Open Graph image.
  url: 'https://rajshah-code.github.io/TheIsland/', // TODO: confirm once hosting is chosen

  seo: {
    title: 'TheIsland: answer Claude Code without leaving your work',
    description:
      'A free, open-source dynamic island for Windows 11. Approve Claude Code permission prompts and answer its questions from the top of your screen, plus music, calendar and system controls.',
    // A 1200×630 PNG at public/og-image.png (WhatsApp and LinkedIn don't show SVG previews).
    ogImage: 'og-image.png', // TODO: add the image
  },

  repo,
  releases: `${repo}/releases/latest`,

  nav: [
    { label: 'Features', id: 'features' },
    { label: 'Privacy', id: 'privacy' },
    { label: 'FAQ', id: 'faq' },
    { label: 'Feedback', id: 'feedback' },
  ],

  hero: {
    eyebrow: 'Free for Windows 11',
    tagline: 'Answer Claude Code without leaving your work.',
    statement:
      'TheIsland is a small notch at the top of your screen. When Claude Code needs permission or asks you to choose, it opens right where you are, so you answer in one click and keep going.',
    secondary: { label: 'View on GitHub', href: repo },
  },

  facts: [
    { title: 'One click', text: 'Allow, deny or pick an answer without switching windows.' },
    { title: 'About 120 MB', text: 'Of memory, and close to 0% CPU while nothing is happening.' },
    { title: 'Stays on your PC', text: 'No account and no telemetry. It only talks to 127.0.0.1.' },
    { title: 'No Node.js needed', text: 'Install it, connect Claude Code from the tray, done.' },
  ],

  problem: {
    eyebrow: 'The problem',
    title: 'Claude stops to ask. You are in another window.',
    body: [
      'Claude Code pauses for permission before it runs a command or edits a file, and sometimes it needs you to choose between options. If you are reading docs or working in another app, it simply waits, and you find out minutes later. Checking back every few minutes breaks your focus the other way round.',
      'TheIsland puts those moments at the top of your screen. It shows exactly what Claude wants to do, and your answer goes straight back to the session. Everything else, from the terminal to your settings, stays as it was.',
    ],
  },

  features: {
    eyebrow: 'What’s inside',
    title: 'Everything Claude needs from you, in one place.',
    items: [
      {
        id: 'approvals',
        lead: true,
        title: 'Approvals you can read',
        text: 'The island opens by itself when Claude Code needs permission and shows the exact command, file or edit. Allow once, deny, or hand it back to the terminal. There is no “Always allow”, so every approval covers only what you saw.',
      },
      {
        id: 'questions',
        title: 'Questions with real buttons',
        text: 'When Claude asks you to choose, you see the question and its options, not raw JSON. One click answers it. Several questions get checkboxes and a Send button.',
      },
      {
        id: 'sessions',
        title: 'Every session, live',
        text: 'Each Claude Code session with its project, its state and the tool it is running, plus the subagents working in the background.',
      },
      {
        id: 'music',
        title: 'Music',
        text: 'Play, pause and skip whatever is playing: Spotify, a browser tab or any app in Windows’ media controls. No account or API key.',
      },
      {
        id: 'calendar',
        title: 'Calendar',
        text: 'Your week from Google Calendar, Monday to Sunday, with each day’s events one hover away.',
      },
      {
        id: 'system',
        title: 'System',
        text: 'CPU, memory and battery at a glance, volume and brightness sliders, and quick toggles like Wi-Fi, Bluetooth and Night light.',
      },
      {
        id: 'fullscreen',
        title: 'Out of the way',
        text: 'It hides during fullscreen games and videos. Touch the top edge of the screen to bring it back.',
      },
    ],
  },

  steps: {
    eyebrow: 'How it works',
    title: 'Set up in a minute.',
    items: [
      { title: 'Install TheIsland', text: 'Run the installer. A small white pill appears in your tray.' },
      {
        title: 'Connect Claude Code',
        text: 'Choose Install Claude Code hooks in the tray. You see exactly what changes in your settings, and a backup is saved first.',
      },
      {
        title: 'Keep working',
        text: 'The next time Claude needs you, the island opens. Answer there, or let it fall back to the terminal.',
      },
    ],
  },

  trust: {
    eyebrow: 'Privacy & safety',
    title: 'Built to be trusted with your terminal.',
    intro: 'TheIsland can approve commands on your machine, so it is careful about how it does that.',
    items: [
      {
        title: 'Local only',
        text: 'The hooks talk to the app over 127.0.0.1 with a random token. Requests from web pages are refused, and approvals are answered inside the app, never over the network.',
      },
      {
        title: 'Your settings, backed up',
        text: 'The installer shows the change before writing, refuses to touch a file it can’t read, saves a timestamped backup and only adds or removes its own entries.',
      },
      {
        title: 'Falls back to the terminal',
        text: 'If the island is closed or you don’t answer in time, Claude Code asks in the terminal exactly as before.',
      },
      {
        title: 'Nothing is collected',
        text: 'No account and no analytics. Prompt text and tool output are dropped before anything reaches the app, and none of it is written to disk.',
      },
      {
        title: 'Open source',
        text: 'Every line is on GitHub under the MIT license, so you can read what it does before you run it.',
      },
    ],
  },

  faq: {
    eyebrow: 'Questions',
    title: 'What people ask first.',
    items: [
      { q: 'Is it free?', a: 'Yes. TheIsland is free and open source under the MIT license.' },
      {
        q: 'Do I need Claude Code?',
        a: 'For the approvals and questions, yes. Music, calendar, the clock and the System tab work on their own.',
      },
      {
        q: 'Windows says it protected my PC. Is it safe?',
        a: 'The installer isn’t code-signed yet, so SmartScreen warns about it. Click More info, then Run anyway. You can check the download against the SHA-256 on the release page, and the source is on GitHub.',
      },
      {
        q: 'Will it slow my PC down?',
        a: 'At rest it uses about 120 MB of memory and close to 0% of the CPU. It doesn’t poll when nothing changes, and nothing animates while it is quiet.',
      },
      { q: 'Does it work on Mac or Linux?', a: 'Not yet. It is built for Windows 11.' },
      {
        q: 'Is it made by Anthropic?',
        a: 'No. TheIsland is an independent product by Archway. It is not affiliated with or endorsed by Anthropic.',
      },
      {
        q: 'How do I uninstall it?',
        a: 'Choose Remove Claude Code hooks in the tray first, then remove TheIsland in Windows Settings > Apps. Your settings stay in %USERPROFILE%\\.theisland until you delete that folder.',
      },
    ],
  },

  feedback: {
    eyebrow: 'Feedback',
    title: 'Found a bug? Have an idea?',
    intro: 'TheIsland gets better from what people run into. Tell us on GitHub, where you can follow the fix too.',
    items: [
      {
        title: 'Report a bug',
        text: 'Something doesn’t work as it should. Tell us what happened and your Windows version.',
        href: `${repo}/issues/new?template=bug_report.md`,
        cta: 'Open a bug report',
      },
      {
        title: 'Suggest a feature',
        text: 'A widget you want, or something that would make answering Claude easier.',
        href: `${repo}/issues/new?template=feature_request.md`,
        cta: 'Share an idea',
      },
    ],
    security: {
      text: 'Found a security problem? Please report it privately instead of opening an issue.',
      href: `${repo}/security/advisories/new`,
      cta: 'Report privately',
    },
  },

  footer: {
    links: [
      { label: 'GitHub', href: repo },
      { label: 'Releases', href: `${repo}/releases` },
      { label: 'License', href: `${repo}/blob/main/LICENSE` },
      { label: 'Security', href: `${repo}/blob/main/SECURITY.md` },
    ],
    disclaimer: 'Claude and Claude Code are trademarks of Anthropic. TheIsland is not affiliated with Anthropic.',
  },
}
