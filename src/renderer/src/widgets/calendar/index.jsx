import { formatTime, relativeDay } from '../../format'
import { useIsland, useMinute } from '../../store'

function upcoming(events, now) {
  return events.filter((e) => e.end > now)
}

function when(e, now) {
  if (e.start <= now) return 'Now'
  const day = relativeDay(e.start, now)
  if (e.allDay) return day + ', all day'
  return (day === 'Today' ? '' : day + ' ') + formatTime(e.start)
}

// In the pill: the next timed event if it starts within 30 minutes.
function Compact() {
  const { calendar } = useIsland()
  const now = useMinute()
  const next = upcoming(calendar.events, now).find((e) => !e.allDay)
  if (!next || next.start - now > 30 * 60000) return null
  const mins = Math.max(0, Math.round((next.start - now) / 60000))
  return (
    <span className="max-w-[140px] truncate text-[12px] text-sky-300">
      {mins === 0 ? 'Now' : `In ${mins} min`}: {next.title}
    </span>
  )
}

function Panel() {
  const { calendar } = useIsland()
  const now = useMinute()
  if (!calendar.configured) {
    return (
      <p className="text-xs text-white/50">
        No calendar yet. Copy your Google Calendar secret iCal address, then use the tray menu.
      </p>
    )
  }
  const events = upcoming(calendar.events, now).slice(0, 4)
  return (
    <div className="space-y-1.5">
      {calendar.error && <p className="text-[11px] text-amber-300">{calendar.error}</p>}
      {events.length === 0 && <p className="text-xs text-white/50">Nothing in the next 7 days</p>}
      {events.map((e) => (
        <div key={e.id} className="flex items-baseline gap-2">
          <span className="w-24 shrink-0 text-[11px] tabular-nums text-sky-300">{when(e, now)}</span>
          <span className="truncate text-xs">{e.title}</span>
        </div>
      ))}
    </div>
  )
}

export default { id: 'calendar', name: 'Calendar', options: {}, Compact, Panel }
