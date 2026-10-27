// Google Calendar API: reads events straight from Google, so edits show up on the next fetch instead
// of after Google's iCal cache catches up (hours). Signs in with TheIsland's own OAuth client (its ID
// and secret are put in at build time from MAIN_VITE_GOOGLE_CLIENT_ID / _SECRET; an installed app's
// secret is not confidential, Google says so) or, as an advanced option, a Desktop client the user
// made in Google Cloud. The refresh token is stored encrypted per account; access tokens only in memory.
import { log } from '../log'
import { findMeetingUrl, localDate, loopbackSignIn, tokenRequest, userError } from './oauth'

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
const USERINFO_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary'
const API = 'https://www.googleapis.com/calendar/v3'
const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'
const CALENDARS_TTL_MS = 60 * 60 * 1000
const MAX_PAGES = 5

const BUILT_IN = {
  clientId: import.meta.env.MAIN_VITE_GOOGLE_CLIENT_ID || '',
  clientSecret: import.meta.env.MAIN_VITE_GOOGLE_CLIENT_SECRET || ''
}

export const REFRESH_MS = 3 * 60 * 1000
export const STALE_MS = 15 * 1000
export const hasBuiltInClient = () => !!(BUILT_IN.clientId && BUILT_IN.clientSecret)

const access = new Map() // account id -> { token, expires }
const calendars = new Map() // account id -> { ids, at }

function client(secrets) {
  return secrets.clientId ? { clientId: secrets.clientId, clientSecret: secrets.clientSecret } : BUILT_IN
}

// payload: {} for the built-in client, or { clientId, clientSecret } for the user's own.
// Returns { label, meta, secrets } for a new account.
export async function connect(payload = {}) {
  const own = !!(payload.clientId || payload.clientSecret)
  const clientId = own ? String(payload.clientId || '').trim() : BUILT_IN.clientId
  const clientSecret = own ? String(payload.clientSecret || '').trim() : BUILT_IN.clientSecret
  if (!own && !hasBuiltInClient()) throw userError('This build has no Google sign-in. Use your own client instead.')
  if (!/\.apps\.googleusercontent\.com$/.test(clientId)) throw userError('Enter the client ID. It ends with .apps.googleusercontent.com.')
  if (!clientSecret) throw userError('Enter the client secret.')

  const { code, redirectUri, verifier } = await loopbackSignIn({
    authUrl: AUTH_URL,
    params: { client_id: clientId, scope: SCOPE, access_type: 'offline', prompt: 'consent' }
  })
  let t
  try {
    t = await tokenRequest(TOKEN_URL, {
      client_id: clientId,
      client_secret: clientSecret,
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    })
  } catch (e) {
    throw userError('Sign-in failed: ' + e.message)
  }
  if (!t.refresh_token) throw userError('Google sent no refresh token. Try again.')
  // The primary calendar's id is the account's email address: a good name for the row.
  let label = 'Google'
  try {
    const res = await fetch(`${USERINFO_URL}?fields=id`, {
      headers: { Authorization: 'Bearer ' + t.access_token },
      signal: AbortSignal.timeout(10000)
    })
    if (res.ok) label = (await res.json()).id || label
  } catch {}
  log('google calendar signed in')
  return {
    label,
    meta: { ownClient: own },
    secrets: { refreshToken: t.refresh_token, ...(own ? { clientId, clientSecret } : {}) }
  }
}

// Tells Google to revoke the token.
export async function disconnect(ctx) {
  const token = ctx.secrets()?.refreshToken
  access.delete(ctx.id)
  calendars.delete(ctx.id)
  if (!token) return
  await fetch(REVOKE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }),
    signal: AbortSignal.timeout(10000)
  }).catch(() => {})
}

async function accessToken(ctx) {
  const a = access.get(ctx.id)
  if (a && Date.now() < a.expires) return a.token
  const secrets = ctx.secrets() || {}
  if (!secrets.refreshToken) throw userError('Google sign-in expired. Sign in again in Settings.')
  const { clientId, clientSecret } = client(secrets)
  try {
    const t = await tokenRequest(TOKEN_URL, {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: secrets.refreshToken,
      grant_type: 'refresh_token'
    })
    access.set(ctx.id, { token: t.access_token, expires: Date.now() + (t.expires_in - 60) * 1000 })
    return t.access_token
  } catch (e) {
    // Revoked, or expired (a client in "Testing" mode gets 7-day refresh tokens).
    if (e.code === 'invalid_grant') {
      ctx.saveSecrets({ refreshToken: null })
      log('google calendar sign-in expired')
      throw userError('Google sign-in expired. Sign in again in Settings.')
    }
    throw e
  }
}

async function api(ctx, path, params) {
  const token = await accessToken(ctx)
  const res = await fetch(`${API}${path}${params ? '?' + new URLSearchParams(params) : ''}`, {
    headers: { Authorization: 'Bearer ' + token },
    signal: AbortSignal.timeout(20000)
  })
  if (res.status === 401) access.delete(ctx.id)
  if (!res.ok) throw new Error('HTTP ' + res.status)
  return res.json()
}

// The calendars ticked in Google Calendar's sidebar.
async function calendarIds(ctx) {
  const c = calendars.get(ctx.id)
  if (c && Date.now() - c.at < CALENDARS_TTL_MS) return c.ids
  const list = await api(ctx, '/users/me/calendarList', { fields: 'items(id,selected,hidden)', maxResults: '250' })
  const ids = (list.items || []).filter((x) => x.selected && !x.hidden).map((x) => x.id)
  calendars.set(ctx.id, { ids: ids.length ? ids : ['primary'], at: Date.now() })
  return calendars.get(ctx.id).ids
}

// Events overlapping [from, to), in the same shape the iCal parser produces.
export async function events(ctx, from, to) {
  const ids = await calendarIds(ctx)
  const lists = await Promise.all(ids.map((id) => calendarEvents(ctx, id, from, to)))
  return lists.flat()
}

async function calendarEvents(ctx, id, from, to) {
  const out = []
  let pageToken
  for (let page = 0; page < MAX_PAGES; page++) {
    const r = await api(ctx, `/calendars/${encodeURIComponent(id)}/events`, {
      timeMin: new Date(from).toISOString(),
      timeMax: new Date(to).toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
      fields: 'items(id,status,summary,location,description,start,end,hangoutLink,conferenceData/entryPoints),nextPageToken',
      ...(pageToken ? { pageToken } : {})
    })
    for (const e of r.items || []) {
      if (e.status === 'cancelled' || !e.start) continue
      const allDay = !e.start.dateTime
      const start = allDay ? localDate(e.start.date) : Date.parse(e.start.dateTime)
      const end = allDay ? localDate(e.end?.date || e.start.date) : Date.parse(e.end?.dateTime || e.start.dateTime)
      const video = e.conferenceData?.entryPoints?.find((p) => p.entryPointType === 'video')?.uri
      out.push({
        id: id + ':' + e.id,
        title: e.summary || '(No title)',
        location: e.location || null,
        start,
        end,
        allDay,
        joinUrl: e.hangoutLink || video || findMeetingUrl(e.location, e.description)
      })
    }
    pageToken = r.nextPageToken
    if (!pageToken) break
  }
  return out
}
