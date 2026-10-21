// Calendar: reads the user's Google Calendar "secret address in iCal format" (an ICS URL).
// No OAuth. Refreshes every 15 minutes and after the PC wakes up. The URL is stored encrypted
// (see config.js) and never logged. ical.js is only loaded when there is a URL.
import { powerMonitor } from 'electron'
import { log } from './log'

const REFRESH_MS = 15 * 60 * 1000
const RANGE_MS = 7 * 24 * 60 * 60 * 1000
const MAX_EVENTS = 8
const MAX_BYTES = 5 * 1024 * 1024

export function startCalendar({ getUrl, onChange }) {
  let state = { configured: false, events: [], error: null, updatedAt: null }
  let timer = null
  let loading = false

  async function refresh() {
    const url = getUrl()
    if (!url) {
      state = { configured: false, events: [], error: null, updatedAt: null }
      return onChange(state)
    }
    if (loading) return
    loading = true
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000), redirect: 'follow' })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const text = await res.text()
      if (text.length > MAX_BYTES) throw new Error('calendar file too large')
      const events = await parse(text)
      state = { configured: true, events, error: null, updatedAt: Date.now() }
    } catch (e) {
      // Keep the last good events; just flag the error.
      log('calendar refresh failed:', e && e.name === 'TimeoutError' ? 'timeout' : e && e.message)
      state = { ...state, configured: true, error: "Couldn't load calendar" }
    } finally {
      loading = false
    }
    onChange(state)
  }

  function schedule() {
    clearInterval(timer)
    timer = setInterval(refresh, REFRESH_MS)
    timer.unref()
  }

  powerMonitor.on('resume', () => setTimeout(refresh, 5000))
  refresh()
  schedule()

  return {
    get: () => state,
    refresh: () => {
      refresh()
      schedule()
    }
  }
}

async function parse(text) {
  const { default: ICAL } = await import('ical.js')
  const root = new ICAL.Component(ICAL.parse(text))
  for (const tz of root.getAllSubcomponents('vtimezone')) {
    try {
      ICAL.TimezoneService.register(tz)
    } catch {}
  }

  const now = Date.now()
  const rangeStart = now - 24 * 60 * 60 * 1000
  const rangeEnd = now + RANGE_MS
  const masters = new Map()
  const exceptions = []
  for (const v of root.getAllSubcomponents('vevent')) {
    const ev = new ICAL.Event(v)
    if (ev.isRecurrenceException()) exceptions.push(ev)
    else masters.set(ev.uid, ev)
  }
  for (const ex of exceptions) {
    const m = masters.get(ex.uid)
    if (m) m.relateException(ex)
    else masters.set(ex.uid + ex.recurrenceId, ex)
  }

  const out = []
  const push = (item, start, end) => {
    if (!start) return
    if (String(item.component.getFirstPropertyValue('status') || '').toUpperCase() === 'CANCELLED') return
    const s = start.toJSDate().getTime()
    const e = end ? end.toJSDate().getTime() : s
    if (e <= rangeStart || s >= rangeEnd) return
    out.push({
      id: item.uid + ':' + s,
      title: item.summary || '(No title)',
      location: item.location || null,
      start: s,
      end: e,
      allDay: start.isDate
    })
  }

  for (const ev of masters.values()) {
    if (!ev.isRecurring()) {
      push(ev, ev.startDate, ev.endDate)
      continue
    }
    const it = ev.iterator()
    let next
    // Safety cap so a daily event from years ago can't stall the main process.
    for (let i = 0; i < 5000 && (next = it.next()); i++) {
      const t = next.toJSDate().getTime()
      if (t >= rangeEnd) break
      if (t < rangeStart - 7 * 24 * 60 * 60 * 1000) continue
      const d = ev.getOccurrenceDetails(next)
      push(d.item, d.startDate, d.endDate)
    }
  }

  return out
    .filter((e) => e.end > now)
    .sort((a, b) => a.start - b.start)
    .slice(0, MAX_EVENTS)
}
