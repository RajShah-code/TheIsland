import { useState } from 'react'
import { formatTime } from '../../format'
import { useIsland, useMinute } from '../../store'

const DAY = 86400000
const month = new Intl.DateTimeFormat('en-US', { month: 'short' })
const letter = new Intl.DateTimeFormat('en-US', { weekday: 'narrow' })

function startOfDay(ms) {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// Days shown in the strip: yesterday to three days ahead.
function stripDays(now) {
  const today = startOfDay(now)
  return [-1, 0, 1, 2, 3].map((n) => {
    const d = new Date(today)
    d.setDate(d.getDate() + n)
    return d.getTime()
  })
}

function eventsOn(events, day) {
  const end = day + DAY
  return events.filter((e) => e.start < end && e.end > day)
}

// In the closed notch: the next timed event if it starts within 30 minutes.
function Compact() {
  const { calendar } = useIsland()
  const now = useMinute()
  const next = calendar.events.find((e) => !e.allDay && e.start > now - 60000 && e.end > now)
  if (!next || next.start - now > 30 * 60000) return null
  const mins = Math.max(0, Math.round((next.start - now) / 60000))
  return (
    <span className="max-w-[120px] truncate text-[12px] text-sky-300">
      {mins === 0 ? 'Now' : `${mins} min`}: {next.title}
    </span>
  )
}

function Panel() {
  const { calendar } = useIsland()
  const now = useMinute()
  const today = startOfDay(now)
  const [picked, setPicked] = useState(null)
  const selected = picked ?? today
  const days = stripDays(now)
  const list = eventsOn(calendar.events, selected).filter((e) => selected !== today || e.end > now)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between">
        <span className="text-[28px] leading-none font-bold">{month.format(selected)}</span>
        <div className="flex gap-0.5">
          {days.map((d) => {
            const isSel = d === selected
            const sunday = new Date(d).getDay() === 0
            const has = eventsOn(calendar.events, d).length > 0
            return (
              <button
                key={d}
                onClick={() => setPicked(d === today ? null : d)}
                className="flex w-8 flex-col items-center rounded-lg py-0.5 transition-colors hover:bg-white/8"
              >
                <span className="text-[10px] font-semibold text-white/35">{letter.format(d)}</span>
                <span
                  className={`text-[17px] leading-tight font-bold tabular-nums ${
                    isSel ? 'text-accent' : d < today ? 'text-white/30' : sunday ? 'text-rose-400/80' : 'text-white/80'
                  }`}
                >
                  {new Date(d).getDate()}
                </span>
                <span className={`mt-0.5 h-1 w-1 rounded-full ${has ? 'bg-accent' : 'bg-transparent'}`} />
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-2.5 min-h-[44px] space-y-1">
        {!calendar.configured ? (
          <p className="text-[11px] leading-snug text-white/45">
            No calendar yet. Add your Google Calendar secret iCal address in Settings.
          </p>
        ) : !calendar.updatedAt && list.length === 0 ? (
          <p className="pt-1 text-center text-xs text-white/40">{calendar.error || 'Loading calendar...'}</p>
        ) : list.length === 0 ? (
          <p className="pt-1 text-center text-xs text-white/40">
            {selected === today ? 'Nothing for today' : 'Nothing this day'}
          </p>
        ) : (
          list.slice(0, 3).map((e) => (
            <div key={e.id} className="flex items-center gap-2">
              <span className="h-3.5 w-0.5 shrink-0 rounded-full bg-accent" />
              <span className="min-w-0 flex-1 truncate text-xs">{e.title}</span>
              <span className="shrink-0 text-[11px] text-white/45 tabular-nums">
                {e.allDay ? 'All day' : e.start <= now ? 'Now' : formatTime(e.start)}
              </span>
            </div>
          ))
        )}
        {calendar.error && <p className="text-[10px] text-amber-300/80">{calendar.error}</p>}
      </div>
    </div>
  )
}

export default { id: 'calendar', name: 'Calendar', width: 260, options: {}, Compact, Panel }
