// iCal links: any https (or webcal) address of an .ics file. Google's "secret address", Outlook's
// published calendar, Apple's public calendars, Proton, Fastmail, school and team calendars. The
// address is stored encrypted and never logged. ical.js is only loaded when there is something to parse.
import { log } from '../log'
import { findMeetingUrl, userError } from './oauth'

const MAX_EVENTS = 300
const MAX_BYTES = 5 * 1024 * 1024

export const REFRESH_MS = 15 * 60 * 1000
export const STALE_MS = 2 * 60 * 1000

const files = new Map() // account id -> { url, text, at }: the last file, so other weeks parse without a download

// Checks an address. Returns the https URL, or null.
export function cleanUrl(text) {
  let s = String(text || '').trim()
  if (/^webcals?:\/\//i.test(s)) s = s.replace(/^webcals?:/i, 'https:')
  try {
    const u = new URL(s)
    return u.protocol === 'https:' ? u.href : null
  } catch {
    return null
  }
}

function nameFrom(url, text) {
  const m = /^X-WR-CALNAME:(.+)$/m.exec(text)
  if (m) return m[1].trim().slice(0, 60)
  return new URL(url).hostname.replace(/^www\./, '')
}

async function download(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000), redirect: 'follow' })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  const text = await res.text()
  if (text.length > MAX_BYTES) throw new Error('calendar file too large')
  return text
}

// payload: { url, label? }. Downloads the file once so a wrong address fails here, not later.
export async function connect(payload = {}) {
  const url = cleanUrl(payload.url)
  if (!url) {
    throw userError('That is not a calendar address. It starts with https:// or webcal:// and usually ends with .ics.')
  }
  let text
  try {
    text = await download(url)
  } catch (e) {
    throw userError(`Couldn't download that calendar (${e.name === 'TimeoutError' ? 'timeout' : e.message}).`)
  }
  if (!/BEGIN:VCALENDAR/.test(text.slice(0, 2000))) throw userError('That address is not an iCal file.')
  log('ics calendar added')
  return { label: String(payload.label || '').trim().slice(0, 60) || nameFrom(url, text), meta: {}, secrets: { url } }
}

export async function disconnect(ctx) {
  files.delete(ctx.id)
}

export async function events(ctx, from, to, fresh) {
  const url = ctx.secrets()?.url
  if (!url) throw userError('Calendar address missing. Add it again in Settings.')
  let f = files.get(ctx.id)
  if (fresh || !f || f.url !== url || Date.now() - f.at > REFRESH_MS) {
    f = { url, text: await download(url), at: Date.now() }
    files.set(ctx.id, f)
  }
  return parse(f.text, from, to)
}

// Parses an iCal file (one or more VCALENDARs) into events overlapping [rangeStart, rangeEnd).
// Also used for CalDAV, whose objects are iCal too.
export async function parse(text, rangeStart, rangeEnd) {
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
      allDay: start.isDate,
      joinUrl: findMeetingUrl(item.location, item.description, item.component.getFirstPropertyValue('url'))
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

  return out.sort((a, b) => a.start - b.start).slice(0, MAX_EVENTS)
}
