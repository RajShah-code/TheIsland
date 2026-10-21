// Claude Code sessions and pending approvals, built from hook events.
// Everything here is in memory only.
import crypto from 'node:crypto'
import path from 'node:path'

const STALE_MS = 3 * 60 * 60 * 1000

export function createClaudeHub({ getConfig, onChange, onAttention }) {
  const sessions = new Map()
  const approvals = new Map()
  let changeTimer = null

  // Tool events can arrive in bursts; push at most ~10 updates a second to the window.
  function changed() {
    if (changeTimer) return
    changeTimer = setTimeout(() => {
      changeTimer = null
      onChange(snapshot())
    }, 100)
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
        updatedAt: Date.now()
      }
      sessions.set(p.session_id, s)
    }
    if (p.cwd) s.project = path.basename(p.cwd)
    if (p.session_title) s.title = p.session_title
    s.updatedAt = Date.now()
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
        break
      case 'Notification':
        if (p.notification_type === 'permission_prompt' || p.notification_type === 'elicitation_dialog') {
          s.state = 'waiting'
          onAttention({ kind: 'waiting', project: s.project })
        } else if (p.notification_type === 'idle_prompt' && s.state !== 'working') {
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

  const pruneTimer = setInterval(() => {
    const cutoff = Date.now() - STALE_MS
    let any = false
    for (const [id, s] of sessions) {
      if (s.updatedAt < cutoff && ![...approvals.values()].some((a) => a.sessionId === id)) {
        sessions.delete(id)
        any = true
      }
    }
    if (any) changed()
  }, 10 * 60 * 1000)
  pruneTimer.unref()

  return {
    handle,
    snapshot,
    decide: (id, decision) => resolve(id, decision === 'allow' || decision === 'deny' ? decision : null),
    releaseAll: () => [...approvals.keys()].forEach((id) => resolve(id, null))
  }
}
