// Claude Code sessions and pending approvals, built from hook events.
// Everything here is in memory only.
import { execFile } from 'node:child_process'
import crypto from 'node:crypto'
import path from 'node:path'
import { log } from './log'

// A session can vanish without SessionEnd (terminal closed, Claude killed mid-tool). Two guards:
// 1. Liveness: the relay sends its parent pid (the Claude Code process). While sessions exist, a
//    sweep checks once a minute that it is still running (process.kill(pid, 0), no spawning).
// 2. Staleness: no events for a while turns "working" into "stale", and quiet sessions are forgotten.
const SWEEP_MS = 60 * 1000
const STUCK_MS = 10 * 60 * 1000
const WAITING_STUCK_MS = 60 * 60 * 1000
const FORGET_MS = 45 * 60 * 1000
// If the hook's parent is a shell, it dies right after the hook, so its pid says nothing.
const NOT_CLAUDE = /^(cmd|powershell|pwsh|bash|sh|conhost|wsl).exe$/i

function isAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return e.code === 'EPERM'
  }
}

// Once per new pid: is it worth tracking? (tasklist is a one-off, not a loop.)
function processName(pid) {
  return new Promise((resolve) => {
    execFile('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], { windowsHide: true, timeout: 5000 }, (err, out) => {
      const m = !err && /^"([^"]+)"/.exec(String(out).trim())
      resolve(m ? m[1] : null)
    })
  })
}

