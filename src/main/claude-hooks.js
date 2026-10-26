// Connecting Claude Code: installs or removes TheIsland's hooks in ~/.claude/settings.json, always
// after a dialog that shows the change. Used by the tray, the settings window and the one-time offer
// on first start (offerClaudeHooks), so all three ask the same way.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { app, dialog } from 'electron'
import {
  applyPlan,
  bundledRelayPath,
  EVENTS,
  installRelayFile,
  isInstalled,
  isUpToDate,
  planInstall,
  planUninstall,
  relayInstallPath
} from '../shared/hooks-installer.mjs'
import { getConfig, setConfig } from './config'
import { log } from './log'

// Claude Code keeps its settings in %USERPROFILE%\.claude, so the folder means it has been used here.
const claudeFound = () => fs.existsSync(path.join(os.homedir(), '.claude'))

export function claudeHooksStatus() {
  const installed = isInstalled()
  return { found: claudeFound(), installed, upToDate: installed && isUpToDate() }
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
function changeText(plan) {
  const diff = shortDiff(plan.diff)
  if (diff.split('\n').length <= MAX_DIFF_LINES) return diff
  return (
    'It adds one hook for each of these Claude Code events: ' +
    EVENTS.map((e) => e.name).join(', ') +
    '. Each one runs:\n' +
    relayInstallPath() +
    ' --hook'
  )
}

// `parent`: the settings window when asked from there, so the dialog sits on it. `intro`: the first
// start's offer, which explains what connecting does before the diff. Returns true when installed.
export async function installClaudeHooks({ parent, intro } = {}) {
  const show = (opts) => (parent ? dialog.showMessageBox(parent, opts) : dialog.showMessageBox(opts))
  try {
    const plan = planInstall()
    if (!plan.changed) {
      if (!intro) await show({ message: 'Claude Code hooks are already installed.' })
      return true
    }
    const { response } = await show({
      type: 'question',
      title: 'TheIsland',
      buttons: intro ? ['Install hooks', 'Not now'] : ['Install', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
      message: intro ? 'Connect Claude Code to TheIsland?' : 'Add TheIsland hooks to ' + plan.file + '?',
      detail:
        (intro
          ? 'Claude Code is on this PC. With its hooks installed, its permission prompts and questions open in the island so you can answer them there, and your sessions show live.\n\n' +
            'This adds TheIsland hooks to ' + plan.file + '. '
          : '') +
        'A backup is saved next to the file first. Your other settings and hooks stay as they are.' +
        (intro ? ' You can remove them any time from the tray or Settings.' : '') +
        '\n\n' +
        changeText(plan)
    })
    if (response !== 0) return false
    installRelayFile(bundledRelayPath(app.getAppPath()))
    const r = applyPlan(plan)
    log('hooks installed')
    show({
      message: 'Hooks installed.',
      detail:
        'New Claude Code sessions now show in the island; ones already open need a restart.\n\nBackup: ' +
        (r.backup || 'none (new file)')
    })
    return true
  } catch (e) {
    dialog.showErrorBox('TheIsland', 'Hooks not installed: ' + e.message)
    return false
  }
}

export async function removeClaudeHooks({ parent } = {}) {
  const show = (opts) => (parent ? dialog.showMessageBox(parent, opts) : dialog.showMessageBox(opts))
  try {
    const plan = planUninstall()
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
    log('hooks removed')
    show({ message: 'Hooks removed.', detail: 'Backup: ' + r.backup })
  } catch (e) {
    dialog.showErrorBox('TheIsland', 'Hooks not removed: ' + e.message)
  }
}

// Once per user, on a start where Claude Code is on the PC but not connected: ask. Answered either way,
// it never asks again (the tray and Settings stay available). Returns true when hooks were installed.
export async function offerClaudeHooks() {
  if (getConfig().claudeHooksOffered) return false
  const { found, installed } = claudeHooksStatus()
  if (!found || installed) return false
  setConfig({ claudeHooksOffered: true })
  return installClaudeHooks({ intro: true })
}
