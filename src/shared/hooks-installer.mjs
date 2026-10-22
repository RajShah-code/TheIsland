// Safe installer for TheIsland's Claude Code hooks.
//
// - Reads ~/.claude/settings.json and refuses to do anything if it can't be parsed or has an
//   unexpected shape. It never "fixes" a file it doesn't understand.
// - Only adds/removes hook handlers whose args point at theisland-relay.cjs. Everything else in
//   the file (other settings, other hooks) is left exactly as it was.
// - Writes a timestamped backup next to the file before every change, writes atomically and
//   reads the result back to check it.
// - planInstall/planUninstall return the before/after text and a diff without writing, so the
//   change can be shown first.
//
// Node built-ins only, so the CLI (scripts/hooks.mjs) and the Electron app share it.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const RELAY_FILE = 'theisland-relay.cjs'

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

// Copies the relay into the data folder so the hook path stays stable even if this project folder
// moves. Only rewrites when the content changed. Hook entries from older versions point at the old
// copy in %APPDATA%, so that one is kept current too until the hooks are updated.
export function installRelayFile(sourcePath) {
  const src = fs.readFileSync(sourcePath)
  const write = (dest) => {
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    let same = false
    try {
      same = fs.readFileSync(dest).equals(src)
    } catch {}
    if (!same) fs.writeFileSync(dest, src)
  }
  const legacy = path.join(legacyDataDir(), RELAY_FILE)
  if (fs.existsSync(legacy)) write(legacy)
  const dest = relayInstallPath()
  write(dest)
  return dest
}

function isOurHandler(h) {
  if (!h || typeof h !== 'object') return false
  const parts = [h.command, ...(Array.isArray(h.args) ? h.args : [])]
  return parts.some((p) => typeof p === 'string' && p.replace(/\\/g, '/').endsWith('/' + RELAY_FILE))
}

class RefuseError extends Error {}

function readSettings(file) {
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
  if (data.hooks !== undefined) {
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
function stripOurs(data) {
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

function plan(file, mutate) {
  const { text, data } = readSettings(file)
  const next = structuredClone(data)
  mutate(next)
  const after = serialize(next, text)
  // Compare against a normalised "before" so the diff shows only real changes, not formatting.
  const before = text.trim() === '' ? '' : serialize(data, text)
  return { file, before: text, after, changed: before !== after, diff: lineDiff(before, after) }
}

export function planInstall({ settingsPath = defaultSettingsPath(), nodePath, relayPath }) {
  if (!nodePath || !relayPath) throw new Error('nodePath and relayPath are required')
  return plan(settingsPath, (data) => {
    stripOurs(data)
    data.hooks = data.hooks || {}
    for (const ev of EVENTS) {
      const handler = { type: 'command', command: nodePath, args: [relayPath], timeout: ev.timeout }
      if (ev.async) handler.async = true
      data.hooks[ev.name] = [...(data.hooks[ev.name] || []), { hooks: [handler] }]
    }
  })
}

export function planUninstall({ settingsPath = defaultSettingsPath() } = {}) {
  return plan(settingsPath, (data) => {
    stripOurs(data)
  })
}

export function isInstalled(settingsPath = defaultSettingsPath()) {
  try {
    const { data } = readSettings(settingsPath)
    return Object.values(data.hooks || {}).some((groups) =>
      groups.some((g) => Array.isArray(g.hooks) && g.hooks.some(isOurHandler))
    )
  } catch {
    return false
  }
}

// True when every event in EVENTS has our handler and it runs the relay in the data folder. An
// install from an older version can miss some (SubagentStart and SubagentStop were added later) or
// point at the old %APPDATA% copy; installing again fixes both.
export function isUpToDate(settingsPath = defaultSettingsPath()) {
  const current = (h) =>
    isOurHandler(h) && Array.isArray(h.args) && h.args.some((a) => path.resolve(String(a)) === relayInstallPath())
  try {
    const { data } = readSettings(settingsPath)
    const hooks = data.hooks || {}
    return EVENTS.every((ev) =>
      (hooks[ev.name] || []).some((g) => Array.isArray(g.hooks) && g.hooks.some(current))
    )
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
  const { text } = readSettings(p.file)
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
