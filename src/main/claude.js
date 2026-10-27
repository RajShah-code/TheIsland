// Coding agent sessions (Claude Code, Codex, Gemini CLI, Antigravity, Cursor, Copilot CLI) and pending
// approvals, built from hook events. The relay turns every agent's events into Claude Code's shape and
// says which agent sent them (p.agent); sessions are keyed per agent so ids can't collide.
// Everything here is in memory only.
import { execFile } from 'node:child_process'
import crypto from 'node:crypto'
import path from 'node:path'
import { AGENT_IDS as AGENTS, AGENT_NAMES } from '../shared/agents.mjs'
import { log } from './log'

// A session can vanish without SessionEnd (terminal closed, Claude killed mid-tool). Two guards:
// 1. Liveness: the relay sends its parent pid (the Claude Code process). While sessions exist, a
//    sweep checks every 10 s that it is still running (process.kill(pid, 0): no spawning, costs nothing).
// 2. Staleness: no events for a while turns "working" into "stale", and quiet sessions are forgotten.
// 3. Closed window: the Claude desktop app keeps its sessions running in the tray after its window is
//    closed. A finished session there (idle or done, nothing waiting or running) goes at the next sweep;
//    the helper says which desktop apps have no visible window (closedHosts). A working one stays.
const SWEEP_MS = 10 * 1000
const STUCK_MS = 10 * 60 * 1000
const WAITING_STUCK_MS = 60 * 60 * 1000
const FORGET_MS = 45 * 60 * 1000
// Subagents (the Agent tool, "Task" in older versions): finished ones stay visible for a moment, and a
// session keeps at most this many (the oldest finished ones go first).
const AGENT_TOOL = /^(Agent|Task)$/

const AGENT_KEEP_MS = 20 * 1000
const MAX_AGENTS = 8
// If the hook's parent is a shell, it dies right after the hook, so its pid says nothing.
const NOT_CLAUDE = /^(cmd|powershell|pwsh|bash|sh|conhost|wsl).exe$/i

// SubagentStart's agent_id and the Agent tool's tool_response.agentId may differ by an "agent-" prefix
// (the subagent transcript is named agent-<id>.jsonl), so compare them without it.
function agentKey(id) {
  return typeof id === 'string' && id ? id.replace(/^agent-/, '') : null
}

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

