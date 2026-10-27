// Outlook / Microsoft 365 through Microsoft Graph. A public client (no secret) registered by the
// owner for work, school and personal accounts; its ID comes in at build time from
// MAIN_VITE_MS_CLIENT_ID. Reads the default calendar's view for the range. Microsoft rotates refresh
// tokens, so every refresh saves the new one.
import { log } from '../log'
import { findMeetingUrl, localDate, loopbackSignIn, tokenRequest, userError } from './oauth'

const AUTHORITY = 'https://login.microsoftonline.com/common/oauth2/v2.0'
const GRAPH = 'https://graph.microsoft.com/v1.0'
const SCOPE = 'offline_access User.Read Calendars.Read'
const MAX_PAGES = 5
const CLIENT_ID = import.meta.env.MAIN_VITE_MS_CLIENT_ID || ''

export const REFRESH_MS = 3 * 60 * 1000
export const STALE_MS = 15 * 1000
export const hasBuiltInClient = () => !!CLIENT_ID

const access = new Map() // account id -> { token, expires }

export async function connect() {
  if (!CLIENT_ID) throw userError('This build has no Microsoft sign-in yet.')
  const { code, redirectUri, verifier } = await loopbackSignIn({
    authUrl: `${AUTHORITY}/authorize`,
    params: { client_id: CLIENT_ID, scope: SCOPE, prompt: 'select_account' },
    // Microsoft's desktop redirect is registered as http://localhost (any port).
    redirectHost: 'localhost'
  })
  let t
  try {
    t = await tokenRequest(`${AUTHORITY}/token`, {
      client_id: CLIENT_ID,
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      scope: SCOPE
    })
  } catch (e) {
    throw userError('Sign-in failed: ' + e.message)
  }
  if (!t.refresh_token) throw userError('Microsoft sent no refresh token. Try again.')
  let label = 'Outlook'
  try {
    const res = await fetch(`${GRAPH}/me?$select=mail,userPrincipalName`, {
      headers: { Authorization: 'Bearer ' + t.access_token },
      signal: AbortSignal.timeout(10000)
    })
    if (res.ok) {
      const me = await res.json()
      label = me.mail || me.userPrincipalName || label
    }
  } catch {}
  log('outlook calendar signed in')
  return { label, meta: {}, secrets: { refreshToken: t.refresh_token } }
}

// Microsoft has no revoke endpoint for a public client; forgetting the token is all there is.
export async function disconnect(ctx) {
  access.delete(ctx.id)
}

async function accessToken(ctx) {
  const a = access.get(ctx.id)
  if (a && Date.now() < a.expires) return a.token
  const refreshToken = ctx.secrets()?.refreshToken
  if (!refreshToken) throw userError('Outlook sign-in expired. Sign in again in Settings.')
  try {
    const t = await tokenRequest(`${AUTHORITY}/token`, {
      client_id: CLIENT_ID,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: SCOPE
    })
    if (t.refresh_token && t.refresh_token !== refreshToken) ctx.saveSecrets({ refreshToken: t.refresh_token })
    access.set(ctx.id, { token: t.access_token, expires: Date.now() + (t.expires_in - 60) * 1000 })
    return t.access_token
  } catch (e) {
    if (e.code === 'invalid_grant') {
      ctx.saveSecrets({ refreshToken: null })
      log('outlook calendar sign-in expired')
      throw userError('Outlook sign-in expired. Sign in again in Settings.')
    }
    throw e
  }
}

export async function events(ctx, from, to) {
  const out = []
  const q = new URLSearchParams({
    startDateTime: new Date(from).toISOString(),
    endDateTime: new Date(to).toISOString(),
    $select: 'id,subject,location,start,end,isAllDay,isCancelled,onlineMeeting,bodyPreview',
    $top: '200'
  })
  let url = `${GRAPH}/me/calendarView?${q}`
  for (let page = 0; url && page < MAX_PAGES; page++) {
    const token = await accessToken(ctx)
    const res = await fetch(url, {
      // Times in UTC, so they parse the same whatever the mailbox's time zone is.
      headers: { Authorization: 'Bearer ' + token, Prefer: 'outlook.timezone="UTC"' },
      signal: AbortSignal.timeout(20000)
    })
    if (res.status === 401) access.delete(ctx.id)
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const r = await res.json()
    for (const e of r.value || []) {
      if (e.isCancelled || !e.start) continue
      // All-day events are midnight to midnight with no real zone: take the dates as local days.
      const start = e.isAllDay ? localDate(e.start.dateTime) : Date.parse(e.start.dateTime + 'Z')
      const end = e.isAllDay ? localDate(e.end.dateTime) : Date.parse(e.end.dateTime + 'Z')
      out.push({
        id: 'ms:' + e.id,
        title: e.subject || '(No title)',
        location: e.location?.displayName || null,
        start,
        end,
        allDay: !!e.isAllDay,
        joinUrl: e.onlineMeeting?.joinUrl || findMeetingUrl(e.location?.displayName, e.bodyPreview)
      })
    }
    url = r['@odata.nextLink'] || null
  }
  return out
}
