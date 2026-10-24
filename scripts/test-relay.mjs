// Tests resources/theisland-relay.exe against a fake island server (npm test). The relay finds the
// server through %USERPROFILE%\.theisland\relay.json, so each run gets a temporary USERPROFILE and the
// real island is never contacted.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const exe = path.join(root, 'resources', 'theisland-relay.exe')
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'theisland-relay-test-'))
const relayJson = path.join(home, '.theisland', 'relay.json')
fs.mkdirSync(path.dirname(relayJson))
const token = 'token-' + Math.random().toString(16).slice(2)

let decision = null
let answers = null
let requests = []
const server = http.createServer((req, res) => {
  const chunks = []
  req.on('data', (c) => chunks.push(c))
  req.on('end', () => {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    requests.push({ headers: req.headers, body })
    res.writeHead(200, { 'content-type': 'application/json' })
    const perm = body.event === 'PermissionRequest'
    res.end(JSON.stringify({ decision: perm ? decision : null, ...(perm && answers ? { answers } : {}) }))
  })
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
fs.writeFileSync(relayJson, JSON.stringify({ port: server.address().port, token, pid: 1 }))

function relay(input) {
  requests = []
  return new Promise((resolve) => {
    const p = spawn(exe, ['--hook'], { env: { ...process.env, USERPROFILE: home }, windowsHide: true })
    let out = ''
    p.stdout.on('data', (c) => (out += c))
    p.on('close', (code) => resolve({ code, out, sent: requests.map((r) => r.body), requests }))
    p.stdin.end(typeof input === 'string' ? input : JSON.stringify(input))
  })
}

// Runs one event and returns the single payload it sent.
async function send(event) {
  const r = await relay(event)
  assert.equal(r.code, 0)
  assert.equal(r.out, '', 'status events print nothing')
  assert.equal(r.sent.length, 1)
  const { headers, body } = r.requests[0]
  assert.equal(headers['x-island-token'], token)
  assert.equal(headers.origin, undefined)
  assert.equal(body.pid, process.pid, 'pid is the process that ran the hook')
  assert.equal(typeof body.ts, 'number')
  return body
}

const tests = []
const test = (name, fn) => tests.push([name, fn])
const long = 'x'.repeat(5000)

test('session start keeps the session fields', async () => {
  const b = await send({ hook_event_name: 'SessionStart', session_id: 's', cwd: 'D:/proj', source: 'startup', model: 'm', permission_mode: 'default' })
  assert.deepEqual([b.event, b.session_id, b.cwd, b.source, b.model, b.permission_mode], ['SessionStart', 's', 'D:/proj', 'startup', 'm', 'default'])
})

test('prompt text is never sent', async () => {
  const b = await send({ hook_event_name: 'UserPromptSubmit', session_id: 's', prompt: 'SECRET', session_title: 'T' })
  assert.equal(b.session_title, 'T')
  assert.ok(!JSON.stringify(b).includes('SECRET'))
})

test('tool hint is one line, file paths are reduced to the name', async () => {
  assert.equal((await send({ hook_event_name: 'PreToolUse', session_id: 's', tool_name: 'Bash', tool_input: { command: 'npm  run\n build' } })).hint, 'npm run build')
  assert.equal((await send({ hook_event_name: 'PreToolUse', session_id: 's', tool_name: 'Edit', tool_input: { file_path: 'C:\\a\\b\\file.js', old_string: 'SECRET' } })).hint, 'file.js')
  assert.equal((await send({ hook_event_name: 'PreToolUse', session_id: 's', tool_name: 'X', tool_input: { command: 42 } })).hint, '')
})

test('subagents send a short label, never the prompt or output', async () => {
  const pre = await send({ hook_event_name: 'PreToolUse', session_id: 's', tool_name: 'Agent', tool_input: { description: '  Explore   the code base for every single place that does a thing  ', subagent_type: 'Explore', prompt: 'SECRET', run_in_background: true } })
  assert.deepEqual(pre.subagent, { description: 'Explore the code base for every single place that does a ...', type: 'Explore', background: true })
  const post = await send({ hook_event_name: 'PostToolUse', session_id: 's', tool_name: 'Task', tool_input: { description: 'Short' }, tool_response: { status: 'completed', agentId: 'a1', content: 'SECRET' } })
  assert.deepEqual(post.subagent, { description: 'Short', background: false, status: 'completed', agent_id: 'a1' })
  const bash = await send({ hook_event_name: 'PostToolUse', session_id: 's', tool_name: 'Bash', tool_input: { command: 'ls' }, tool_response: { stdout: 'SECRET' } })
  assert.ok(!JSON.stringify([pre, post, bash]).includes('SECRET'))
})

test('long messages are clipped', async () => {
  assert.equal((await send({ hook_event_name: 'Notification', session_id: 's', message: long })).message, 'x'.repeat(300) + ' ...[truncated]')
  assert.equal((await send({ hook_event_name: 'Stop', session_id: 's', last_assistant_message: long })).last_message, 'x'.repeat(200) + ' ...[truncated]')
})

const perm = {
  hook_event_name: 'PermissionRequest',
  session_id: 's',
  tool_name: 'Bash',
  tool_input: { command: long, nested: [long, 1.5, 12345678901234567890, null, true], text: 'emoji 😀 lone \ud800 ctrl \u0001 "q" \\' }
}

test('approvals print the decision, nothing when there is none', async () => {
  const expected = {
    allow: { behavior: 'allow' },
    deny: { behavior: 'deny', message: 'Denied by the user from TheIsland.' }
  }
  for (const d of ['allow', 'deny', null]) {
    decision = d
    const r = await relay('\ufeff' + JSON.stringify(perm))
    assert.equal(r.code, 0)
    if (d) assert.deepEqual(JSON.parse(r.out), { hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: expected[d] } })
    else assert.equal(r.out, '')
    const ti = r.sent[0].tool_input
    assert.equal(ti.command, 'x'.repeat(4000) + ' ...[truncated]')
    assert.deepEqual(ti.nested, ['x'.repeat(4000) + ' ...[truncated]', 1.5, 12345678901234567890, null, true])
    assert.equal(ti.text, perm.tool_input.text)
  }
})

test('questions answered in the island come back as updatedInput', async () => {
  const longQuestion = 'Which one? ' + long
  const ask = {
    hook_event_name: 'PermissionRequest',
    session_id: 's',
    tool_name: 'AskUserQuestion',
    tool_input: {
      questions: [
        { question: longQuestion, header: 'Pick', multiSelect: false, options: [{ label: 'A', description: 'first' }, { label: 'B' }] },
        { question: 'Which extras?', header: 'Extras', multiSelect: true, options: [{ label: 'X' }, { label: 'Y' }] }
      ]
    }
  }
  decision = 'allow'
  answers = ['A', 'X, Y']
  const r = await relay(ask)
  assert.equal(r.sent[0].tool_input.questions[0].question.length, 4000 + ' ...[truncated]'.length, 'the island gets a clipped copy')
  assert.deepEqual(JSON.parse(r.out).hookSpecificOutput.decision, {
    behavior: 'allow',
    updatedInput: { ...ask.tool_input, answers: { [longQuestion]: 'A', 'Which extras?': 'X, Y' } }
  })
  // Answers that don't fit the questions: nothing printed, so the terminal asks.
  answers = ['A']
  assert.equal((await relay(ask)).out, '')
  answers = null
})

test('bad input sends nothing', async () => {
  for (const bad of ['not json', '', '[1,2]', '{"a":1} x', '{"a":01}']) {
    const r = await relay(bad)
    assert.deepEqual([r.code, r.out, r.sent.length], [0, '', 0], bad)
  }
})

test('exits quietly when the app is not running', async () => {
  fs.unlinkSync(relayJson)
  const r = await relay(perm)
  assert.deepEqual([r.code, r.out, r.sent.length], [0, '', 0])
})

let failed = 0
for (const [name, fn] of tests) {
  try {
    await fn()
    console.log('ok   ' + name)
  } catch (e) {
    failed++
    console.log('FAIL ' + name + '\n     ' + e.message.split('\n').join('\n     '))
  }
}
server.close()
fs.rmSync(home, { recursive: true, force: true })
process.exit(failed ? 1 : 0)
