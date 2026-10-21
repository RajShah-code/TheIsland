// Small line icons, hand drawn on a 16 px grid in one style: 1.5 px stroke, round caps and joins,
// no fill (a few dots and the half-filled color filters disc are the exceptions). Sizes are set with
// attributes, not classes, so they work in both the island and the settings window stylesheets.

const dot = (x, y) => <circle cx={x} cy={y} r="0.9" fill="currentColor" stroke="none" />

const bell = <path d="M4 11V7.2a4 4 0 0 1 8 0V11l1.2 1.5H2.8zM6.6 14.5h2.8" />
const moon = <path d="M13.3 9.8A5.6 5.6 0 1 1 6.2 2.7a4.5 4.5 0 0 0 7.1 7.1z" />
const mic = <path d="M8 1.75a2 2 0 0 1 2 2V8a2 2 0 0 1-4 0V3.75a2 2 0 0 1 2-2zM3.75 7.5a4.25 4.25 0 0 0 8.5 0M8 11.75v2.5" />
const speaker = <path d="M2.5 6.2v3.6h2.4L8.2 12.8V3.2L4.9 6.2z" />

const PATHS = {
  wifi: (
    <>
      <path d="M1.8 6.2a8.8 8.8 0 0 1 12.4 0M4 8.6a5.7 5.7 0 0 1 8 0M6.2 11a2.6 2.6 0 0 1 3.6 0" />
      {dot(8, 13.3)}
    </>
  ),
  bluetooth: <path d="M4.5 5.2l7 5.8L8 14V2l3.5 3L4.5 10.8" />,
  airplane: (
    <path d="M8 1.8c.6 0 1 .7 1 1.5V6.2l5 3v1.5L9 9.2v2.9l1.6 1.2v1.2L8 13.8l-2.6.7v-1.2L7 12.1V9.2L2 10.7V9.2l5-3V3.3c0-.8.4-1.5 1-1.5z" />
  ),
  hotspot: (
    <>
      <path d="M5.4 5.4a3.7 3.7 0 0 0 0 5.2M10.6 5.4a3.7 3.7 0 0 1 0 5.2M3.3 3.3a6.6 6.6 0 0 0 0 9.4M12.7 3.3a6.6 6.6 0 0 1 0 9.4" />
      {dot(8, 8)}
    </>
  ),
  leaf: <path d="M3 13c0-6.2 3.6-10 10-10 0 6.4-3.8 10-10 10zM3 13l5.5-5.5" />,
  moon,
  bellOff: (
    <>
      {bell}
      <path d="M2 2l12 12" />
    </>
  ),
  bell,
  accessibility: (
    <>
      <circle cx="8" cy="3" r="1.25" />
      <path d="M3 5.6l5 1 5-1M8 6.6v3.6M8 10.2l-2.4 4M8 10.2l2.4 4" />
    </>
  ),
  share: (
    <>
      <circle cx="12" cy="3.6" r="1.6" />
      <circle cx="4" cy="8" r="1.6" />
      <circle cx="12" cy="12.4" r="1.6" />
      <path d="M5.4 7.2l5.2-2.8M5.4 8.8l5.2 2.8" />
    </>
  ),
  cast: (
    <>
      <path d="M2 6V4.5A1.5 1.5 0 0 1 3.5 3h9A1.5 1.5 0 0 1 14 4.5v7a1.5 1.5 0 0 1-1.5 1.5H9.5M2 8.6A4.4 4.4 0 0 1 6.4 13M2 11a2 2 0 0 1 2 2" />
      {dot(2.2, 13)}
    </>
  ),
  project: (
    <>
      <rect x="1.75" y="2.5" width="12.5" height="8.5" rx="1.5" />
      <path d="M5.5 14h5M8 11v3" />
    </>
  ),
  captions: (
    <>
      <rect x="1.5" y="3" width="13" height="10" rx="2" />
      <path d="M4.5 7.5h3M9.5 7.5h2M4.5 10h5.5M12 10h-.01" />
    </>
  ),
  colorFilters: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 2a6 6 0 0 1 0 12z" fill="currentColor" stroke="none" />
    </>
  ),
  keyboard: (
    <>
      <rect x="1.5" y="4" width="13" height="8.5" rx="1.5" />
      <path d="M4.5 7h.01M7 7h.01M9 7h.01M11.5 7h.01M5.5 9.7h5" />
    </>
  ),
  mic,
  micOff: (
    <>
      {mic}
      <path d="M2.5 2.5l11 11" />
    </>
  ),
  coffee: <path d="M2.5 6.5h8.5v3.2A3.8 3.8 0 0 1 7.2 13.5h-.9A3.8 3.8 0 0 1 2.5 9.7zM11 7.5h.8a1.75 1.75 0 0 1 0 3.5H10.7M5 1.8v2.2M8 1.8v2.2" />,
  scissors: (
    <>
      <circle cx="4.5" cy="12" r="2" />
      <circle cx="11.5" cy="12" r="2" />
      <path d="M5.7 10.4L12 2M10.3 10.4L4 2" />
    </>
  ),
  lock: (
    <>
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5.2 7V5a2.8 2.8 0 0 1 5.6 0v2" />
    </>
  ),
  sleep: <path d="M11.5 10.6A5 5 0 1 1 5.4 4.5a4 4 0 0 0 6.1 6.1zM10 1.8h3.2L10 5.4h3.2" />,
  gear: (
    <>
      <circle cx="8" cy="8" r="1.8" />
      <circle cx="8" cy="8" r="4.3" />
      <path d="M8 1.5v2.2M8 12.3v2.2M1.5 8h2.2M12.3 8h2.2M3.4 3.4L5 5M11 11l1.6 1.6M3.4 12.6L5 11M11 5l1.6-1.6" />
    </>
  ),
  speaker: (
    <>
      {speaker}
      <path d="M10.6 6a2.9 2.9 0 0 1 0 4M12.6 4a5.7 5.7 0 0 1 0 8" />
    </>
  ),
  speakerMuted: (
    <>
      {speaker}
      <path d="M10.5 6.2l3.6 3.6M14.1 6.2l-3.6 3.6" />
    </>
  ),
  sun: (
    <>
      <circle cx="8" cy="8" r="2.7" />
      <path d="M8 1.5v1.3M8 13.2v1.3M1.5 8h1.3M13.2 8h1.3M3.4 3.4l.9.9M11.7 11.7l.9.9M3.4 12.6l.9-.9M11.7 4.3l.9-.9" />
    </>
  ),
  headphones: <path d="M2.5 11V8.5a5.5 5.5 0 0 1 11 0V11M2.5 10h2v4h-.5a1.5 1.5 0 0 1-1.5-1.5zM13.5 10h-2v4h.5a1.5 1.5 0 0 0 1.5-1.5z" />,
  chip: (
    <>
      <rect x="4" y="4" width="8" height="8" rx="1.5" />
      <path d="M6.5 1.8V4M9.5 1.8V4M6.5 12v2.2M9.5 12v2.2M1.8 6.5H4M1.8 9.5H4M12 6.5h2.2M12 9.5h2.2" />
    </>
  ),
  memory: (
    <>
      <rect x="1.5" y="4.5" width="13" height="6" rx="1" />
      <path d="M4.5 10.5v2.5M8 10.5v2.5M11.5 10.5v2.5M4.5 7.5h.01M8 7.5h.01M11.5 7.5h.01" />
    </>
  ),
  gpu: (
    <>
      <rect x="1.5" y="4" width="13" height="7.5" rx="1.5" />
      <circle cx="6" cy="7.75" r="1.8" />
      <path d="M10 6.5h2M10 9h2M3.5 11.5V14" />
    </>
  ),
  disk: (
    <>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <path d="M2 9.5h12M11 11.25h.01" />
    </>
  ),
  network: <path d="M5 2.5v11M5 13.5L2.5 11M11 13.5v-11M11 2.5L13.5 5" />,
  battery: (
    <>
      <rect x="1.5" y="4.5" width="11.5" height="7" rx="1.5" />
      <path d="M14.75 7v2M4 7v2M6.5 7v2" />
    </>
  ),
  chevronRight: <path d="M6 3.5L10.5 8 6 12.5" />,
  chevronDown: <path d="M3.5 6L8 10.5 12.5 6" />,
  check: <path d="M3 8.5l3.2 3L13 4.5" />,
  arrowUpRight: <path d="M5 11l6-6M6 5h5v5" />
}

export function Icon({ name, size = 16, className, strokeWidth = 1.5 }) {
  const p = PATHS[name]
  if (!p) return null
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {p}
    </svg>
  )
}

// The icon for each System tab item (settings-model.mjs SYSTEM_ITEMS), shared with the settings window.
export const SYSTEM_ICONS = {
  cpu: 'chip',
  ram: 'memory',
  gpu: 'gpu',
  disk: 'disk',
  network: 'network',
  battery: 'battery',
  volume: 'speaker',
  brightness: 'sun',
  output: 'headphones',
  wifi: 'wifi',
  bluetooth: 'bluetooth',
  airplane: 'airplane',
  hotspot: 'hotspot',
  energySaver: 'leaf',
  nightLight: 'moon',
  dnd: 'bellOff',
  accessibility: 'accessibility',
  nearby: 'share',
  cast: 'cast',
  project: 'project',
  captions: 'captions',
  colorFilters: 'colorFilters',
  keyboard: 'keyboard',
  mic: 'mic',
  keepAwake: 'coffee',
  screenshot: 'scissors',
  notifications: 'bell',
  lock: 'lock',
  sleep: 'sleep',
  settings: 'gear'
}
