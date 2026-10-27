// Notion databases: the dated items of one database (tasks, content calendars, meetings) as events.
// The user makes an internal integration at notion.so/my-integrations, shares the database with it and
// pastes its token (Notion's public OAuth needs a server-side secret, which a desktop app can't keep).
// The token is stored encrypted. Notion Calendar itself has no API; its users connect Google or Outlook.
import { log } from '../log'
import { localDate, userError } from './oauth'

const API = 'https://api.notion.com/v1'
const VERSION = '2022-06-28'
const MAX_PAGES = 5

export const REFRESH_MS = 5 * 60 * 1000
export const STALE_MS = 60 * 1000

async function api(token, method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + token,
      'Notion-Version': VERSION,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000)
  })
  if (res.status === 401) throw userError('Notion refused the token. Check it in Settings.')
  if (res.status === 404) throw userError('Notion can’t see that database. Share it with your integration (••• > Connections).')
  if (!res.ok) throw new Error('HTTP ' + res.status)
  return res.json()
}

// A database link or id: the 32 hex digits, with or without dashes.
function databaseId(text) {
  const m = /([0-9a-f]{32})/i.exec(String(text || '').replace(/-/g, ''))
  return m ? m[1] : null
}

// payload: { token, database, dateProperty? }. Reads the database once to find its title and date
// properties, so the settings form only needs the link.
export async function connect(payload = {}) {
  const token = String(payload.token || '').trim()
  const id = databaseId(payload.database)
  if (!token) throw userError('Paste your Notion integration token.')
  if (!id) throw userError('Paste the database link (Share > Copy link) or its id.')
  const db = await api(token, 'GET', `/databases/${id}`)
  const props = Object.entries(db.properties || {})
  const titleProperty = props.find(([, p]) => p.type === 'title')?.[0]
  const dates = props.filter(([, p]) => p.type === 'date').map(([name]) => name)
  const wanted = String(payload.dateProperty || '').trim()
  const dateProperty = wanted ? dates.find((d) => d.toLowerCase() === wanted.toLowerCase()) : dates[0]
  if (!dateProperty) {
    throw userError(wanted ? `No date property called "${wanted}". It has: ${dates.join(', ') || 'none'}.` : 'That database has no date property.')
  }
  const name = (db.title || []).map((t) => t.plain_text).join('') || 'Notion'
  log('notion calendar added')
  return { label: name.slice(0, 60), meta: { databaseId: id, dateProperty, titleProperty }, secrets: { token } }
}

export async function disconnect() {}

export async function events(ctx, from, to) {
  const token = ctx.secrets()?.token
  if (!token) throw userError('Notion token missing. Add the database again in Settings.')
  const { databaseId: id, dateProperty, titleProperty } = ctx.meta
  const out = []
  let cursor
  for (let page = 0; page < MAX_PAGES; page++) {
    const r = await api(token, 'POST', `/databases/${id}/query`, {
      page_size: 100,
      filter: {
        and: [
          { property: dateProperty, date: { on_or_after: new Date(from - 31 * 24 * 60 * 60 * 1000).toISOString() } },
          { property: dateProperty, date: { before: new Date(to).toISOString() } }
        ]
      },
      ...(cursor ? { start_cursor: cursor } : {})
    })
    for (const p of r.results || []) {
      const d = p.properties?.[dateProperty]?.date
      if (!d?.start) continue
      const allDay = d.start.length <= 10
      const start = allDay ? localDate(d.start) : Date.parse(d.start)
      let end = d.end ? (allDay ? localDate(d.end) + 24 * 60 * 60 * 1000 : Date.parse(d.end)) : null
      if (end == null) end = allDay ? start + 24 * 60 * 60 * 1000 : start + 30 * 60 * 1000
      if (end <= from || start >= to) continue
      const title = (p.properties?.[titleProperty]?.title || []).map((t) => t.plain_text).join('')
      out.push({ id: 'notion:' + p.id, title: title || '(No title)', location: null, start, end, allDay, joinUrl: null })
    }
    if (!r.has_more) break
    cursor = r.next_cursor
  }
  return out
}
