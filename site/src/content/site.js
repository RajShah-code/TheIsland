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

  // A 1200×630 PNG at public/og-image.png for link previews (WhatsApp and LinkedIn don't show SVG).
  ogImage: 'og-image.png', // TODO: add the image

  // Every page of the site: its HTML file, and the title and description shown in the browser tab, in search
  // results and in link previews. The key matches <body data-page="..."> in that file.
  pages: {
    index: {
      file: '',
      title: 'TheIsland: a dynamic island for Windows 11',
      description:
        'A free, open-source dynamic island for Windows 11. Music, your calendar and quick system controls in a notch at the top of your screen, with first-class Claude Code support for developers.',
    },
    features: {
      file: 'features.html',
      title: 'Features · TheIsland',
      description: 'Music, calendar, system controls and Claude Code support: everything TheIsland can do, and what’s coming next.',
    },
    download: {
      file: 'download.html',
      title: 'Download TheIsland for Windows 11',
      description: 'Download TheIsland, a free dynamic island for Windows 11. Install steps, requirements and what’s new in each version.',
    },
    help: {
      file: 'help.html',
      title: 'Help · TheIsland',
      description: 'Answers and guides for TheIsland: setting up your calendar, connecting Claude Code, uninstalling, and how to report a bug.',
    },
    support: {
      file: 'support.html',
      title: 'Support us · TheIsland',
      description: 'TheIsland is free and stays free. Sponsor it, or help in ways that cost nothing.',
    },
    privacy: {
      file: 'privacy.html',
      title: 'Privacy policy · TheIsland',
      description: 'What TheIsland stores, what it connects to and why. No account, no ads, no analytics.',
    },
    security: {
      file: 'security.html',
      title: 'Security · TheIsland',
      description: 'How TheIsland keeps your Claude Code approvals and your data safe, and how to report a security problem.',
    },
    license: {
      file: 'license.html',
      title: 'License · TheIsland',
      description: 'TheIsland is free and open source under the MIT license.',
    },
    terms: {
      file: 'terms.html',
      title: 'Terms and conditions · TheIsland',
      description: 'The terms for using TheIsland, this website and the optional ways to support it.',
    },
    refunds: {
      file: 'refunds.html',
      title: 'Refunds and cancellations · TheIsland',
      description: 'How refunds and cancellations work for voluntary contributions to TheIsland.',
    },
    delivery: {
      file: 'delivery.html',
      title: 'Shipping and delivery · TheIsland',
      description: 'TheIsland is a free digital download. Nothing is shipped, and contributions unlock nothing.',
    },
    feedback: {
      file: 'feedback.html',
      title: 'Send feedback · TheIsland',
      description: 'Report a bug or suggest a feature for TheIsland. No account needed.',
    },
    contact: {
      file: 'contact.html',
      title: 'Contact us · TheIsland',
      description: 'How to reach Archway, the maker of TheIsland, about the app, a payment or anything else.',
    },
  },

  repo,
  releases: `${repo}/releases/latest`,
  store: 'https://apps.microsoft.com/detail/9PFH56G16HFB',
  releasesApi: 'https://api.github.com/repos/RajShah-code/TheIsland/releases',

  // The main menu. `page` is a key of `pages` above.
  nav: [
    { label: 'Features', page: 'features' },
    { label: 'Get Help', page: 'help' },
    { label: 'Support Us', page: 'support' },
  ],

  // Home page sections that lead to the other pages.
  home: {
    highlights: {
      eyebrow: 'What it does',
      title: 'Made for everyone, built for developers too.',
      items: [
        {
          id: 'everyday',
          title: 'For every day',
          text: 'What’s playing, what’s next on your calendar and quick system controls, without opening a window.',
          points: ['Music from any player', 'Your Google Calendar week', 'Volume, brightness, Wi-Fi and more', 'Hides during fullscreen'],
          link: { label: 'See every feature', href: 'features' },
        },
        {
          id: 'developers',
          title: 'For developers',
          text: 'First-class Claude Code support: approve commands and answer questions without leaving your work.',
          points: ['Readable approvals, no “Always allow”', 'Questions with real buttons', 'Every session and subagent, live', 'Stays on your PC'],
          link: { label: 'Claude Code support', href: 'features#developers' },
        },
      ],
    },
    privacy: {
      eyebrow: 'Privacy & safety',
      title: 'Private by default.',
      points: [
        { title: 'Nothing is collected', text: 'No account, no ads and no analytics.' },
        { title: 'Stays on your PC', text: 'Your data and your Claude Code approvals never leave it.' },
        { title: 'Open source', text: 'Read every line before you run it.' },
      ],
      links: [
        { label: 'Privacy policy', href: 'privacy' },
        { label: 'How it stays safe', href: 'security' },
      ],
    },
    cta: {
      title: 'Give your Windows an island.',
      text: 'Free, open source and about a minute to set up.',
    },
  },

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

  featuresPage: {
    eyebrow: 'Features',
    title: 'Everything the island can do.',
    intro: 'Everyday widgets for everyone, and first-class Claude Code support for developers. More is on the way.',
  },

  everyday: {
    id: 'everyday',
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

  download: {
    eyebrow: 'Download',
    title: 'Get TheIsland for Windows.',
    intro: 'Free and open source. Get it from the Microsoft Store and it installs in a click and keeps itself up to date. Node.js or other tools are not needed.',
    requirements: ['Windows 11, 64-bit', 'About 370 MB of disk space', 'Claude Code only if you want its support (optional)'],
    store: 'Installs with no warnings, and the Store keeps it up to date.',
    installer: {
      title: 'Can’t use the Microsoft Store?',
      text: 'On PCs where the Store is blocked, use the installer from GitHub instead. It tells you when a new version is out. Already installed it this way? Update with the installer too, so you don’t end up with two copies.',
      button: 'Download the installer',
    },
    smartscreen: {
      title: 'If Windows says it “protected your PC”',
      text: 'This only happens with the installer from GitHub, which isn’t code-signed yet. Click More info, then Run anyway. You can compare the file with its SHA-256 checksum, and every line of the source is on GitHub. The Microsoft Store version doesn’t show this warning.',
    },
    changelog: { eyebrow: 'What’s new', title: 'Release notes', empty: 'Release notes are loading from GitHub.' },
  },

  steps: {
    eyebrow: 'How it works',
    title: 'Set up in a minute.',
    items: [
      {
        title: 'Install TheIsland',
        text: 'Get it from the Microsoft Store. The island appears at the top of your screen and a small white pill in your tray.',
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
    eyebrow: 'How it stays safe',
    title: 'Built to be trusted with your terminal.',
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

  help: {
    eyebrow: 'Help',
    title: 'How can we help?',
    intro: 'Quick answers, step-by-step guides, and where to go if something isn’t working.',
    guidesTitle: 'Guides',
    guides: [
      {
        id: 'calendar-ical',
        title: 'Show your Google Calendar (the quick way)',
        steps: [
          'In Google Calendar on the web, open Settings and pick your calendar on the left.',
          'Copy Secret address in iCal format.',
          'In TheIsland, open Settings (the gear in the open island, or the tray icon) and go to Calendar.',
          'Paste the address and press Save. Your events appear within a minute and refresh every 15 minutes.',
        ],
        note: 'Google only updates this address every few hours. For changes within seconds, use Google sign-in below.',
      },
      {
        id: 'calendar-google',
        title: 'Show your Google Calendar with Google sign-in',
        steps: [
          'In the Google Cloud Console, create a project and enable the Google Calendar API.',
          'Set up the OAuth consent screen as External and add yourself as a test user (or publish it, so the sign-in doesn’t expire every 7 days).',
          'Create an OAuth client of type Desktop app.',
          'In TheIsland, open Settings > Calendar, paste the client ID and secret, and press Sign in with Google.',
        ],
        note: 'TheIsland only asks for read-only access and shows the calendars ticked in Google Calendar.',
      },
      {
        id: 'claude-code',
        title: 'Connect Claude Code',
        steps: [
          'If Claude Code is on your PC, TheIsland offers to connect it the first time it starts. Otherwise open Settings > Claude Code and press Install..., or choose Install Claude Code hooks... from the white pill in your tray.',
          'Read what it adds to your Claude Code settings. A backup is saved before anything is written.',
          'Press Install. Start a new Claude Code session, and the next time it needs permission or asks a question, the island opens.',
        ],
        note: 'To disconnect, press Remove... in Settings > Claude Code or choose Remove Claude Code hooks... in the tray. Only TheIsland’s own entries are removed.',
      },
      {
        id: 'customize',
        title: 'Make the island yours',
        steps: [
          'Open Settings from the tray or the gear in the open island.',
          'Turn widgets on or off and drag them into the order you like.',
          'Choose what the closed notch shows (the time, the date or nothing) and which system controls appear.',
        ],
      },
      {
        id: 'uninstall',
        title: 'Uninstall TheIsland',
        steps: [
          'If you connected Claude Code, choose Remove Claude Code hooks... in the tray first.',
          'Open Windows Settings > Apps > Installed apps, find TheIsland and choose Uninstall.',
          'Your settings stay in %USERPROFILE%\\.theisland. Delete that folder to remove them too.',
        ],
      },
    ],
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
        a: 'That only happens with the installer from GitHub, which isn’t code-signed yet. Click More info, then Run anyway. You can check the download against the SHA-256 on the release page, and the source is on GitHub. The Microsoft Store version installs without the warning.',
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
    intro: 'TheIsland gets better from what people run into. Send it from the form, no account needed, or open an issue on GitHub to follow the fix.',
    items: [
      {
        title: 'Report a bug',
        text: 'Something doesn’t work as it should. Tell us what happened and your Windows version.',
        href: 'feedback?kind=bug',
        cta: 'Report a bug',
      },
      {
        title: 'Suggest a feature',
        text: 'A widget you want on the island, or something that would make it better.',
        href: 'feedback?kind=idea',
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
    eyebrow: 'Support us',
    title: 'Free, and it stays that way.',
    intro:
      'TheIsland has no ads, no account and no paid version. If it makes your day a little easier, you can help keep it going.',
    sponsor: {
      title: 'Sponsor on GitHub',
      text: 'Monthly from $3, or a one-time amount you choose. It pays for the time to build new widgets and fix bugs, and helps keep TheIsland free, with no ads and no tracking.',
      href: sponsors,
      cta: 'Sponsor on GitHub',
      note: 'Optional, always. Every feature stays free either way.',
    },
    // Ways to give without a GitHub account. Leave `href` (or `upi`) empty and the option stays hidden.
    other: {
      title: 'In India? Pay without GitHub.',
      text: 'Give any amount with UPI, a card or net banking. No sign-up needed. From outside India, please use GitHub Sponsors for now.',
      options: [
        { id: 'upi', title: 'Pay with UPI', text: 'Google Pay, PhonePe, Paytm or any UPI app.', upi: '' }, // TODO: your UPI ID, e.g. 'name@okhdfcbank'
        // Razorpay Payment Page: Indian payments only until international payments (or PayPal) are switched on.
        { id: 'razorpay', title: 'UPI, card or net banking', text: 'A one-time amount you choose, through Razorpay. India only for now.', href: 'https://rzp.io/rzp/theisland' },
      ],
    },
    // The policies that apply to a payment, under the ways to give.
    legal: {
      text: 'Before you pay, see the',
      links: [
        { label: 'Terms', href: 'terms' },
        { label: 'Refunds', href: 'refunds' },
        { label: 'Shipping and delivery', href: 'delivery' },
        { label: 'Privacy policy', href: 'privacy' },
        { label: 'Contact us', href: 'contact' },
      ],
    },
    freeTitle: 'Ways to help that cost nothing',
    free: [
      { id: 'star', title: 'Star it on GitHub', text: 'Helps other people find it.', href: repo },
      { id: 'share', title: 'Tell a friend', text: 'Know someone who’d like a dynamic island on Windows? Send them this page.' },
      { id: 'bug', title: 'Report a bug', text: 'Something off? Every report makes it better.', href: 'feedback?kind=bug' },
      { id: 'idea', title: 'Suggest a widget', text: 'Tell us what you’d like on the island next.', href: 'feedback?kind=idea' },
    ],
  },

  // The privacy policy page (privacy.html). Keep it in step with what the app actually does.
  privacy: {
    title: 'Privacy policy',
    updated: '27 October 2026',
    intro:
      'TheIsland runs on your PC. It has no account, no ads and no analytics, and Archway receives no data from the app. This page explains what it stores, what it connects to and why.',
    sections: [
      {
        title: 'What stays on your computer',
        items: [
          'Your settings are kept in %USERPROFILE%\\.theisland on your PC.',
          'Your calendar address and your Google sign-in are encrypted with Windows’ own data protection (DPAPI) and never shown to anyone.',
          'A small log file (at most 256 KB) helps with troubleshooting. It never contains prompt text, commands, calendar events or web addresses.',
          'Music, system information (CPU, memory, battery, volume and so on) and the clock are read from Windows on your PC and are not sent anywhere.',
        ],
      },
      {
        title: 'What TheIsland connects to',
        items: [
          'Only your calendar, and only if you set one up. With an iCal address, TheIsland downloads that address. With Google sign-in, it talks to Google’s sign-in and Calendar services with read-only access to your calendars. Google’s privacy policy applies to that connection.',
          'Updates, in the version from GitHub: about twice a day TheIsland asks GitHub which release is the newest, and tells you when there is a newer one. It sends nothing about you or your PC beyond what any web request carries (GitHub sees your IP address), and it downloads nothing on its own. You can turn this off in Settings > About. The Microsoft Store version leaves updates to the Store.',
          'Nothing else. TheIsland does not send usage statistics and does not contact Archway.',
        ],
      },
      {
        title: 'Claude Code (optional)',
        items: [
          'If you connect Claude Code, its hooks send events to TheIsland over 127.0.0.1, a connection that never leaves your PC, protected by a random token.',
          'Prompt text and tool output are removed before anything reaches TheIsland, and approvals are answered inside the app.',
          'TheIsland does not send any of this off your PC. Claude Code itself works with Anthropic under Anthropic’s own terms, which TheIsland does not change.',
        ],
      },
      {
        title: 'This website',
        items: [
          'The site has no analytics, no tracking and no cookies. Its fonts are served from the site itself.',
          'It is hosted on GitHub Pages, and GitHub may keep standard server logs such as IP addresses (see GitHub’s privacy statement).',
          'The site asks GitHub for the latest release to show its version and the installer link, so your browser contacts GitHub when a page loads.',
          'The feedback form sends what you type (kind, title, message, and your email if you give one) plus the app version, Windows build and whether it is the Store version, through Web3Forms to Archway’s inbox. It is used only to read and answer your feedback, and never sold or used for marketing.',
        ],
      },
      {
        title: 'Downloads, donations and stores',
        items: [
          'Installers come from GitHub Releases, or from the Microsoft Store under Microsoft’s privacy statement.',
          'Sponsorships are handled by GitHub Sponsors and Stripe. Archway only sees what GitHub shows a sponsored developer, such as your GitHub username.',
          'One-time contributions by UPI, card, net banking or wallet are processed by Razorpay, under its own privacy policy. Razorpay collects the payment details needed to process the payment and send you a receipt.',
          'From such a payment Archway receives the amount, the date, the payment status and the contact details you enter on the payment page (such as your name, email address and phone number). Archway never sees your full card number, CVV, UPI PIN or bank login.',
          'These records are kept only as long as Indian tax and accounting law requires, used only to handle that payment (receipts, refunds and questions about it) and never sold or used for marketing.',
        ],
      },
      {
        title: 'Changes and contact',
        items: [
          'If this policy changes, this page will be updated and the date at the top will change.',
          'Questions? Open an issue on GitHub. For a security or privacy problem, please use the private report link instead.',
        ],
      },
    ],
    links: [
      { label: 'Contact us', href: 'contact' },
      { label: 'Open an issue', href: `${repo}/issues` },
      { label: 'Report a problem privately', href: `${repo}/security/advisories/new` },
      { label: 'GitHub privacy statement', href: 'https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement' },
      { label: 'Google privacy policy', href: 'https://policies.google.com/privacy' },
      { label: 'Razorpay privacy policy', href: 'https://razorpay.com/privacy/' },
      { label: 'Web3Forms privacy policy', href: 'https://web3forms.com/privacy' },
    ],
  },

  // The terms page (terms.html). Payment providers ask for this, the refund, delivery and contact pages.
  // These four are linked only from the legal pages and the Support page, never from Home, Features,
  // Download or Help (the footer's Legal column has `pages`).
  terms: {
    title: 'Terms and conditions',
    updated: '26 October 2026',
    intro:
      'These terms cover TheIsland, this website and the optional ways to support it. TheIsland is made by Archway, run by Raj Shah in India. By using the app or the site, you agree to them.',
    sections: [
      {
        title: 'The app',
        items: [
          'TheIsland is free software under the MIT license. You may use, copy, change and share it as that license allows; the License page has the full text.',
          'It is provided as is, without warranty of any kind. Archway is not liable for any loss or damage that comes from using it, as far as the law allows.',
          'Features that connect to other services (Google Calendar, Claude Code, Microsoft Store, GitHub) are also subject to those services’ own terms.',
        ],
      },
      {
        title: 'Supporting TheIsland',
        items: [
          'Contributions are voluntary. They are not a purchase: every feature of TheIsland stays free, and paying unlocks nothing and buys no support contract or service.',
          'You choose the amount, at least ₹50. One-time payments are in Indian rupees and, for now, accepted only from Indian cards, bank accounts and UPI. From outside India, please use GitHub Sponsors.',
          'One-time payments are processed by Razorpay. Sponsorships go through GitHub Sponsors. Each applies its own terms to the payment.',
          'Contributions are not charitable donations, and no tax deduction (such as under section 80G) can be claimed for them.',
          'Refunds and cancellations are described on the Refunds page.',
        ],
      },
      {
        title: 'This website',
        items: [
          'The text and images on this site belong to Archway unless stated otherwise. The app’s source code is under the MIT license.',
          'Please don’t misuse the site, for example by trying to break it or to make payments with a card that isn’t yours.',
          'Links to other sites are there for convenience. Archway is not responsible for their content.',
        ],
      },
      {
        title: 'Law and changes',
        items: [
          'These terms are governed by the laws of India, and the courts of India have jurisdiction over any dispute about them.',
          'If these terms change, this page will be updated and the date at the top will change. Payments already made stay under the terms that applied when they were made.',
          'Questions about these terms? See the Contact page.',
        ],
      },
    ],
    links: [
      { label: 'Refunds and cancellations', href: 'refunds' },
      { label: 'Privacy policy', href: 'privacy' },
      { label: 'License', href: 'license' },
      { label: 'Contact us', href: 'contact' },
    ],
  },

  // The refund and cancellation policy (refunds.html).
  refunds: {
    title: 'Refunds and cancellations',
    updated: '26 October 2026',
    intro:
      'TheIsland is free, so nobody has to pay for anything. Contributions are voluntary gifts toward its development, which is why they are normally not refunded. Mistakes happen, though, and we will put them right.',
    sections: [
      {
        title: 'When we refund',
        items: [
          'A payment made by mistake, such as a wrong amount or the same payment twice.',
          'A payment you did not make or agree to, such as one made with your card without your permission.',
          'A payment taken from your account that failed or did not complete. Razorpay usually returns these on its own within 5 to 7 business days; tell us if it doesn’t.',
        ],
      },
      {
        title: 'How to ask',
        items: [
          'Write to us within 7 days of the payment, using the email on the Contact page. Include the payment ID from your receipt (it starts with "pay_"), the date and the amount.',
          'We reply within 3 business days. An approved refund is sent back to the card, account or app you paid from, never anywhere else.',
          'Razorpay processes the refund, and it usually reaches you within 5 to 7 business days after approval, depending on your bank.',
          'The full amount you paid is refunded.',
        ],
      },
      {
        title: 'Cancellations',
        items: [
          'One-time contributions are not recurring, so there is nothing to cancel after paying.',
          'A monthly sponsorship through GitHub Sponsors can be cancelled at any time in your GitHub account, under Settings > Billing and licensing. It stops before the next payment, and earlier payments are not refunded except as described above.',
          'Since contributions buy nothing, no order or delivery needs cancelling.',
        ],
      },
    ],
    links: [
      { label: 'Contact us', href: 'contact' },
      { label: 'Terms and conditions', href: 'terms' },
      { label: 'GitHub Sponsors: cancelling', href: 'https://docs.github.com/sponsors/sponsoring-open-source-contributors/managing-your-sponsorship' },
    ],
  },

  // The shipping and delivery policy (delivery.html).
  delivery: {
    title: 'Shipping and delivery',
    updated: '27 October 2026',
    intro:
      'TheIsland is software you download, and contributions to it are gifts that unlock nothing. Nothing physical is ever shipped.',
    sections: [
      {
        title: 'The app',
        items: [
          'TheIsland is free. You can get it any time from the Microsoft Store, or download the installer from GitHub Releases through the Download page.',
          'The download starts right away in your browser. There is no shipping, no shipping charge and no delivery address needed.',
        ],
      },
      {
        title: 'Contributions',
        items: [
          'A contribution does not unlock or deliver anything, digital or physical. The app is the same whether you pay or not.',
          'Right after a successful payment, Razorpay emails a receipt to the address you entered. If it hasn’t arrived within an hour, check your spam folder, then write to us with the payment details.',
          'One-time payments are accepted from India only for now; from elsewhere, GitHub Sponsors works. There are no delivery restrictions, because nothing is delivered.',
        ],
      },
    ],
    links: [
      { label: 'Download', href: 'download' },
      { label: 'Refunds and cancellations', href: 'refunds' },
      { label: 'Contact us', href: 'contact' },
    ],
  },

  // The feedback form (feedback.html). The app's Settings > About links here with ?kind=bug|idea and its
  // version (v), Windows build (os) and store=1 for the Microsoft Store build.
  feedbackPage: {
    eyebrow: 'Feedback',
    title: 'Tell us what to fix or build next.',
    intro: 'Report a bug or suggest a feature. No account needed. Every message is read.',
    // Web3Forms access key (web3forms.com). It is public by design: it only lets a form email the owner.
    // While it is empty the form opens an email to `email` instead.
    accessKey: '', // TODO: create a key at web3forms.com for shahrajshahraj6@gmail.com
    endpoint: 'https://api.web3forms.com/submit',
    email: 'shahrajshahraj6@gmail.com',
    kinds: [
      { value: 'bug', label: 'Bug', placeholder: 'What happened, and what did you expect? Steps to make it happen again help a lot.' },
      { value: 'idea', label: 'Idea', placeholder: 'What would you like the island to do, and when would you use it?' },
      { value: 'other', label: 'Other', placeholder: 'What’s on your mind?' },
    ],
    note: 'We only use your email to reply. The message and the app version are sent through Web3Forms to our inbox.',
    noteEmail: 'Opens your email app with the message and the app version filled in.',
    github: { text: 'Prefer to follow the fix in public?', label: 'Open an issue on GitHub', href: `${repo}/issues/new/choose` },
    sent: { title: 'Thanks, it’s on its way.', text: 'We read every message. If you left an email, we’ll reply there.' },
    failed: 'It didn’t send. Check your connection and try again, or email us instead.',
  },

  // The contact page (contact.html). Only the details filled in are shown.
  contact: {
    title: 'Contact us',
    updated: '26 October 2026',
    intro:
      'Questions about TheIsland, a payment or these policies? Get in touch. We usually reply within 3 business days.',
    operator: 'Archway (Raj Shah)',
    email: 'shahrajshahraj6@gmail.com',
    phone: '', // optional; left out on purpose
    address: 'Ahmedabad, Gujarat\nIndia',
    sections: [
      {
        title: 'Other ways to reach us',
        items: [
          'Bugs and feature ideas: use the feedback form, or open an issue on GitHub so others can follow along.',
          'Security or privacy problems: please report them privately on GitHub instead of in a public issue.',
          'Payments and refunds: write to the email above with the payment ID from your receipt.',
        ],
      },
    ],
    links: [
      { label: 'Send feedback', href: 'feedback' },
      { label: 'Open an issue', href: `${repo}/issues` },
      { label: 'Report a problem privately', href: `${repo}/security/advisories/new` },
      { label: 'Get Help', href: 'help' },
    ],
  },

  security: {
    eyebrow: 'Security',
    title: 'Security',
    intro:
      'TheIsland can answer Claude Code permission prompts, so security matters more here than in most widgets. This is how it protects you, and how to tell us about a problem.',
    reportTitle: 'Found a security problem?',
    reportText:
      'Please don’t open a public issue. Report it privately on GitHub instead: say what an attacker could do, the steps to reproduce it, and your TheIsland and Windows versions. You’ll get a reply as soon as possible, and credit in the release notes if you want it.',
    report: { label: 'Report privately', href: `${repo}/security/advisories/new` },
    countsTitle: 'What counts as a security problem',
    counts: [
      'Any way for another program, a web page or another user to send or answer an approval.',
      'The connection accepting a request without its token, or listening on anything other than 127.0.0.1.',
      'The Claude Code installer losing or damaging your Claude Code settings.',
      'An approval card that shows something different from what Claude Code actually runs.',
      'Prompt text, commands, tokens or calendar addresses being written to disk or sent anywhere.',
    ],
  },

  license: {
    eyebrow: 'License',
    title: 'MIT License',
    intro: 'TheIsland is free and open source. In short, you can use, copy, change and share it, as long as the copyright notice stays with it.',
    summary: [
      { title: 'You can', items: ['Use it, at home or at work', 'Read and change the code', 'Share it, changed or not'] },
      { title: 'You must', items: ['Keep the copyright and license notice in copies'] },
      { title: 'It comes with', items: ['No warranty: it is provided as is'] },
    ],
    fullTitle: 'Full license text',
    text: `MIT License

Copyright (c) 2026 Raj Shah

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`,
    thirdParty:
      'TheIsland is built on other open-source projects, such as Electron, React and Tailwind CSS, each under its own license.',
  },

  footer: {
    columns: [
      {
        title: 'Product',
        links: [
          { label: 'Features', href: 'features' },
          { label: 'Download', href: 'download' },
          { label: 'Get Help', href: 'help' },
          { label: 'Support Us', href: 'support' },
        ],
      },
      {
        title: 'Trust',
        links: [
          { label: 'Privacy policy', href: 'privacy' },
          { label: 'Security', href: 'security' },
          { label: 'License', href: 'license' },
        ],
      },
      {
        title: 'Legal',
        // Shown only on these pages.
        pages: ['support', 'privacy', 'security', 'license', 'terms', 'refunds', 'delivery', 'contact'],
        links: [
          { label: 'Terms', href: 'terms' },
          { label: 'Refunds', href: 'refunds' },
          { label: 'Shipping and delivery', href: 'delivery' },
          { label: 'Contact us', href: 'contact' },
        ],
      },
      {
        title: 'Open source',
        links: [
          { label: 'Source code', href: repo, external: true },
          { label: 'Send feedback', href: 'feedback' },
          { label: 'Become a Sponsor', href: sponsors, external: true },
        ],
      },
    ],
    disclaimer: 'Claude and Claude Code are trademarks of Anthropic. TheIsland is not affiliated with Anthropic.',
  },
}
