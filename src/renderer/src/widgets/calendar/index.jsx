import { useEffect, useState } from 'react'
import { addDays, startOfDay, startOfWeek } from '../../../../shared/weeks.mjs'
import { formatTime } from '../../format'
import { useIsland, useMinute } from '../../store'

const month = new Intl.DateTimeFormat('en-US', { month: 'short' })
const monthYear = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' })
const letter = new Intl.DateTimeFormat('en-US', { weekday: 'narrow' })
const dayLabel = new Intl.DateTimeFormat('en-US', { weekday: 'short', day: 'numeric', month: 'short' })

function eventsOn(events, day) {
  const end = addDays(day, 1)
  return events.filter((e) => e.start < end && e.end > day)
}

// Events of the week starting at `start`. The current week and the two after it come with the
// pushed state; any other week is asked for, and asked again after each refresh of the calendar.
function useWeekEvents(calendar, start) {
  const inWindow = start >= calendar.from && addDays(start, 7) <= calendar.to
  const [loaded, setLoaded] = useState({ start: null, events: [] })
  useEffect(() => {
    if (inWindow || !calendar.configured) return
    let live = true
    window.island.calendarWeek(start).then((events) => {
      if (live) setLoaded((cur) => (events ? { start, events } : cur.start === start ? cur : { start, events: [], failed: true }))
    })
    return () => {
      live = false
    }
  }, [start, inWindow, calendar.configured, calendar.updatedAt, calendar.source])
  if (inWindow) return { events: calendar.events, loading: false }
  if (loaded.start !== start) return { events: [], loading: !loaded.failed }
  return { events: loaded.events, loading: false }
}

function Arrow({ dir, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-6 w-6 items-center justify-center rounded-md text-white/55 transition-colors hover:bg-white/8 hover:text-white"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={dir < 0 ? 'M7.5 2.5 4 6l3.5 3.5' : 'M4.5 2.5 8 6 4.5 9.5'} />
      </svg>
    </button>
  )
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
  const thisWeek = startOfWeek(now)
  // Weeks away from this one (negative is the past) and the picked day, if any.
  const [offset, setOffset] = useState(0)
  const [picked, setPicked] = useState(null)
  const weekStart = addDays(thisWeek, offset * 7)
  const days = [0, 1, 2, 3, 4, 5, 6].map((n) => addDays(weekStart, n))
  const selected = picked != null && days.includes(picked) ? picked : offset === 0 ? today : weekStart
  const { events, loading } = useWeekEvents(calendar, weekStart)
  const list = eventsOn(events, selected).filter((e) => selected !== today || e.end > now)
  const go = (n) => {
    setOffset(n)
    setPicked(null)
  }
  const sameYear = new Date(selected).getFullYear() === new Date(now).getFullYear()

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => go(0)}
          title={offset === 0 ? undefined : 'Back to this week'}
          className="text-[22px] leading-none font-bold"
        >
          {(sameYear ? month : monthYear).format(selected)}
        </button>
        <div className="flex items-center gap-0.5">
          {offset !== 0 && (
            <button
              type="button"
              onClick={() => go(0)}
              className="mr-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-accent transition-colors hover:bg-white/8"
            >
              Today
            </button>
          )}
          <Arrow dir={-1} label="Previous week" onClick={() => go(offset - 1)} />
          <Arrow dir={1} label="Next week" onClick={() => go(offset + 1)} />
        </div>
      </div>

      <div className="mt-1.5 flex justify-between">
        {days.map((d) => {
          const isSel = d === selected
          const isToday = d === today
          const sunday = new Date(d).getDay() === 0
          const has = eventsOn(events, d).length > 0
          // Like the Mac's Calendar: today is a filled accent circle, the picked day a grey one.
          const look = isToday
            ? 'bg-accent text-white'
            : isSel
              ? 'bg-white/[0.16] text-white'
              : d < today
                ? 'text-white/30'
                : sunday
                  ? 'text-rose-400/80'
                  : 'text-white/80'
          return (
            <button
              key={d}
              onClick={() => setPicked(d)}
              aria-label={dayLabel.format(d)}
              aria-current={isToday ? 'date' : undefined}
              aria-pressed={isSel}
              className="group flex w-8 flex-col items-center rounded-lg py-0.5"
            >
              <span className="text-[10px] font-semibold text-white/35">{letter.format(d)}</span>
              <span
                className={`grid h-6 w-6 place-items-center rounded-full text-[14px] font-bold tabular-nums ${look} ${
                  isToday || isSel ? '' : 'group-hover:bg-white/[0.08]'
                }`}
              >
                {new Date(d).getDate()}
              </span>
              <span className={`mt-0.5 h-1 w-1 rounded-full ${has ? 'bg-accent' : 'bg-transparent'}`} />
            </button>
          )
        })}
      </div>

      <div className="mt-2 min-h-[44px] space-y-1">
        {!calendar.configured ? (
          <p className="text-[11px] leading-snug text-white/45">
            No calendar yet. Sign in with Google or add your iCal address in Settings.
          </p>
        ) : (!calendar.updatedAt && calendar.events.length === 0) || loading ? (
          <p className="pt-1 text-center text-xs text-white/40">
            {loading || !calendar.error ? 'Loading calendar...' : calendar.error}
          </p>
        ) : list.length === 0 ? (
          <p className="pt-1 text-center text-xs text-white/40">
            {selected === today ? 'Nothing for today' : `Nothing on ${dayLabel.format(selected)}`}
          </p>
        ) : (
          list.slice(0, 3).map((e) => (
            <div key={e.id} className="flex items-center gap-2">
              <span className="h-3.5 w-0.5 shrink-0 rounded-full bg-accent" />
              <span className="min-w-0 flex-1 truncate text-xs">{e.title}</span>
              <span className="shrink-0 text-[11px] text-white/45 tabular-nums">
                {e.allDay ? 'All day' : selected === today && e.start <= now ? 'Now' : formatTime(e.start)}
              </span>
            </div>
          ))
        )}
        {list.length > 3 && <p className="text-[10px] text-white/40">+{list.length - 3} more</p>}
        {calendar.error && calendar.updatedAt && <p className="text-[10px] text-amber-300/80">{calendar.error}</p>}
      </div>
    </div>
  )
}

export default { id: 'calendar', name: 'Calendar', width: 260, options: {}, Compact, Panel }