export function createClaudeHub({ getConfig, onChange, onAttention, closedHosts }) {
  const sessions = new Map()
  const approvals = new Map()
  let changeTimer = null
  let sweepTimer = null
  let agentTimer = null
  let agentTimerAt = Infinity
  const pidNames = new Map()

  // Tool events can arrive in bursts; push at most ~10 updates a second to the window.
  function changed() {
    if (changeTimer) return
    changeTimer = setTimeout(() => {
      changeTimer = null
      onChange(snapshot())
      scheduleAgentExpiry()
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
        continue
      }
      // A running subagent we never heard finish (missed SubagentStop) goes once it has been quiet as long
      // as a stuck session.
      const before = s.agents.length
      s.agents = s.agents.filter((a) => a.state !== 'running' || now - Math.max(a.lastAt, s.updatedAt) <= STUCK_MS)
      if (s.agents.length !== before) any = true
      if (s.state === 'working' && quiet > STUCK_MS) {
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
    dropClosedWindows()
  }

  const finished = (s) =>
    sessions.get(s.id) === s &&
    (s.state === 'done' || s.state === 'idle') &&
    !hasApproval(s.id) &&
    !s.agents.some((a) => a.state === 'running')

  function dropClosedWindows() {
    if (!closedHosts) return
    // Only Claude Code runs inside the Claude desktop app.
    const list = [...sessions.values()].filter((s) => s.agent === 'claude' && s.pid && finished(s))
    if (list.length === 0) return
    closedHosts(list.map((s) => s.pid)).then((closed) => {
      let any = false
      // Checked again: an event may have arrived while the helper looked.
      for (const s of list)
        if (closed.has(s.pid) && finished(s)) {
          sessions.delete(s.id)
          any = true
        }
      if (any) {
        log('cleared finished sessions of a closed Claude window')
        changed()
      }
    })
  }

  function snapshot() {
    return {
      sessions: [...sessions.values()]
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map(({ agents, sawSubagentStart, agentType, resumeState, ...s }) => ({ ...s, agents: agents.map(publicAgent) })),
      approvals: [...approvals.values()].map(({ timer, reply, ...a }) => a)
    }
  }

  function session(p) {
    let s = sessions.get(p.session_id)
    if (!s) {
      s = {
        id: p.session_id,
        agent: p.agent,
        project: p.cwd ? path.basename(p.cwd) : AGENT_NAMES[p.agent],
        title: null,
        state: 'idle',
        tool: null,
        hint: '',
        model: null,
        lastMessage: null,
        lastTs: 0,
        pid: null,
        agents: [],
        sawSubagentStart: false,
        agentType: null,
        resumeState: null,
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
    p.agent = AGENTS.includes(p.agent) ? p.agent : 'claude'
    if (p.agent !== 'claude') p.session_id = p.agent + ':' + p.session_id
    if (p.event === 'SessionEnd') {
      sessions.delete(p.session_id)
      for (const a of approvals.values()) if (a.sessionId === p.session_id) resolve(a.id, null)
      return changed()
    }
    const isNew = !sessions.has(p.session_id)
    const s = session(p)
    // Async hooks can land slightly out of order; don't let an older event overwrite a newer state.
    const fresh = typeof p.ts !== 'number' || p.ts >= s.lastTs
    if (fresh && typeof p.ts === 'number') s.lastTs = p.ts

    // Tool hooks fired inside a subagent carry its agent_id. They update that subagent's row, never the
    // main thread's state or tool: a background subagent keeps working after the main turn stopped.
    if (p.agent_id && (p.event === 'PreToolUse' || p.event === 'PostToolUse')) {
      let visible = isNew
      if (AGENT_TOOL.test(p.tool_name || '') && (p.event === 'PreToolUse' ? agentLaunch(s, p) : agentReturned(s, p))) visible = true
      if (agentToolEvent(s, p)) visible = true
      // Most tool events inside a subagent change nothing on screen; don't push those.
      if (visible) changed()
      return
    }

    switch (p.event) {
      case 'SessionStart':
        if (p.model) s.model = typeof p.model === 'string' ? p.model : p.model.display_name || p.model.id || null
        // Set when started with --agent; Claude Code's internal agents report this type (or none).
        s.agentType = p.agent_type || null
        if (fresh) s.state = 'idle'
        break
      case 'UserPromptSubmit':
        if (fresh) Object.assign(s, { state: 'working', tool: null, hint: '', lastMessage: null })
        break
      case 'PreToolUse':
        if (AGENT_TOOL.test(p.tool_name || '')) agentLaunch(s, p)
        if (fresh) Object.assign(s, { state: 'working', tool: p.tool_name || null, hint: p.hint || '' })
        break
      case 'PostToolUse':
        if (AGENT_TOOL.test(p.tool_name || '')) agentReturned(s, p)
        if (fresh && s.state !== 'waiting') s.state = 'working'
        else if (s.state === 'stale') s.state = 'working'
        break
      // Internal agents (prompt suggestions) start and stop after most turns; push only real changes.
      case 'SubagentStart':
        if (agentStarted(s, p) || isNew) changed()
        return
      case 'SubagentStop':
        if (agentStopped(s, p) || isNew) changed()
        return
      case 'Notification':
        if (p.notification_type === 'permission_prompt' || p.notification_type === 'elicitation_dialog') {
          enterWaiting(s, p)
          onAttention({ kind: 'waiting', project: s.project })
        } else if (p.notification_type === 'idle_prompt' && s.state !== 'working' && s.state !== 'stale') {
          s.state = 'done'
        }
        break
      case 'Stop':
        // The main turn is over, so the foreground subagents it launched are too (in case a PostToolUse
        // got lost or the launch was denied).
        for (const a of s.agents) if (a.state === 'running' && !a.background && !a.parent) finishAgent(s, a)
        if (fresh) Object.assign(s, { state: 'done', tool: null, hint: '', lastMessage: p.last_message || null })
        onAttention({ kind: 'done', project: s.project })
        break
      case 'PermissionRequest':
        enterWaiting(s, p)
        request(p, s, reply, onGone)
        break
    }
    changed()
  }

  // ---- Subagents ----
  // Each entry: { key, id (agent_id once known), toolUseId, parent (agent_id of the subagent that
  // launched it, null for the main thread), description, type, background, state: 'running' | 'done',
  // startedAt, endedAt, currentTool, hint, lastAt }. Linking, in order of trust: tool_use_id (PreToolUse
  // and PostToolUse of the Agent tool), tool_response.agentId (PostToolUse), agent_id (SubagentStart,
  // SubagentStop, tool hooks inside the subagent), and as a last resort the oldest running entry not
  // linked yet. The handlers return true when something on screen changed.

  function publicAgent({ toolUseId, lastAt, parent, ...a }) {
    return a
  }

  function addAgent(s, fields) {
    const now = Date.now()
    const a = {
      key: fields.toolUseId || agentKey(fields.id) || crypto.randomUUID(),
      id: agentKey(fields.id),
      toolUseId: fields.toolUseId || null,
      parent: fields.parent || null,
      description: fields.description || fields.type || 'Agent',
      type: fields.type || null,
      background: !!fields.background,
      state: 'running',
      startedAt: now,
      endedAt: null,
      currentTool: null,
      hint: '',
      lastAt: now
    }
    s.agents.push(a)
    pruneAgents(s, now)
    return a
  }

  function finishAgent(s, a) {
    if (a.state === 'done') return false
    Object.assign(a, { state: 'done', endedAt: Date.now(), currentTool: null, hint: '' })
    // Foreground subagents it launched can't outlive it.
    if (a.id) for (const c of s.agents) if (c.parent === a.id && !c.background) finishAgent(s, c)
    return true
  }

  // Claude Code also runs internal agents (prompt suggestions, /btw). Their SubagentStart/SubagentStop
  // carry an empty agent_type, or the session's own --agent type; they are never shown.
  const internalType = (s, type) => !type || type === s.agentType

  const byId = (s, id) => (id ? s.agents.find((a) => a.id === id) : undefined)
  const byToolUse = (s, t) => (t ? s.agents.find((a) => a.toolUseId === t) : undefined)
  // Oldest first: subagents start in the order they were launched.
  const oldestUnlinked = (s, type) =>
    s.agents.find((a) => a.state === 'running' && !a.id && (!type || !a.type || a.type === type))

  // Gives `a` the agent_id `id`. If another entry was linked to it by a wrong guess, they swap ids (and
  // what was learned from that id's events).
  function link(s, a, id) {
    if (!id || a.id === id) return
    const other = byId(s, id)
    if (other) {
      const { currentTool, hint } = other
      Object.assign(other, { id: a.id, currentTool: a.currentTool, hint: a.hint })
      Object.assign(a, { currentTool, hint })
    }
    a.id = id
  }

  // PreToolUse of the Agent tool, from the main thread or from inside a subagent.
  function agentLaunch(s, p) {
    if (byToolUse(s, p.tool_use_id)) return false
    const sa = p.subagent || {}
    addAgent(s, {
      toolUseId: p.tool_use_id,
      parent: agentKey(p.agent_id),
      description: sa.description,
      type: sa.type,
      background: sa.background
    })
    return true
  }

  // PostToolUse of the Agent tool: "completed" when a foreground run finished, "async_launched" when it
  // went to the background (at launch, or moved there mid-run) and keeps running.
  function agentReturned(s, p) {
    const sa = p.subagent || {}
    const id = agentKey(sa.agent_id)
    const a =
      byToolUse(s, p.tool_use_id) ||
      byId(s, id) ||
      s.agents.find((x) => x.state === 'running' && !x.id && !x.background && !x.toolUseId)
    if (!a) return false
    link(s, a, id)
    a.lastAt = Date.now()
    if (sa.status === 'async_launched' || (!sa.status && a.background)) {
      const was = a.background
      a.background = true
      return !was
    }
    return finishAgent(s, a)
  }

  function agentStarted(s, p) {
    const id = agentKey(p.agent_id)
    if (!id) return false
    s.sawSubagentStart = true
    let a = byId(s, id)
    if (a) {
      a.lastAt = Date.now()
      if (a.state === 'running') return false
      // Resumed (SendMessage to a finished subagent, or a teammate handling a new message).
      Object.assign(a, { state: 'running', startedAt: Date.now(), endedAt: null })
      return true
    }
    if (internalType(s, p.agent_type)) return false
    a = oldestUnlinked(s, p.agent_type) || oldestUnlinked(s)
    if (a) a.id = id
    // No Agent tool call seen (an agent-team teammate, or the PreToolUse got lost).
    else a = addAgent(s, { id, type: p.agent_type, description: p.agent_type })
    if (!a.type) a.type = p.agent_type
    a.lastAt = Date.now()
    return true
  }

  function agentStopped(s, p) {
    const id = agentKey(p.agent_id)
    let a = byId(s, id)
    if (!a) {
      if (internalType(s, p.agent_type)) return false
      a = oldestUnlinked(s, p.agent_type)
      if (!a) return false
      if (id) a.id = id
    }
    return finishAgent(s, a)
  }

  // A tool event from inside a subagent: shows what that subagent is doing.
  function agentToolEvent(s, p) {
    let visible = false
    // The main thread can't be stuck while its subagents still report.
    if (s.state === 'stale') {
      s.state = 'working'
      visible = true
    }
    // A subagent's permission prompt was answered in the terminal: back to what the main thread was doing.
    if (s.state === 'waiting' && s.resumeState && !hasApproval(s.id)) {
      s.state = s.resumeState
      s.resumeState = null
      visible = true
    }
    const id = agentKey(p.agent_id)
    let a = byId(s, id)
    // Without SubagentStart (hooks installed before it was added) the only safe guess is a lone
    // unlinked subagent.
    if (!a && !s.sawSubagentStart) {
      const open = s.agents.filter((x) => x.state === 'running' && !x.id)
      if (open.length === 1) {
        a = open[0]
        a.id = id
      }
    }
    if (!a || a.state !== 'running') return visible
    a.lastAt = Date.now()
    if (p.event !== 'PreToolUse') return visible
    const tool = p.tool_name || null
    const hint = p.hint || ''
    if (a.currentTool === tool && a.hint === hint) return visible
    Object.assign(a, { currentTool: tool, hint })
    return true
  }

  // Remembers what the main thread was doing when a subagent's prompt made the session wait, so
  // answering it doesn't turn a finished session into "working".
  function enterWaiting(s, p) {
    if (s.state !== 'waiting') s.resumeState = p.agent_id && s.state !== 'stale' ? s.state : null
    s.state = 'waiting'
  }

  // Drops finished subagents after AGENT_KEEP_MS and keeps the list at MAX_AGENTS (oldest finished
  // first). Returns true if any went.
  function pruneAgents(s, now) {
    const before = s.agents.length
    s.agents = s.agents.filter((a) => a.state !== 'done' || now - a.endedAt < AGENT_KEEP_MS)
    while (s.agents.length > MAX_AGENTS) {
      const i = s.agents.findIndex((a) => a.state === 'done')
      s.agents.splice(i >= 0 ? i : 0, 1)
    }
    return s.agents.length !== before
  }

  // One timer for the next finished subagent to drop; none while nothing is finished.
  function scheduleAgentExpiry() {
    let next = Infinity
    for (const s of sessions.values())
      for (const a of s.agents) if (a.state === 'done') next = Math.min(next, a.endedAt + AGENT_KEEP_MS)
    if (agentTimer && agentTimerAt === next) return
    clearTimeout(agentTimer)
    agentTimer = null
    agentTimerAt = next
    if (next === Infinity) return
    agentTimer = setTimeout(() => {
      agentTimer = null
      agentTimerAt = Infinity
      const now = Date.now()
      let any = false
      for (const s of sessions.values()) if (pruneAgents(s, now)) any = true
      if (any) changed()
      else scheduleAgentExpiry()
    }, Math.max(50, next - Date.now()))
    agentTimer.unref?.()
  }

  function request(p, s, reply, onGone) {
    const cfg = getConfig()
    if (!cfg.approvalsEnabled) return reply(null)
    const id = crypto.randomUUID()
    const timeoutMs = Math.max(10, cfg.approvalTimeoutSec) * 1000
    const a = {
      id,
      sessionId: s.id,
      agent: s.agent,
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

  // decision: 'allow' | 'deny' | null (null = hand the prompt back to the terminal). answers: for
  // AskUserQuestion, the answer per question (see questionAnswers).
  function resolve(id, decision, gone = false, answers = null) {
    const a = approvals.get(id)
    if (!a) return false
    approvals.delete(id)
    clearTimeout(a.timer)
    if (!gone) a.reply(decision, answers)
    const s = sessions.get(a.sessionId)
    if (s && decision) {
      s.state = s.resumeState || 'working'
      s.resumeState = null
    }
    changed()
    return true
  }


  // AskUserQuestion is answered, not just allowed: the island sends the picked option labels per
  // question, in order. Only labels it was shown are accepted, one per single-select question, so the
  // renderer can't make up an answer. Multi-select labels are joined with ", " as Claude Code expects.
  // The relay adds these to the original question input (it has the unclipped copy).
  function questionAnswers(a, picked) {
    const qs = a.input?.questions
    if (!Array.isArray(qs) || !Array.isArray(picked) || picked.length !== qs.length) return null
    const out = []
    for (let i = 0; i < qs.length; i++) {
      const labels = new Set((Array.isArray(qs[i]?.options) ? qs[i].options : []).map((o) => o?.label))
      const p = picked[i]
      if (!Array.isArray(p) || p.length === 0 || (!qs[i].multiSelect && p.length !== 1)) return null
      if (!p.every((l) => typeof l === 'string' && labels.has(l)) || new Set(p).size !== p.length) return null
      out.push(p.join(', '))
    }
    return out
  }

  return {
    handle,
    snapshot,
    decide: (id, decision, picked) => {
      const a = approvals.get(id)
      // A plain "allow" doesn't answer a question (Claude Code would still ask), so only answers count.
      if (a?.tool === 'AskUserQuestion' && decision === 'allow') {
        const answers = questionAnswers(a, picked)
        return answers ? resolve(id, 'allow', false, answers) : false
      }
      return resolve(id, decision === 'allow' || decision === 'deny' ? decision : null)
    },
    releaseAll: () => [...approvals.keys()].forEach((id) => resolve(id, null))
  }
}
