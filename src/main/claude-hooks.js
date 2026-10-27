// Connecting coding agents: installs or removes TheIsland's hooks in each agent's own file (Claude Code's
// ~/.claude/settings.json, Codex's ~/.codex/hooks.json and so on, see AGENTS in hooks-installer.mjs),
// always after a dialog that shows the change. Used by the tray, the settings window and the one-time
// offer on first start (offerAgentHooks), so all three ask the same way.
import { app, dialog } from 'electron'
import { APPROVAL_AGENTS } from '../shared/agents.mjs'
import {
  AGENTS,
  applyPlan,
  bundledRelayPath,
  installRelayFile,
  isInstalled,
  isUpToDate,
  planInstall,
  planUninstall,
  relayInstallPath
} from '../shared/hooks-installer.mjs'
import { getConfig, setConfig } from './config'
import { log } from './log'

function status(agent) {
  const t = AGENTS[agent]
  const installed = isInstalled(undefined, agent)
  return { found: t.found(), installed, upToDate: installed && isUpToDate(undefined, agent) }
}

export function claudeHooksStatus() {
  return status('claude')
}

// Every agent, for Settings > Coding agents.
export function agentHooksStatus() {
  return Object.fromEntries(Object.keys(AGENTS).map((id) => [id, status(id)]))
}

// Only the changed lines of the diff, with one line of context around each.
function shortDiff(diff) {
  const lines = diff.split('\n')
  const keep = new Set()
  lines.forEach((l, i) => {
    if (!l.startsWith('  ')) for (let k = i - 1; k <= i + 1; k++) keep.add(k)
  })
  return lines.filter((_, i) => keep.has(i)).join('\n')
}

// What the dialog shows of the change: the diff when it is short (an update of older hooks), otherwise
// (a first install, about 150 lines of JSON) what gets added, in words.
const MAX_DIFF_LINES = 24
function changeText(plan, agent) {
  const diff = shortDiff(plan.diff)
  if (diff.split('\n').length <= MAX_DIFF_LINES) return diff
  const t = AGENTS[agent]
  return `It adds one hook for each of these ${t.name} events: ${t.events.map((e) => e.name).join(', ')}. Each one runs:\n${relayInstallPath()}`
}

const what = (agent) =>
  APPROVAL_AGENTS.includes(agent)
    ? 'its permission prompts open in the island so you can answer them there, and your sessions show live'
    : 'your sessions and what they are doing show live in the island'

// `parent`: the settings window when asked from there, so the dialog sits on it. `intro`: the first
// start's offer, which explains what connecting does before the diff. Returns true when installed.
export async function installAgentHooks(agent = 'claude', { parent, intro } = {}) {
  const t = AGENTS[agent]
  const show = (opts) => (parent ? dialog.showMessageBox(parent, opts) : dialog.showMessageBox(opts))
  try {
    const plan = planInstall({ agent })
    if (!plan.changed) {
      if (!intro) await show({ message: `${t.name} hooks are already installed.` })
      return true
    }
    const { response } = await show({
      type: 'question',
      title: 'TheIsland',
      buttons: intro ? ['Install hooks', 'Not now'] : ['Install', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
      message: intro ? `Connect ${t.name} to TheIsland?` : 'Add TheIsland hooks to ' + plan.file + '?',
      detail:
        (intro
          ? `${t.name} is on this PC. With its hooks installed, ${what(agent)}.\n\n` + 'This adds TheIsland hooks to ' + plan.file + '. '
          : '') +
        'A backup is saved next to the file first. Your other settings and hooks stay as they are.' +
        (intro ? ' You can remove them any time from Settings.' : '') +
        (t.note ? '\n\n' + t.note : '') +
        '\n\n' +
        changeText(plan, agent)
    })
    if (response !== 0) return false
    installRelayFile(bundledRelayPath(app.getAppPath()))
    const r = applyPlan(plan)
    log('hooks installed:', agent)
    show({
      message: 'Hooks installed.',
      detail: `New ${t.name} sessions now show in the island; ones already open need a restart.\n\nBackup: ` + (r.backup || 'none (new file)')
    })
    return true
  } catch (e) {
    dialog.showErrorBox('TheIsland', `${t.name} hooks not installed: ` + e.message)
    return false
  }
}

export async function removeAgentHooks(agent = 'claude', { parent } = {}) {
  const show = (opts) => (parent ? dialog.showMessageBox(parent, opts) : dialog.showMessageBox(opts))
  try {
    const plan = planUninstall({ agent })
    if (!plan.changed) return
    const { response } = await show({
      type: 'question',
      title: 'TheIsland',
      buttons: ['Remove', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
      message: 'Remove TheIsland hooks from ' + plan.file + '?',
      detail: 'Only TheIsland entries are removed. A backup is saved first.'
    })
    if (response !== 0) return
    const r = applyPlan(plan)
    log('hooks removed:', agent)
    show({ message: 'Hooks removed.', detail: 'Backup: ' + r.backup })
  } catch (e) {
    dialog.showErrorBox('TheIsland', `${AGENTS[agent].name} hooks not removed: ` + e.message)
  }
}

export const installClaudeHooks = (opts) => installAgentHooks('claude', opts)
export const removeClaudeHooks = (opts) => removeAgentHooks('claude', opts)

// Once per agent, on a start where it is on the PC but not connected: ask, one agent after the other.
// Answered either way, it never asks again for that agent (Settings stays available). Claude Code keeps
// its old flag so people who were asked before aren't asked again. Returns true when any were installed.
export async function offerAgentHooks() {
  const cfg = getConfig()
  const offered = { ...(cfg.agentHooksOffered || {}), ...(cfg.claudeHooksOffered ? { claude: true } : {}) }
  let any = false
  for (const agent of Object.keys(AGENTS)) {
    if (offered[agent]) continue
    const { found, installed } = status(agent)
    if (!found || installed) continue
    offered[agent] = true
    setConfig({ agentHooksOffered: offered, ...(agent === 'claude' ? { claudeHooksOffered: true } : {}) })
    if (await installAgentHooks(agent, { intro: true })) any = true
  }
  return any
}
