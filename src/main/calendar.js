// Calendar: reads the user's Google Calendar, either through the Calendar API after a Google
// sign-in (google-calendar.js: changes show up on the next fetch) or from the "secret address in
// iCal format" (an ICS URL, which Google itself only updates every few hours). The island gets the
// current week and the two after it, refreshed in the background, when the island opens and after
// the PC wakes up. Any other week is loaded when the widget pages to it (week()).
// The URL and tokens are stored encrypted (see config.js) and never logged. ical.js is only loaded
// when there is a URL.
import { powerMonitor } from 'electron'
import { addDays, startOfWeek } from '../shared/weeks.mjs'
import { googleEvents } from './google-calendar'
import { log } from './log'

const WINDOW_WEEKS = 3
// The API is cheap and current, so it is polled more often; Google's iCal copy changes rarely.
const REFRESH_MS = { google: 3 * 60 * 1000, ics: 15 * 60 * 1000 }
// Opening the island refreshes when the last fetch is older than this.
const STALE_MS = { google: 15 * 1000, ics: 2 * 60 * 1000 }
// After a failed fetch (often no network yet right after login), try again sooner.
const RETRY_MS = 60 * 1000
const WEEK_TTL_MS = 60 * 1000
const MAX_WEEKS_CACHED = 8
const MAX_EVENTS = 300
const MAX_BYTES = 5 * 1024 * 1024
// How far the widget can page, either way.
const MAX_WEEK_DISTANCE_MS = 5 * 366 * 24 * 60 * 60 * 1000

// getSource() returns { kind: 'google' }, { kind: 'ics', url } or null.
export function startCalendar({ getSource, onChange }) {
  // Configured as soon as there is a source, so the island doesn't ask for one during the first fetch.
  let state = { configured: !!getSource(), source: getSource()?.kind || null, from: 0, to: 0, events: [], error: null, updatedAt: null }
  let timer = null
  let retry = null
  let loading = false
  let again = false
  let attemptAt = 0
  let ics = null // { url, text, at }: the last iCal file, so other weeks parse without a download
  const weeks = new Map() // week start -> { events, at }

  async function load(src, from, to, fresh) {
    if (src.kind === 'google') return googleEvents(from, to)
    if (fresh || !ics || ics.url !== src.url || Date.now() - ics.at > REFRESH_MS.ics) {
      const res = await fetch(src.url, { signal: AbortSignal.timeout(20000), redirect: 'follow' })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const text = await res.text()
      if (text.length > MAX_BYTES) throw new Error('calendar file too large')
      ics = { url: src.url, text, at: Date.now() }
    }
    return parse(ics.text, from, to)
  }

  async function refresh() {
    const src = getSource()
    if (!src) {
      ics = null
      weeks.clear()
      state = { configured: false, source: null, from: 0, to: 0, events: [], error: null, updatedAt: null }
      return onChange(state)
    }
    if (loading) {
      again = true
      return
    }
    loading = true
    attemptAt = Date.now()
    clearTimeout(retry)
    if (!state.configured || state.source !== src.kind) {
      state = { ...state, configured: true, source: src.kind, events: [], error: null, updatedAt: null }
      onChange(state)
    }
    try {
      const from = startOfWeek(Date.now())
      const to = addDays(from, WINDOW_WEEKS * 7)
      const events = await load(src, from, to, true)
      weeks.clear()
      state = { configured: true, source: src.kind, from, to, events, error: null, updatedAt: Date.now() }
    } catch (e) {
      // Keep the last good events; just flag the error.
      log('calendar refresh failed:', e && e.name === 'TimeoutError' ? 'timeout' : e && e.message)
      const error = /sign-in expired/.test(e?.message) ? e.message : "Couldn't load calendar"
      state = { ...state, configured: true, source: src.kind, error }
      retry = setTimeout(refresh, RETRY_MS)
      retry.unref()
    } finally {
      loading = false
    }
    onChange(state)
    if (again) {
      again = false
      refresh()
    }
  }

  function schedule() {
    clearInterval(timer)
    timer = setInterval(refresh, REFRESH_MS[getSource()?.kind || 'ics'])
    timer.unref()
  }

  // Events of the week starting at `start` (a Monday from startOfWeek). Inside the window the
  // island already has them; other weeks are fetched (API) or parsed from the cached file (iCal).
  async function week(start) {
    const src = getSource()
    if (!src || !Number.isFinite(start) || Math.abs(start - Date.now()) > MAX_WEEK_DISTANCE_MS) return null
    start = startOfWeek(start)
    const end = addDays(start, 7)
    if (start >= state.from && end <= state.to) return state.events.filter((e) => e.start < end && e.end > start)
    const hit = weeks.get(start)
    if (hit && Date.now() - hit.at < WEEK_TTL_MS) return hit.events
    try {
      const events = await load(src, start, end, false)
      weeks.delete(start)
      weeks.set(start, { events, at: Date.now() })
      if (weeks.size > MAX_WEEKS_CACHED) weeks.delete(weeks.keys().next().value)
      return events
    } catch (e) {
      log('calendar week failed:', e && e.message)
      return hit ? hit.events : null
    }
  }

  powerMonitor.on('resume', () => setTimeout(refresh, 5000))
  refresh()
  schedule()

  return {
    get: () => state,
    week,
    // The island was opened: fetch now unless the last fetch was very recent.
    touch: () => {
      const src = getSource()
      if (src && Date.now() - attemptAt > STALE_MS[src.kind]) refresh()
    },
    refresh: () => {
      refresh()
      schedule()
    }
  }
}

async function parse(text, rangeStart, rangeEnd) {
  const { default: ICAL } = await import('ical.js')
  const root = new ICAL.Component(ICAL.parse(text))
  for (const tz of root.getAllSubcomponents('vtimezone')) {
    try {
      ICAL.TimezoneService.register(tz)
    } catch {}
  }

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
    for (let i = 0; i < 10000 && (next = it.next()); i++) {
      const t = next.toJSDate().getTime()
      if (t >= rangeEnd) break
      if (t < rangeStart - 7 * 24 * 60 * 60 * 1000) continue
      const d = ev.getOccurrenceDetails(next)
      push(d.item, d.startDate, d.endDate)
    }
  }

  return out
    .sort((a, b) => a.start - b.start)
    .slice(0, MAX_EVENTS)
}
