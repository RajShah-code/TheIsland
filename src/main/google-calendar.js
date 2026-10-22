// Google Calendar API source: reads events straight from Google, so edits show up on the next fetch
// instead of after Google's iCal cache catches up (hours). No SDK: plain fetch plus the OAuth
// "installed app" flow with a loopback redirect and PKCE. The user brings their own OAuth client
// (Google Cloud "Desktop app" client ID and secret). Client secret and refresh token are stored
// encrypted (config.js); the access token only lives in memory.
import crypto from 'node:crypto'
import http from 'node:http'
import { shell } from 'electron'
import { getSecret, setSecret } from './config'
import { log } from './log'

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
const API = 'https://www.googleapis.com/calendar/v3'
const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'
const SIGN_IN_TIMEOUT_MS = 5 * 60 * 1000
const CALENDARS_TTL_MS = 60 * 60 * 1000
const MAX_PAGES = 5

let access = null // { token, expires }
let calendars = null // { ids, at }
let pending = null // the sign-in in progress: { cancel }

export function isGoogleSignedIn() {
  return !!getSecret('googleRefreshToken')
}

export function googleClientId() {
  return getSecret('googleClientId')
}

const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

// Opens the browser at Google's consent page and waits for it to come back to 127.0.0.1.
// Returns { ok: true } or { ok: false, error }.
export async function signInGoogle({ clientId, clientSecret }) {
  clientId = String(clientId || '').trim() || googleClientId()
  clientSecret = String(clientSecret || '').trim() || getSecret('googleClientSecret')
  if (!clientId || !/\.apps\.googleusercontent\.com$/.test(clientId)) {
    return { ok: false, error: 'Enter the client ID. It ends with .apps.googleusercontent.com.' }
  }
  if (!clientSecret) return { ok: false, error: 'Enter the client secret.' }
  pending?.cancel()

  const verifier = b64url(crypto.randomBytes(32))
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest())
  const state = b64url(crypto.randomBytes(16))

  let code
  let redirectUri
  try {
    code = await new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        const u = new URL(req.url, 'http://127.0.0.1')
        if (u.pathname !== '/') return res.writeHead(404).end()
        const ok = u.searchParams.get('state') === state && u.searchParams.get('code')
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(
          '<!doctype html><title>TheIsland</title><body style="font:16px system-ui;padding:40px">' +
            (ok ? 'Signed in. You can close this tab.' : 'Sign-in did not finish. You can close this tab.') +
            '</body>'
        )
        if (ok) finish(null, u.searchParams.get('code'))
        else if (u.searchParams.get('error') || u.searchParams.get('state')) {
          finish(new Error(u.searchParams.get('error') === 'access_denied' ? 'Sign-in was cancelled.' : 'Sign-in failed.'))
        }
      })
      const timer = setTimeout(() => finish(new Error('Sign-in timed out.')), SIGN_IN_TIMEOUT_MS)
      const finish = (err, value) => {
        clearTimeout(timer)
        server.close()
        pending = null
        err ? reject(err) : resolve(value)
      }
      pending = { cancel: () => finish(new Error('Sign-in was replaced by a new one.')) }
      server.on('error', (e) => finish(e))
      server.listen(0, '127.0.0.1', () => {
        redirectUri = `http://127.0.0.1:${server.address().port}`
        const q = new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: SCOPE,
          access_type: 'offline',
          prompt: 'consent',
          code_challenge: challenge,
          code_challenge_method: 'S256',
          state
        })
        shell.openExternal(`${AUTH_URL}?${q}`).catch((e) => finish(e))
      })
    })
  } catch (e) {
    return { ok: false, error: e.message }
  }

  try {
    const t = await tokenRequest({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    })
    if (!t.refresh_token) throw new Error('Google sent no refresh token.')
    setSecret('googleClientId', clientId)
    setSecret('googleClientSecret', clientSecret)
    setSecret('googleRefreshToken', t.refresh_token)
    access = { token: t.access_token, expires: Date.now() + (t.expires_in - 60) * 1000 }
    calendars = null
    log('google calendar signed in')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: 'Sign-in failed: ' + e.message }
  }
}