export function createClaudeHub({ getConfig, onChange, onAttention }) {
  const sessions = new Map()
  const approvals = new Map()
  let changeTimer = null
  let sweepTimer = null
  const pidNames = new Map()

  // Tool events can arrive in bursts; push at most ~10 updates a second to the window.
  function changed() {
    if (changeTimer) return
    changeTimer = setTimeout(() => {
      changeTimer = null
      onChange(snapshot())
    }, 100)
    // The sweep only runs while there is something to watch.
    if (sessions.size > 0 && !sweepTimer) {
      sweepTimer = setInterval(sweep, SWEEP_MS)
      sweepTimer.unref()
    } else if (sessions.size === 0 && sweepTimer) {
      clearInterval(sweepTimer)
      sweepTimer = null
    }
  }

  function trackPid(s, pid) {
    if (!Number.isInteger(pid) || pid <= 0 || s.pid === pid) return
    if (pidNames.has(pid)) {
      if (pidNames.get(pid)) s.pid = pid
      return
    }
    pidNames.set(pid, null)
    processName(pid).then((name) => {
      const ok = !!name && !NOT_CLAUDE.test(name)
      pidNames.set(pid, ok)
      log(ok ? 'watching session process' : 'not watching hook parent', name || '(unknown)')
      if (ok && sessions.get(s.id) === s) s.pid = pid
    })
  }

  function hasApproval(id) {
    for (const a of approvals.values()) if (a.sessionId === id) return true
    return false
  }

  function sweep() {
    const now = Date.now()
    let any = false
    for (const [id, s] of sessions) {
      if (hasApproval(id)) continue
      const quiet = now - s.updatedAt
      if (s.pid && !isAlive(s.pid)) {
        sessions.delete(id)
        any = true
      } else if (s.state === 'working' && quiet > STUCK_MS) {
        s.state = 'stale'
        any = true
      } else if (s.state === 'waiting' && quiet > WAITING_STUCK_MS) {
        s.state = 'stale'
        any = true
      } else if (s.state !== 'working' && s.state !== 'waiting' && quiet > FORGET_MS) {
        sessions.delete(id)
        any = true
      }
    }
    for (const pid of pidNames.keys()) if (![...sessions.values()].some((s) => s.pid === pid)) pidNames.delete(pid)
    if (any) changed()
  }

  function snapshot() {
    return {
      sessions: [...sessions.values()].sort((a, b) => b.updatedAt - a.updatedAt),
      approvals: [...approvals.values()].map(({ timer, reply, ...a }) => a)
    }
  }

  function session(p) {
    let s = sessions.get(p.session_id)
    if (!s) {
      s = {
        id: p.session_id,
        project: p.cwd ? path.basename(p.cwd) : 'Claude',
        title: null,
        state: 'idle',
        tool: null,
        hint: '',
        model: null,
        lastMessage: null,
        lastTs: 0,
        pid: null,
        updatedAt: Date.now()
      }
      sessions.set(p.session_id, s)
    }
    if (p.cwd) s.project = path.basename(p.cwd)
    if (p.session_title) s.title = p.session_title
    s.updatedAt = Date.now()
    trackPid(s, p.pid)
    return s
  }

  function handle(p, reply, onGone) {
    if (p.event === 'SessionEnd') {
      sessions.delete(p.session_id)
      for (const a of approvals.values()) if (a.sessionId === p.session_id) resolve(a.id, null)
      return changed()
    }
    const s = session(p)
    // Async hooks can land slightly out of order; don't let an older event overwrite a newer state.
    const fresh = typeof p.ts !== 'number' || p.ts >= s.lastTs
    if (fresh && typeof p.ts === 'number') s.lastTs = p.ts

    switch (p.event) {
      case 'SessionStart':
        if (p.model) s.model = typeof p.model === 'string' ? p.model : p.model.display_name || p.model.id || null
        if (fresh) s.state = 'idle'
        break
      case 'UserPromptSubmit':
        if (fresh) Object.assign(s, { state: 'working', tool: null, hint: '', lastMessage: null })
        break
      case 'PreToolUse':
        if (fresh) Object.assign(s, { state: 'working', tool: p.tool_name || null, hint: p.hint || '' })
        break
      case 'PostToolUse':
        if (fresh && s.state !== 'waiting') s.state = 'working'
        else if (s.state === 'stale') s.state = 'working'
        break
      case 'Notification':
        if (p.notification_type === 'permission_prompt' || p.notification_type === 'elicitation_dialog') {
          s.state = 'waiting'
          onAttention({ kind: 'waiting', project: s.project })
        } else if (p.notification_type === 'idle_prompt' && s.state !== 'working' && s.state !== 'stale') {
          s.state = 'done'
        }
        break
      case 'Stop':
        if (fresh) Object.assign(s, { state: 'done', tool: null, hint: '', lastMessage: p.last_message || null })
        onAttention({ kind: 'done', project: s.project })
        break
      case 'PermissionRequest':
        s.state = 'waiting'
        request(p, s, reply, onGone)
        break
    }
    changed()
  }

  function request(p, s, reply, onGone) {
    const cfg = getConfig()
    if (!cfg.approvalsEnabled) return reply(null)
    const id = crypto.randomUUID()
    const timeoutMs = Math.max(10, cfg.approvalTimeoutSec) * 1000
    const a = {
      id,
      sessionId: s.id,
      project: s.project,
      tool: p.tool_name || 'Tool',
      input: p.tool_input || {},
      mode: p.permission_mode || null,
      createdAt: Date.now(),
      expiresAt: Date.now() + timeoutMs,
      reply,
      timer: setTimeout(() => resolve(id, null), timeoutMs)
    }
    approvals.set(id, a)
    onGone(() => resolve(id, null, true))
    onAttention({ kind: 'approval', project: s.project })
  }

  // decision: 'allow' | 'deny' | null (null = hand the prompt back to the terminal).
  function resolve(id, decision, gone = false) {
    const a = approvals.get(id)
    if (!a) return false
    approvals.delete(id)
    clearTimeout(a.timer)
    if (!gone) a.reply(decision)
    const s = sessions.get(a.sessionId)
    if (s && decision) s.state = 'working'
    changed()
    return true
  }


  return {
    handle,
    snapshot,
    decide: (id, decision) => resolve(id, decision === 'allow' || decision === 'deny' ? decision : null),
    releaseAll: () => [...approvals.keys()].forEach((id) => resolve(id, null))
  }
}
