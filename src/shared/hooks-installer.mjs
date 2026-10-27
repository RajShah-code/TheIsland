// Safe installer for TheIsland's coding agent hooks: Claude Code, Codex, Gemini CLI, Antigravity, Cursor
// and Copilot CLI (AGENTS below), each in its own file.
//
// - Reads the agent's settings or hooks file and refuses to do anything if it can't be parsed or has an
//   unexpected shape. It never "fixes" a file it doesn't understand.
// - Only adds/removes hook handlers that run theisland-relay.exe (or the theisland-relay.cjs of older
//   versions). Everything else in the file (other settings, other hooks) is left exactly as it was.
// - Writes a timestamped backup next to the file before every change, writes atomically and
//   reads the result back to check it.
// - planInstall/planUninstall return the before/after text and a diff without writing, so the
//   change can be shown first.
//
// Node built-ins only, so the CLI (scripts/hooks.mjs) and the Electron app share it.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// The relay is a small exe (hook/TheIslandRelay.cs), so the hooks don't need Node.js. Older versions
// ran theisland-relay.cjs with node.exe; those entries are still recognised so installing replaces them.
export const RELAY_FILE = 'theisland-relay.exe'
const OLD_RELAY_FILES = ['theisland-relay.cjs']

// Events the island listens to. Status events are async so Claude Code never waits for them.
// PermissionRequest is sync: Claude Code waits for the user's answer in the island.
export const EVENTS = [
  { name: 'SessionStart', async: true, timeout: 5 },
  { name: 'UserPromptSubmit', async: true, timeout: 5 },
  { name: 'PreToolUse', async: true, timeout: 5 },
  { name: 'PostToolUse', async: true, timeout: 5 },
  { name: 'Notification', async: true, timeout: 5 },
  { name: 'SubagentStart', async: true, timeout: 5 },
  { name: 'SubagentStop', async: true, timeout: 5 },
  { name: 'Stop', async: true, timeout: 5 },
  { name: 'SessionEnd', async: true, timeout: 5 },
  { name: 'PermissionRequest', async: false, timeout: 300 }
]

export function defaultSettingsPath() {
  return path.join(os.homedir(), '.claude', 'settings.json')
}

const inHome = (...parts) => path.join(os.homedir(), ...parts)
const exists = (...parts) => fs.existsSync(inHome(...parts))

// The relay as a command line, for agents that take one string. Quoted only when the path has a space:
// a bare path runs the same in cmd, PowerShell and bash, a quoted one not in PowerShell.
function commandLine(relayPath, args) {
  const exe = /\s/.test(relayPath) ? `"${relayPath}"` : relayPath
  return [exe, ...args].join(' ')
}