// Forgets the account and tells Google to revoke the token. The client ID stays for next time.
export async function signOutGoogle() {
  const token = getSecret('googleRefreshToken')
  setSecret('googleRefreshToken', null)
  setSecret('googleClientSecret', null)
  access = null
  calendars = null
  log('google calendar signed out')
  if (token) {
    await fetch(REVOKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }),
      signal: AbortSignal.timeout(10000)
    }).catch(() => {})
  }
}

async function tokenRequest(params) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(20000)
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(body.error_description || body.error || 'HTTP ' + res.status)
    err.code = body.error
    throw err
  }
  return body
}

async function accessToken() {
  if (access && Date.now() < access.expires) return access.token
  try {
    const t = await tokenRequest({
      client_id: googleClientId(),
      client_secret: getSecret('googleClientSecret'),
      refresh_token: getSecret('googleRefreshToken'),
      grant_type: 'refresh_token'
    })
    access = { token: t.access_token, expires: Date.now() + (t.expires_in - 60) * 1000 }
    return access.token
  } catch (e) {
    // Revoked, or expired (a client in "Testing" mode gets 7-day refresh tokens).
    if (e.code === 'invalid_grant') {
      setSecret('googleRefreshToken', null)
      log('google calendar sign-in expired')
      throw new Error('Google sign-in expired. Sign in again in Settings.')
    }
    throw e
  }
}

async function api(path, params) {
  const token = await accessToken()
  const res = await fetch(`${API}${path}${params ? '?' + new URLSearchParams(params) : ''}`, {
    headers: { Authorization: 'Bearer ' + token },
    signal: AbortSignal.timeout(20000)
  })
  if (res.status === 401) access = null
  if (!res.ok) throw new Error('HTTP ' + res.status)
  return res.json()
}

// The calendars ticked in Google Calendar's sidebar.
async function calendarIds() {
  if (calendars && Date.now() - calendars.at < CALENDARS_TTL_MS) return calendars.ids
  const list = await api('/users/me/calendarList', { fields: 'items(id,selected,hidden)', maxResults: '250' })
  const ids = (list.items || []).filter((c) => c.selected && !c.hidden).map((c) => c.id)
  calendars = { ids: ids.length ? ids : ['primary'], at: Date.now() }
  return calendars.ids
}

// Events overlapping [from, to), in the same shape the iCal parser produces.
export async function googleEvents(from, to) {
  const ids = await calendarIds()
  const lists = await Promise.all(ids.map((id) => calendarEvents(id, from, to)))
  return lists.flat().sort((a, b) => a.start - b.start)
}

async function calendarEvents(id, from, to) {
  const out = []
  let pageToken
  for (let page = 0; page < MAX_PAGES; page++) {
    const r = await api(`/calendars/${encodeURIComponent(id)}/events`, {
      timeMin: new Date(from).toISOString(),
      timeMax: new Date(to).toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
      fields: 'items(id,status,summary,location,start,end),nextPageToken',
      ...(pageToken ? { pageToken } : {})
    })
    for (const e of r.items || []) {
      if (e.status === 'cancelled' || !e.start) continue
      const allDay = !e.start.dateTime
      const start = allDay ? localDate(e.start.date) : Date.parse(e.start.dateTime)
      const end = allDay ? localDate(e.end?.date || e.start.date) : Date.parse(e.end?.dateTime || e.start.dateTime)
      out.push({ id: id + ':' + e.id, title: e.summary || '(No title)', location: e.location || null, start, end, allDay })
    }
    pageToken = r.nextPageToken
    if (!pageToken) break
  }
  return out
}

// "2026-10-22" as local midnight, like the iCal parser does for all-day events.
function localDate(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}
