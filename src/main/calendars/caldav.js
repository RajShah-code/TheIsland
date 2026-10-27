// CalDAV, for Apple iCloud (no OAuth there: an Apple ID plus an app-specific password from
// appleid.apple.com) and any other CalDAV server. Plain fetch with PROPFIND/REPORT and a tiny tolerant
// reader for the XML replies (no DOM in the main process, no new dependency). Calendar objects are iCal,
// so ics.js parses them, recurrences included.
import { log } from '../log'
import { parse } from './ics'
import { userError } from './oauth'

export const ICLOUD = 'https://caldav.icloud.com/'
export const REFRESH_MS = 5 * 60 * 1000
export const STALE_MS = 60 * 1000
const CALENDARS_TTL_MS = 60 * 60 * 1000

const calendars = new Map() // account id -> { list: [{ href, name }], at }

const unescape = (s) =>
  s
    .replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#13;/g, '\r')
    .replace(/&amp;/g, '&')

// Inner text of every <prefix:name> element, whatever the namespace prefix.
function elements(xml, name) {
  const re = new RegExp(`<(?:[\\w-]+:)?${name}\\b[^>]*?(?:/>|>([\\s\\S]*?)</(?:[\\w-]+:)?${name}>)`, 'g')
  const out = []
  for (let m; (m = re.exec(xml)); ) out.push(m[1] ?? '')
  return out
}
const first = (xml, name) => elements(xml, name)[0]?.trim()

async function dav(ctx, method, url, depth, body) {
  const { appleId, server } = ctx.meta
  const password = ctx.secrets()?.password
  if (!password) throw userError('Calendar password missing. Add the account again in Settings.')
  const res = await fetch(new URL(url, server), {
    method,
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${appleId}:${password}`).toString('base64'),
      Depth: String(depth),
      'Content-Type': 'application/xml; charset=utf-8'
    },
    body,
    redirect: 'follow',
    signal: AbortSignal.timeout(20000)
  })
  if (res.status === 401 || res.status === 403) {
    throw userError('The calendar server refused the sign-in. Check the email and app-specific password in Settings.')
  }
  if (!res.ok && res.status !== 207) throw new Error('HTTP ' + res.status)
  return { xml: await res.text(), url: res.url }
}

const PROP = (inner) => `<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop>${inner}</d:prop></d:propfind>`

// principal -> calendar home -> the calendars in it that hold events.
async function discover(ctx) {
  const hit = calendars.get(ctx.id)
  if (hit && Date.now() - hit.at < CALENDARS_TTL_MS) return hit.list
  const root = await dav(ctx, 'PROPFIND', ctx.meta.server, 0, PROP('<d:current-user-principal/>'))
  const principal = first(first(root.xml, 'current-user-principal') || '', 'href')
  if (!principal) throw new Error('no principal')
  const p = await dav(ctx, 'PROPFIND', new URL(principal, root.url).href, 0, PROP('<c:calendar-home-set/>'))
  const home = first(first(p.xml, 'calendar-home-set') || '', 'href')
  if (!home) throw new Error('no calendar home')
  const homeUrl = new URL(home, p.url).href
  const h = await dav(ctx, 'PROPFIND', homeUrl, 1, PROP('<d:resourcetype/><d:displayname/><c:supported-calendar-component-set/>'))
  const list = []
  for (const r of elements(h.xml, 'response')) {
    const type = first(r, 'resourcetype') || ''
    if (!/<(?:[\w-]+:)?calendar\b/.test(type)) continue
    const comps = first(r, 'supported-calendar-component-set')
    if (comps && !/name="VEVENT"/i.test(comps)) continue
    list.push({ href: new URL(unescape(first(r, 'href')), homeUrl).href, name: unescape(first(r, 'displayname') || '') })
  }
  calendars.set(ctx.id, { list, at: Date.now() })
  return list
}

const utc = (t) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

async function calendarEvents(ctx, cal, from, to) {
  const body =
    '<?xml version="1.0" encoding="utf-8"?><c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">' +
    '<d:prop><c:calendar-data/></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT">' +
    `<c:time-range start="${utc(from)}" end="${utc(to)}"/></c:comp-filter></c:comp-filter></c:filter></c:calendar-query>`
  const { xml } = await dav(ctx, 'REPORT', cal.href, 1, body)
  const out = []
  for (const data of elements(xml, 'calendar-data')) {
    const text = unescape(data.trim())
    if (!text) continue
    try {
      out.push(...(await parse(text, from, to)).map((e) => ({ ...e, id: cal.href + ':' + e.id })))
    } catch {}
  }
  return out
}

// payload: { appleId, password, server? }. Finds the calendars once so a bad password fails here.
export async function connect(payload = {}) {
  const appleId = String(payload.appleId || '').trim()
  const password = String(payload.password || '').replace(/\s/g, '')
  let server = String(payload.server || '').trim() || ICLOUD
  if (!appleId) throw userError('Enter your Apple ID email.')
  if (!password) throw userError('Enter an app-specific password.')
  try {
    server = new URL(server).href
  } catch {
    throw userError('That server address is not valid.')
  }
  const ctx = { id: 'new', meta: { appleId, server }, secrets: () => ({ password }) }
  let list
  try {
    list = await discover(ctx)
  } catch (e) {
    throw e.user ? e : userError(`Couldn't reach the calendar server (${e.name === 'TimeoutError' ? 'timeout' : e.message}).`)
  } finally {
    calendars.delete('new')
  }
  if (list.length === 0) throw userError('Signed in, but this account has no calendars.')
  log('caldav calendar added')
  return { label: server === ICLOUD ? `iCloud (${appleId})` : appleId, meta: { appleId, server }, secrets: { password } }
}

export async function disconnect(ctx) {
  calendars.delete(ctx.id)
}

export async function events(ctx, from, to) {
  const list = await discover(ctx)
  const lists = await Promise.all(list.map((cal) => calendarEvents(ctx, cal, from, to)))
  return lists.flat()
}
