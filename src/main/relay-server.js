// Local channel between the hook relay and the app.
//
// - Listens on 127.0.0.1 only, on a random port.
// - Every request must carry the random token from relay.json (constant-time compare).
// - Requests with an Origin header are rejected, so a web page in a browser can't talk to it.
// - Only one endpoint: POST /event. Approvals are answered through Electron IPC from the island
//   window, never over HTTP, so no other local process can approve anything.
// - relay.json lives in %APPDATA%\TheIsland (user-only by default) and is deleted on quit, so the
//   relay exits immediately when the app isn't running.
import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { log } from './log'

const MAX_BODY = 1024 * 1024

export function startRelayServer({ dir, onEvent }) {
  const token = crypto.randomBytes(32).toString('hex')
  const tokenBuf = Buffer.from(token)
  const relayFile = path.join(dir, 'relay.json')

  const server = http.createServer((req, res) => {
    const fail = (code) => {
      res.writeHead(code).end()
      req.destroy()
    }
    const addr = req.socket.remoteAddress
    if (addr !== '127.0.0.1' && addr !== '::ffff:127.0.0.1') return fail(403)
    if (req.method !== 'POST' || req.url !== '/event' || req.headers.origin) return fail(404)
    const given = Buffer.from(String(req.headers['x-island-token'] || ''))
    if (given.length !== tokenBuf.length || !crypto.timingSafeEqual(given, tokenBuf)) return fail(403)

    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > MAX_BODY) fail(413)
      else chunks.push(c)
    })
    req.on('end', () => {
      if (res.writableEnded) return
      let payload
      try {
        payload = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      } catch {
        return fail(400)
      }
      if (!payload || typeof payload.event !== 'string' || typeof payload.session_id !== 'string') {
        return fail(400)
      }
      // reply(decision) is called once; for status events right away, for approvals later.
      let replied = false
      const reply = (decision) => {
        if (replied || res.writableEnded) return
        replied = true
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ decision: decision || null }))
      }
      // The relay was killed (user pressed Esc, Claude moved on): let the caller drop the request.
      const onGone = (cb) => res.on('close', () => !replied && cb())
      try {
        onEvent(payload, reply, onGone)
      } catch (e) {
        log('event handler error', e && e.message)
        reply(null)
      }
      if (payload.event !== 'PermissionRequest') reply(null)
    })
  })

  server.keepAliveTimeout = 1000
  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address()
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(relayFile, JSON.stringify({ port, token, pid: process.pid }))
    log('relay server listening on 127.0.0.1:' + port)
  })

  return {
    close() {
      try {
        fs.unlinkSync(relayFile)
      } catch {}
      server.close()
    }
  }
}
