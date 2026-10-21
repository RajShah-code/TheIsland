import { useMinute } from '../../store'

const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
const date = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' })

// 12-hour clock, e.g. "3:07" with "PM" set smaller.
function Panel() {
  const now = useMinute()
  const parts = time.formatToParts(now)
  const hm = parts
    .filter((p) => p.type !== 'dayPeriod')
    .map((p) => p.value)
    .join('')
    .trim()
  const ampm = parts.find((p) => p.type === 'dayPeriod')?.value
  return (
    <div className="flex h-full flex-col justify-center">
      <div className="flex items-baseline gap-1.5">
        <span className="text-[40px] leading-none font-semibold tracking-tight tabular-nums">{hm}</span>
        <span className="text-sm font-semibold text-white/60">{ampm}</span>
      </div>
      <span className="mt-2 text-xs text-white/50">{date.format(now)}</span>
    </div>
  )
}

export default {
  id: 'clock',
  name: 'Clock',
  width: 150,
  // Declared now so the future settings UI can render them; not used yet.
  options: { format: { type: 'select', values: ['12h'], default: '12h' } },
  Panel
}