// How each agent's file holds hooks:
//   grouped  hooks: { Event: [{ matcher?, hooks: [handler] }] }   Claude Code, Codex, Gemini CLI
//   flat     hooks: { event: [handler] }, version: 1              Cursor, Copilot CLI
//   named    { theisland: { Event: [handler or { matcher, hooks }] } }   Antigravity
// `found` is a folder the agent makes on first use. Only Claude Code and Codex get approvals (sync
// PermissionRequest); everything else is a quick status event the agent doesn't need to wait on.
export const AGENTS = {
  claude: {
    name: 'Claude Code',
    file: () => defaultSettingsPath(),
    found: () => exists('.claude'),
    layout: 'grouped',
    events: EVENTS,
    // args makes Claude Code spawn the exe directly (exec form). Without it the command goes through Git
    // Bash or PowerShell, which is slower and mangles the backslashes in the path.
    handler: (relay, ev) => ({ type: 'command', command: relay, args: ['--hook'], timeout: ev.timeout, ...(ev.async ? { async: true } : {}) })
  },
  codex: {
    name: 'Codex',
    file: () => inHome('.codex', 'hooks.json'),
    found: () => exists('.codex'),
    layout: 'grouped',
    events: [
      { name: 'SessionStart', timeout: 5 },
      { name: 'UserPromptSubmit', timeout: 5 },
      { name: 'PreToolUse', timeout: 5 },
      { name: 'PostToolUse', timeout: 5 },
      { name: 'Stop', timeout: 5 },
      { name: 'PermissionRequest', timeout: 300 }
    ],
    handler: (relay, ev) => ({ type: 'command', command: commandLine(relay, ['--hook', '--agent', 'codex']), timeout: ev.timeout }),
    note: 'Codex runs hooks from version 0.114 on. Older versions need [features] hooks = true in ~/.codex/config.toml.'
  },
  gemini: {
    name: 'Gemini CLI',
    file: () => inHome('.gemini', 'settings.json'),
    // ~/.gemini is shared with Antigravity, so look for Gemini CLI's own files.
    found: () => ['settings.json', 'oauth_creds.json', 'google_accounts.json'].some((f) => exists('.gemini', f)),
    layout: 'grouped',
    // Gemini CLI's timeouts are in milliseconds.
    events: ['SessionStart', 'SessionEnd', 'BeforeAgent', 'AfterAgent', 'BeforeTool', 'AfterTool', 'Notification'].map((name) => ({ name, timeout: 5000 })),
    handler: (relay, ev) => ({ type: 'command', command: commandLine(relay, ['--hook', '--agent', 'gemini']), timeout: ev.timeout })
  },
  antigravity: {
    name: 'Antigravity',
    file: () => inHome('.gemini', 'config', 'hooks.json'),
    found: () => ['antigravity', 'antigravity-ide', 'antigravity-cli', 'config'].some((d) => exists('.gemini', d)),
    layout: 'named',
    // No PreToolUse: Antigravity runs hooks in line and may block a tool when one fails.
    // Its events don't carry their name, so each entry passes it.
    events: [
      { name: 'PreInvocation', timeout: 10 },
      { name: 'PostToolUse', timeout: 10, matcher: '*' },
      { name: 'Stop', timeout: 10 }
    ],
    handler: (relay, ev) => ({
      type: 'command',
      command: commandLine(relay, ['--hook', '--agent', 'antigravity', '--event', ev.name]),
      timeout: ev.timeout
    })
  },
  cursor: {
    name: 'Cursor',
    file: () => inHome('.cursor', 'hooks.json'),
    found: () => exists('.cursor'),
    layout: 'flat',
    // Only hooks that can't gate anything: Cursor treats a before* hook's empty reply in odd ways.
    events: ['beforeSubmitPrompt', 'afterShellExecution', 'afterMCPExecution', 'afterFileEdit', 'stop'].map((name) => ({ name })),
    handler: (relay) => ({ command: commandLine(relay, ['--hook', '--agent', 'cursor']) })
  },
  copilot: {
    name: 'Copilot CLI',
    // A file of our own: Copilot CLI reads every *.json in ~/.copilot/hooks.
    file: () => inHome('.copilot', 'hooks', 'theisland.json'),
    found: () => exists('.copilot'),
    layout: 'flat',
    events: ['sessionStart', 'sessionEnd', 'userPromptSubmitted', 'preToolUse', 'postToolUse', 'agentStop'].map((name) => ({ name })),
    // Copilot's events don't carry their name either.
    handler: (relay, ev) => {
      const args = ['--hook', '--agent', 'copilot', '--event', ev.name]
      return { type: 'command', powershell: `& '${relay}' ${args.join(' ')}`, bash: `'${relay.replace(/\\/g, '/')}' ${args.join(' ')}`, timeoutSec: 5 }
    }
  }
}
export const AGENT_IDS = Object.keys(AGENTS)
const NAMED_KEY = 'theisland'

function target(agent) {
  const t = AGENTS[agent || 'claude']
  if (!t) throw new RefuseError(`Unknown agent "${agent}".`)
  return t
}

// %USERPROFILE%\.theisland holds everything: settings, relay.json, the hook script, the log and
// Chromium's own files. Not %APPDATA%: a process started from a packaged (MSIX) app such as the
// Claude desktop app gets a private copy of AppData, so an island started from there and one
// started at login would each see different settings, and hooks run by the desktop app would read
// a stale relay.json. The user profile itself is shared by both.
export function dataDir() {
  return path.join(os.homedir(), '.theisland')
}

// Where older versions kept their data. Only read for the one-time move and old hook entries.
export function legacyDataDir() {
  return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'TheIsland')
}

export function relayInstallPath() {
  return path.join(dataDir(), RELAY_FILE)
}

// The relay exe that ships with the app (built into resources/ by scripts/build-helper.mjs). In a
// packaged app it sits in app.asar.unpacked, since an exe can't run from inside the asar archive.
export function bundledRelayPath(appRoot) {
  return path.join(appRoot, 'resources', RELAY_FILE).replace('app.asar', 'app.asar.unpacked')
}

// Copies the relay into the data folder so the hook path stays stable when the app is updated or
// moved. Only rewrites when the content changed. A copy that is running (a hook in flight, or one
// waiting for an approval) can't be overwritten but can be renamed, so it is moved aside first and
// cleaned up on a later run.
export function installRelayFile(sourcePath) {
  const src = fs.readFileSync(sourcePath)
  const dest = relayInstallPath()
  const dir = path.dirname(dest)
  fs.mkdirSync(dir, { recursive: true })
  for (const f of fs.readdirSync(dir)) {
    if (f.startsWith(RELAY_FILE + '.old-')) fs.rm(path.join(dir, f), { force: true }, () => {})
  }
  let same = false
  try {
    same = fs.readFileSync(dest).equals(src)
  } catch {}
  if (same) return dest
  const tmp = dest + '.new'
  fs.writeFileSync(tmp, src)
  try {
    fs.renameSync(tmp, dest)
  } catch {
    fs.renameSync(dest, dest + '.old-' + Date.now())
    fs.renameSync(tmp, dest)
  }
  return dest
}

