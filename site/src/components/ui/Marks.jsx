// Brand marks.
//
// ArchwayMark is a PLACEHOLDER, copied from the Archway site, until Archway has its final logo.
// It is only used here, so swapping in the real logo is a change to this one component.
export function ArchwayMark({ className = 'size-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M5 21V11a7 7 0 0 1 14 0v10" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
      <path d="M9.5 21v-9.5a2.5 2.5 0 0 1 5 0V21" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
    </svg>
  )
}

// TheIsland: the white pill from the tray icon on a dark tile (same as the app icon).
export function IslandMark({ className = 'size-6' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="15" fill="#1c1c1c" />
      <rect x="0.5" y="0.5" width="63" height="63" rx="14.5" fill="none" stroke="rgb(255 255 255 / 0.12)" />
      <rect x="12.5" y="24.5" width="39" height="15" rx="7.5" fill="#f5f5f5" />
    </svg>
  )
}
