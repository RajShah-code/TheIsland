// The OAuth "installed app" flow shared by Google and Microsoft: open the browser at the provider's
// consent page, catch the redirect on a one-off 127.0.0.1 server (PKCE, random state), then trade the
// code for tokens. No SDK, plain fetch.
import crypto from 'node:crypto'
import http from 'node:http'
import { shell } from 'electron'

const SIGN_IN_TIMEOUT_MS = 5 * 60 * 1000

let pending = null // the sign-in in progress: { cancel }

export const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

// Returns { code, redirectUri, verifier }. `redirectHost` is what the provider has registered
// (Microsoft wants "localhost", Google takes "127.0.0.1"); the server listens on 127.0.0.1 either way.
export async function loopbackSignIn({ authUrl, params, redirectHost = '127.0.0.1' }) {
  pending?.cancel()
  const verifier = b64url(crypto.randomBytes(32))
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest())
  const state = b64url(crypto.randomBytes(16))
  let redirectUri
  const code = await new Promise((resolve, reject) => {
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
        const err = u.searchParams.get('error')
        finish(new Error(err === 'access_denied' ? 'Sign-in was cancelled.' : 'Sign-in failed.'))
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
      redirectUri = `http://${redirectHost}:${server.address().port}`
      const q = new URLSearchParams({
        ...params,
        redirect_uri: redirectUri,
        response_type: 'code',
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state
      })
      shell.openExternal(`${authUrl}?${q}`).catch((e) => finish(e))
    })
  })
  return { code, redirectUri, verifier }
}

export async function tokenRequest(url, params) {
  const res = await fetch(url, {
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

// An error the user has to act on (sign in again, fix a password): shown as is in the widget.
export function userError(message) {
  const e = new Error(message)
  e.user = true
  return e
}

// "2026-10-22" as local midnight, like the iCal parser does for all-day events.
export function localDate(s) {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

// The first video call link in some text (an ICS location or description).
const MEETING = /https:\/\/(?:[\w-]+\.)*(?:meet\.google\.com|zoom\.us|teams\.microsoft\.com|teams\.live\.com|webex\.com|whereby\.com)\/[^\s"<>)]+/i
export function findMeetingUrl(...texts) {
  for (const t of texts) {
    const m = typeof t === 'string' && MEETING.exec(t)
    if (m) return m[0]
  }
  return null
}