// A handler that runs the relay: as `command` (+ args), or inside a command line (other agents, and
// Copilot's powershell/bash fields).
function isOurHandler(h) {
  if (!h || typeof h !== 'object') return false
  const parts = [h.command, h.powershell, h.bash, ...(Array.isArray(h.args) ? h.args : [])]
  return parts.some(
    (p) =>
      typeof p === 'string' &&
      [RELAY_FILE, ...OLD_RELAY_FILES].some((f) => {
        const s = p.replace(/\\/g, '/').toLowerCase()
        return s.endsWith('/' + f) || s.includes('/' + f + ' ') || s.includes('/' + f + '"') || s.includes('/' + f + "'")
      })
  )
}

// Ours and running the relay in the data folder (not an old copy).
function isCurrentHandler(h) {
  if (!isOurHandler(h)) return false
  const relay = relayInstallPath().replace(/\\/g, '/').toLowerCase()
  return [h.command, h.powershell].some((p) => typeof p === 'string' && p.replace(/\\/g, '/').toLowerCase().includes(relay))
}

class RefuseError extends Error {}

function readSettings(file, layout = 'grouped') {
  let text = null
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch (e) {
    if (e.code !== 'ENOENT') throw new RefuseError(`Can't read ${file}: ${e.message}`)
  }
  if (text === null || text.trim() === '') return { text: text ?? '', data: {}, existed: text !== null }
  let data
  try {
    data = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text)
  } catch (e) {
    throw new RefuseError(`${file} is not valid JSON (${e.message}). Not touching it.`)
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new RefuseError(`${file} is not a JSON object. Not touching it.`)
  }
  if (layout === 'named') {
    const ours = data[NAMED_KEY]
    if (ours !== undefined && (!ours || typeof ours !== 'object' || Array.isArray(ours))) {
      throw new RefuseError(`"${NAMED_KEY}" in ${file} has an unexpected shape. Not touching it.`)
    }
  } else if (data.hooks !== undefined) {
    if (!data.hooks || typeof data.hooks !== 'object' || Array.isArray(data.hooks)) {
      throw new RefuseError(`"hooks" in ${file} has an unexpected shape. Not touching it.`)
    }
    for (const [ev, groups] of Object.entries(data.hooks)) {
      if (!Array.isArray(groups)) throw new RefuseError(`hooks.${ev} is not a list. Not touching it.`)
      for (const g of groups) {
        if (!g || typeof g !== 'object' || (g.hooks !== undefined && !Array.isArray(g.hooks))) {
          throw new RefuseError(`hooks.${ev} has an entry with an unexpected shape. Not touching it.`)
        }
      }
    }
  }
  return { text, data, existed: true }
}

// Removes our handlers; drops groups/events that only contained ours.
function stripOurs(data, layout = 'grouped') {
  if (layout === 'named') {
    const had = data[NAMED_KEY] !== undefined
    delete data[NAMED_KEY]
    return had ? 1 : 0
  }
  if (layout === 'flat') {
    if (!data.hooks) return 0
    let removed = 0
    for (const ev of Object.keys(data.hooks)) {
      const kept = data.hooks[ev].filter((h) => !isOurHandler(h))
      removed += data.hooks[ev].length - kept.length
      if (kept.length > 0) data.hooks[ev] = kept
      else delete data.hooks[ev]
    }
    return removed
  }
  if (!data.hooks) return 0
  let removed = 0
  for (const ev of Object.keys(data.hooks)) {
    const groups = []
    for (const g of data.hooks[ev]) {
      if (!Array.isArray(g.hooks)) {
        groups.push(g)
        continue
      }
      const kept = g.hooks.filter((h) => !isOurHandler(h))
      removed += g.hooks.length - kept.length
      if (kept.length === g.hooks.length) groups.push(g)
      else if (kept.length > 0) groups.push({ ...g, hooks: kept })
    }
    if (groups.length > 0) data.hooks[ev] = groups
    else delete data.hooks[ev]
  }
  if (Object.keys(data.hooks).length === 0) delete data.hooks
  return removed
}

function serialize(data, originalText) {
  const eol = originalText && originalText.includes('\r\n') ? '\r\n' : '\n'
  return JSON.stringify(data, null, 2).replace(/\n/g, eol) + eol
}

