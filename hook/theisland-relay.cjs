#!/usr/bin/env node
// TheIsland hook relay.
//
// Claude Code runs this for each hook event (registered in ~/.claude/settings.json by the
// installer). It reads the event JSON from stdin and forwards a trimmed copy to the TheIsland app
// over 127.0.0.1, authenticated with the token in %APPDATA%\TheIsland\relay.json.
//
// Rules:
// - If the app is not running (no relay.json, connection refused, any error) it exits 0 with no
//   output, so Claude Code behaves exactly as if this hook did not exist.
// - For PermissionRequest it waits for the user's Allow/Deny in the island. If the island answers
//   "no decision" (timeout, approvals off, user picked "Terminal"), it prints nothing and Claude
//   Code shows its normal terminal prompt.
// - It never writes anything to disk and never sends prompt text.
'use strict'

const fs = require('fs')
const path = require('path')
const http = require('http')
const os = require('os')

const startedAt = Date.now()
const dir = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'TheIsland')
const MAX_STDIN = 4 * 1024 * 1024
const MAX_FIELD = 4000

function quit() {
  process.exit(0)
}

let conn
try {
  conn = JSON.parse(fs.readFileSync(path.join(dir, 'relay.json'), 'utf8'))
  if (!conn || typeof conn.port !== 'number' || typeof conn.token !== 'string') quit()
} catch {
  quit()
}

// Never hang Claude Code if stdin is not closed for some reason.
const stdinGuard = setTimeout(quit, 3000)
const chunks = []
let size = 0
process.stdin.on('data', (c) => {
  size += c.length
  if (size > MAX_STDIN) quit()
  chunks.push(c)
})
process.stdin.on('error', quit)
process.stdin.on('end', () => {
  clearTimeout(stdinGuard)
  let input
  try {
    // Strip a UTF-8 BOM (Windows PowerShell adds one when piping).
    input = JSON.parse(Buffer.concat(chunks).toString('utf8').replace(/^﻿/, ''))
  } catch {
    quit()
  }
  send(trim(input))
})

function clip(s, n) {
  return typeof s === 'string' && s.length > n ? s.slice(0, n) + ' ...[truncated]' : s
}

function clipObject(obj) {
  if (!obj || typeof obj !== 'object') return obj
  const out = Array.isArray(obj) ? [] : {}
  for (const [k, v] of Object.entries(obj)) {
    out[k] = typeof v === 'string' ? clip(v, MAX_FIELD) : v && typeof v === 'object' ? clipObject(v) : v
  }
  return out
}

// A one-line hint of what a tool is doing, for the status view.
function toolHint(name, ti) {
  if (!ti || typeof ti !== 'object') return ''
  const v = ti.command || ti.file_path || ti.notebook_path || ti.url || ti.pattern || ti.query || ti.description || ''
  if (typeof v !== 'string') return ''
  const s = ti.file_path || ti.notebook_path ? path.basename(v) : v
  return clip(s.replace(/\s+/g, ' '), 120)
}

// A short one-line label (subagent description, agent type). Never the prompt.
function label(s, n = 60) {
  if (typeof s !== 'string') return undefined
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > n ? t.slice(0, n - 3) + '...' : t
}

// The tool that spawns subagents: "Agent" now, "Task" in older Claude Code versions.
const isAgentTool = (name) => name === 'Agent' || name === 'Task'

// Keep only what the island shows. Prompt text and tool output are dropped here.
function trim(e) {
  const ev = e.hook_event_name
  const out = {
    ts: startedAt,
    event: ev,
    session_id: e.session_id,
    cwd: e.cwd,
    permission_mode: e.permission_mode,
    // Set when the hook fired inside a subagent (or on SubagentStart/SubagentStop).
    agent_id: e.agent_id,
    agent_type: label(e.agent_type),
    // The process that ran this hook: Claude Code. Lets the app notice when it's gone.
    pid: process.ppid
  }
  if (ev === 'SessionStart') {
    out.source = e.source
    out.model = e.model
    out.session_title = e.session_title
  } else if (ev === 'UserPromptSubmit') {
    out.session_title = e.session_title
  } else if (ev === 'PreToolUse' || ev === 'PostToolUse') {
    out.tool_name = e.tool_name
    out.tool_use_id = e.tool_use_id
    out.hint = toolHint(e.tool_name, e.tool_input)
    if (isAgentTool(e.tool_name)) {
      // Subagent launch: only the short label and type, never tool_input.prompt.
      const ti = e.tool_input && typeof e.tool_input === 'object' ? e.tool_input : {}
      out.hint = label(ti.description) || ''
      out.subagent = { description: label(ti.description), type: label(ti.subagent_type), background: ti.run_in_background === true }
      if (ev === 'PostToolUse') {
        // "completed" (foreground finished) or "async_launched" (now in the background). No content.
        const r = e.tool_response && typeof e.tool_response === 'object' ? e.tool_response : {}
        out.subagent.status = typeof r.status === 'string' ? r.status : undefined
        out.subagent.agent_id = typeof r.agentId === 'string' ? r.agentId : undefined
      }
    }
  } else if (ev === 'PermissionRequest') {
    out.tool_name = e.tool_name
    out.tool_input = clipObject(e.tool_input)
  } else if (ev === 'Notification') {
    out.notification_type = e.notification_type
    out.message = clip(e.message, 300)
  } else if (ev === 'Stop') {
    out.last_message = clip(e.last_assistant_message, 200)
  } else if (ev === 'SessionEnd') {
    out.reason = e.reason
  }
  return out
}

function send(payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8')
  const waitForDecision = payload.event === 'PermissionRequest'
  const req = http.request(
    {
      host: '127.0.0.1',
      port: conn.port,
      method: 'POST',
      path: '/event',
      headers: {
        'content-type': 'application/json',
        'content-length': body.length,
        'x-island-token': conn.token
      }
    },
    (res) => {
      const parts = []
      res.on('data', (c) => parts.push(c))
      res.on('end', () => {
        if (!waitForDecision || res.statusCode !== 200) quit()
        let reply
        try {
          reply = JSON.parse(Buffer.concat(parts).toString('utf8'))
        } catch {
          quit()
        }
        printDecision(reply && reply.decision)
      })
      res.on('error', quit)
    }
  )
  req.on('error', quit)
  // Status events must be quick. Approvals wait for the user; the app enforces its own timeout,
  // and this guard stays under the hook timeout set by the installer (300 s).
  req.setTimeout(waitForDecision ? 290000 : 1500, () => {
    req.destroy()
    quit()
  })
  req.end(body)
}

function printDecision(d) {
  let decision
  if (d === 'allow') decision = { behavior: 'allow' }
  else if (d === 'deny') decision = { behavior: 'deny', message: 'Denied by the user from TheIsland.' }
  else quit()
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision } }),
    quit
  )
}
