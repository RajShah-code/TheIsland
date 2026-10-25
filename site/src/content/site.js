// All copy and links for the TheIsland site. Edit text here; no component code needs to change.
// Anything marked TODO is waiting for a final link or wording.

const repo = 'https://github.com/RajShah-code/TheIsland'
const sponsors = 'https://github.com/sponsors/RajShah-code'

export const site = {
  name: 'TheIsland',
  studio: 'Archway',
  // TODO: the Archway site's public URL once it is deployed (used for "by Archway" links).
  studioUrl: '',

  // Public URL of this site once deployed. Used for the canonical link and the Open Graph image.
  url: 'https://rajshah-code.github.io/TheIsland/', // TODO: confirm once hosting is chosen

  seo: {
    title: 'TheIsland: a dynamic island for Windows 11',
    description:
      'A free, open-source dynamic island for Windows 11. Music, your calendar and quick system controls in a notch at the top of your screen, with first-class Claude Code support for developers.',
    // A 1200×630 PNG at public/og-image.png (WhatsApp and LinkedIn don't show SVG previews).
    ogImage: 'og-image.png', // TODO: add the image
  },

  repo,
  releases: `${repo}/releases/latest`,

  nav: [
    { label: 'Features', id: 'features' },
    { label: 'Developers', id: 'developers' },
    { label: 'Privacy', id: 'privacy' },
    { label: 'FAQ', id: 'faq' },
    { label: 'Feedback', id: 'feedback' },
    { label: 'Support', id: 'support' },
  ],

  hero: {
    eyebrow: 'A dynamic island for Windows 11',
    tagline: 'Everything you need, one glance away.',
    statement:
      'TheIsland is a small notch at the top of your screen. It shows what’s playing, what’s next on your calendar and how your PC is doing, and opens the moment you hover it. Developers can answer Claude Code from it too.',
    secondary: { label: 'View on GitHub', href: repo },
  },

  facts: [
    { title: 'One glance', text: 'Music, your next event and quick controls without opening a window.' },
    { title: 'About 120 MB', text: 'Of memory, and close to 0% CPU while nothing is happening.' },
    { title: 'Out of your way', text: 'It stays small when it’s quiet and hides during fullscreen games and videos.' },
    { title: 'Free and private', text: 'No account, no ads and no tracking. Open source on GitHub.' },
  ],

  why: {
    eyebrow: 'Why an island',
    title: 'The little things shouldn’t need a whole window.',
    body: [
      'Checking what’s playing, when your next meeting starts or whether Bluetooth is on usually means opening an app, a flyout or a browser tab. Each one is small, but they add up, and every switch pulls you out of what you were doing.',
      'TheIsland keeps those things in one place at the top of your screen. It stays out of the way when nothing is happening, and opens when you hover it or when something needs you.',
    ],
  },

  everyday: {
    id: 'features',
    eyebrow: 'For every day',
    title: 'The things you check all day, in one place.',
    items: [
      {
        id: 'music',
        lead: true,
        title: 'Music, whatever is playing',
        text: 'Play, pause and skip from the notch, with the song and its cover art. It works with Spotify, a browser tab or any app that shows up in Windows’ media controls, with no account or API key.',
      },
      {
        id: 'calendar',
        title: 'Calendar',
        text: 'Your week from Google Calendar, Monday to Sunday, with each day’s events one hover away.',
      },
      {
        id: 'system',
        title: 'System controls',
        text: 'CPU, memory and battery at a glance, volume and brightness sliders, and quick toggles like Wi-Fi, Bluetooth and Night light.',
      },
      {
        id: 'fullscreen',
        title: 'Out of the way',
        text: 'It hides during fullscreen games and videos. Touch the top edge of the screen to bring it back.',
      },
      {
        id: 'arrange',
        title: 'Yours to arrange',
        text: 'Pick which widgets show and in what order, and choose what the closed notch shows: the time, the date or nothing.',
      },
    ],
  },

  developers: {
    id: 'developers',
    eyebrow: 'For developers',
    title: 'First-class Claude Code support.',
    intro:
      'If you use Claude Code, the island becomes its control panel. It shows what each session is doing and opens when Claude needs you, so you answer without leaving your work.',
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
        text: 'When Claude asks you to choose, you see the question and its options, not raw JSON. One click answers it.',
      },
      {
        id: 'sessions',
        title: 'Every session, live',
        text: 'Each session with its project, its state and the tool it is running, plus the subagents working in the background.',
      },
    ],
  },

  steps: {
    eyebrow: 'How it works',
    title: 'Set up in a minute.',
    items: [
      {
        title: 'Install TheIsland',
        text: 'Run the installer. The island appears at the top of your screen and a small white pill in your tray.',
      },
      {
        title: 'Make it yours',
        text: 'Open Settings from the tray to pick your widgets, connect your calendar and choose what the notch shows.',
      },
      {
        title: 'Using Claude Code? Connect it',
        text: 'Choose Install Claude Code hooks in the tray. You see exactly what changes in your settings, and a backup is saved first.',
      },
    ],
  },

  trust: {
    eyebrow: 'Privacy & safety',
    title: 'Private by default.',
    intro:
      'TheIsland runs on your PC and keeps your data there. And because it can answer Claude Code for you, it is careful about how it does that.',
    items: [
      {
        title: 'Nothing is collected',
        text: 'No account, no ads and no analytics. The only network calls go to your calendar.',
      },
      {
        title: 'Your calendar stays yours',
        text: 'Your calendar address and Google sign-in are encrypted with Windows’ own protection and only used to fetch your events.',
      },
      {
        title: 'Open source',
        text: 'Every line is on GitHub under the MIT license, so you can read what it does before you run it.',
      },
      {
        title: 'Claude Code stays local',
        text: 'The hooks talk to the app over 127.0.0.1 with a random token, and requests from web pages are refused. If the island is closed or you don’t answer, Claude Code asks in the terminal as before.',
      },
      {
        title: 'Your settings, backed up',
        text: 'Connecting Claude Code shows the change before writing, refuses to touch a file it can’t read, saves a timestamped backup and only adds or removes its own entries.',
      },
    ],
  },

  comingSoon: {
    eyebrow: 'On the way',
    title: 'The island keeps growing.',
    intro: 'More widgets are planned. These are next on the list, and you can suggest your own.',
    // Planned, not promised: edit this list as plans change.
    items: [
      { id: 'weather', title: 'Weather', text: 'Today’s forecast and the temperature outside, at a glance.' },
      { id: 'focus', title: 'Focus timer', text: 'A Pomodoro timer that counts down right in the notch.' },
      { id: 'github', title: 'GitHub', text: 'Pull requests, reviews and deploys that need your attention.' },
    ],
    cta: { label: 'Suggest a widget', href: `${repo}/issues/new?template=feature_request.md` },
  },

  faq: {
    eyebrow: 'Questions',
    title: 'What people ask first.',
    items: [
      {
        q: 'Is it free?',
        a: 'Yes. TheIsland is free and open source under the MIT license. No account, no ads, and no paid version. If you’d like to help keep it going, you can sponsor it on GitHub.',
      },
      {
        q: 'What can it show?',
        a: 'What’s playing in any music app, your Google Calendar, the time and date, and system controls such as volume, brightness, Wi-Fi and Bluetooth. Developers can also connect Claude Code.',
      },
      {
        q: 'Do I need Claude Code?',
        a: 'No. Claude Code support is optional, for developers who use it. Everything else works on its own.',
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
        a: 'No. TheIsland is an independent product by Archway. Its Claude Code support is not affiliated with or endorsed by Anthropic.',
      },
      {
        q: 'How do I uninstall it?',
        a: 'If you connected Claude Code, choose Remove Claude Code hooks in the tray first. Then remove TheIsland in Windows Settings > Apps. Your settings stay in %USERPROFILE%\\.theisland until you delete that folder.',
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
        text: 'A widget you want on the island, or something that would make it better.',
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

  support: {
    id: 'support',
    eyebrow: 'Support TheIsland',
    title: 'Free, and it stays that way.',
    intro:
      'TheIsland has no ads, no account and no paid version. If it makes your day a little easier, you can help keep it going.',
    sponsor: {
      title: 'Sponsor on GitHub',
      text: 'Monthly from $3, or a one-time amount you choose. It pays for things like a code-signing certificate, so Windows stops warning people when they install TheIsland, and for time to build new widgets.',
      href: sponsors,
      cta: 'Sponsor on GitHub',
      note: 'Optional, always. Every feature stays free either way.',
    },
    freeTitle: 'Ways to help that cost nothing',
    free: [
      { id: 'star', title: 'Star it on GitHub', text: 'Helps other people find it.', href: repo },
      { id: 'share', title: 'Tell a friend', text: 'Know someone who’d like a dynamic island on Windows? Send them this page.' },
      { id: 'bug', title: 'Report a bug', text: 'Something off? Every report makes it better.', href: `${repo}/issues/new?template=bug_report.md` },
      { id: 'idea', title: 'Suggest a widget', text: 'Tell us what you’d like on the island next.', href: `${repo}/issues/new?template=feature_request.md` },
    ],
  },

  footer: {
    links: [
      { label: 'Sponsor', href: sponsors },
      { label: 'GitHub', href: repo },
      { label: 'Releases', href: `${repo}/releases` },
      { label: 'License', href: `${repo}/blob/main/LICENSE` },
      { label: 'Security', href: `${repo}/blob/main/SECURITY.md` },
    ],
    disclaimer: 'Claude and Claude Code are trademarks of Anthropic. TheIsland is not affiliated with Anthropic.',
  },
}