function plan(file, mutate, layout) {
  const { text, data } = readSettings(file, layout)
  const next = structuredClone(data)
  mutate(next)
  const after = serialize(next, text)
  // Compare against a normalised "before" so the diff shows only real changes, not formatting.
  const before = text.trim() === '' ? '' : serialize(data, text)
  return { file, layout, before: text, after, changed: before !== after, diff: lineDiff(before, after) }
}

// agent: a key of AGENTS (claude when missing). settingsPath: another file to work on (tests, the CLI).
export function planInstall({ agent = 'claude', settingsPath, relayPath = relayInstallPath() } = {}) {
  const t = target(agent)
  return plan(
    settingsPath || t.file(),
    (data) => {
      stripOurs(data, t.layout)
      if (t.layout === 'named') {
        data[NAMED_KEY] = Object.fromEntries(
          t.events.map((ev) => {
            const h = t.handler(relayPath, ev)
            return [ev.name, ev.matcher ? [{ matcher: ev.matcher, hooks: [h] }] : [h]]
          })
        )
        return
      }
      if (t.layout === 'flat' && data.version === undefined) data.version = 1
      data.hooks = data.hooks || {}
      for (const ev of t.events) {
        const h = t.handler(relayPath, ev)
        data.hooks[ev.name] = [...(data.hooks[ev.name] || []), t.layout === 'flat' ? h : { hooks: [h] }]
      }
    },
    t.layout
  )
}

export function planUninstall({ agent = 'claude', settingsPath } = {}) {
  const t = target(agent)
  return plan(settingsPath || t.file(), (data) => stripOurs(data, t.layout), t.layout)
}

// Our handlers per event name, whatever the layout.
function ourHandlers(data, layout) {
  const out = {}
  const events = layout === 'named' ? data[NAMED_KEY] || {} : data.hooks || {}
  for (const [ev, entries] of Object.entries(events)) {
    if (!Array.isArray(entries)) continue
    out[ev] = entries.flatMap((g) => (Array.isArray(g?.hooks) ? g.hooks : [g])).filter(isOurHandler)
  }
  return out
}

export function isInstalled(settingsPath, agent = 'claude') {
  const t = target(agent)
  try {
    const { data } = readSettings(settingsPath || t.file(), t.layout)
    return Object.values(ourHandlers(data, t.layout)).some((list) => list.length > 0)
  } catch {
    return false
  }
}

// True when every event the agent needs has our handler and it runs the relay exe in the data folder.
// An install from an older version can miss some (SubagentStart and SubagentStop were added later),
// point at the old %APPDATA% copy or run the old Node script; installing again fixes all three.
export function isUpToDate(settingsPath, agent = 'claude') {
  const t = target(agent)
  try {
    const { data } = readSettings(settingsPath || t.file(), t.layout)
    const ours = ourHandlers(data, t.layout)
    return t.events.every((ev) => (ours[ev.name] || []).some(isCurrentHandler))
  } catch {
    return false
  }
}

function stamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

// Applies a plan from planInstall/planUninstall. Re-reads the file first and refuses if it
// changed since the plan was made (so the user approves exactly what gets written).
export function applyPlan(p) {
  const { text } = readSettings(p.file, p.layout)
  if (text !== p.before) throw new RefuseError(`${p.file} changed since the diff was shown. Run it again.`)
  if (!p.changed) return { written: false, backup: null }
  fs.mkdirSync(path.dirname(p.file), { recursive: true })
  let backup = null
  if (p.before !== '') {
    backup = `${p.file}.theisland-backup-${stamp()}`
    fs.writeFileSync(backup, p.before, { flag: 'wx' })
  }
  const tmp = `${p.file}.theisland-tmp`
  fs.writeFileSync(tmp, p.after)
  JSON.parse(fs.readFileSync(tmp, 'utf8'))
  fs.renameSync(tmp, p.file)
  return { written: true, backup }
}

// Minimal line diff (LCS) for showing the change. Settings files are small.
export function lineDiff(a, b) {
  const x = a === '' ? [] : a.replace(/\r\n/g, '\n').split('\n')
  const y = b === '' ? [] : b.replace(/\r\n/g, '\n').split('\n')
  const n = x.length
  const m = y.length
  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = x[i] === y[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }
  const out = []
  let i = 0
  let j = 0
  while (i < n || j < m) {
    if (i < n && j < m && x[i] === y[j]) {
      out.push('  ' + x[i])
      i++
      j++
    } else if (j < m && (i === n || lcs[i][j + 1] >= lcs[i + 1][j])) {
      out.push('+ ' + y[j++])
    } else {
      out.push('- ' + x[i++])
    }
  }
  return out.join('\n')
}

export { RefuseError }
