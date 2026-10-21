// Tray menu: the only "settings" in v1. Hide switch, approvals switch, hook install/remove (with the
// diff shown first), calendar URL, quit.
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { app, clipboard, dialog, Menu, nativeImage, Tray } from 'electron'
import {
  applyPlan,
  installRelayFile,
  isInstalled,
  planInstall,
  planUninstall,
  relayInstallPath
} from '../shared/hooks-installer.mjs'
import { getConfig, setConfig, setSecret } from './config'
import { log } from './log'

// A small white pill drawn in code, so there is no icon file to ship.
function trayIcon() {
  const s = 32
  const buf = Buffer.alloc(s * s * 4)
  const r = 7
  const cy = s / 2
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const cx = Math.min(Math.max(x + 0.5, 4 + r), s - 4 - r)
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
      const a = Math.max(0, Math.min(1, r + 0.5 - d))
      const i = (y * s + x) * 4
      buf[i] = buf[i + 1] = buf[i + 2] = Math.round(255 * a)
      buf[i + 3] = Math.round(255 * a)
    }
  }
  return nativeImage.createFromBitmap(buf, { width: s, height: s, scaleFactor: 2 })
}

function systemNode() {
  const r = spawnSync('where', ['node'], { encoding: 'utf8', windowsHide: true })
  const first = (r.stdout || '').split(/\r?\n/).find((l) => l.toLowerCase().endsWith('node.exe'))
  return first || null
}

function shortDiff(diff) {
  const lines = diff.split('\n')
  const keep = new Set()
  lines.forEach((l, i) => {
    if (!l.startsWith('  ')) for (let k = i - 1; k <= i + 1; k++) keep.add(k)
  })
  return lines.filter((_, i) => keep.has(i)).join('\n')
}

export function createTray({ onConfigChanged, onCalendarChanged, isHidden, onToggleHidden, hideShortcut }) {
  const tray = new Tray(trayIcon())
  tray.setToolTip('TheIsland')

  async function installHooks() {
    try {
      const nodePath = systemNode()
      if (!nodePath) {
        dialog.showErrorBox('TheIsland', 'Node.js was not found on PATH. The hooks need it to run.')
        return
      }
      const plan = planInstall({ nodePath, relayPath: relayInstallPath() })
      if (!plan.changed) {
        dialog.showMessageBox({ message: 'Claude Code hooks are already installed.' })
        return
      }
      const { response } = await dialog.showMessageBox({
        type: 'question',
        buttons: ['Install', 'Cancel'],
        defaultId: 1,
        cancelId: 1,
        message: 'Add TheIsland hooks to ' + plan.file + '?',
        detail:
          'A backup is saved next to the file first. Your other settings and hooks stay as they are.\n\n' +
          shortDiff(plan.diff)
      })
      if (response !== 0) return
      installRelayFile(path.join(app.getAppPath(), 'hook', 'theisland-relay.cjs'))
      const r = applyPlan(plan)
      log('hooks installed')
      dialog.showMessageBox({ message: 'Hooks installed.', detail: 'Backup: ' + (r.backup || 'none (new file)') })
    } catch (e) {
      dialog.showErrorBox('TheIsland', 'Hooks not installed: ' + e.message)
    }
    refresh()
  }

  async function removeHooks() {
    try {
      const plan = planUninstall()
      if (!plan.changed) return
      const { response } = await dialog.showMessageBox({
        type: 'question',
        buttons: ['Remove', 'Cancel'],
        defaultId: 1,
        cancelId: 1,
        message: 'Remove TheIsland hooks from ' + plan.file + '?',
        detail: 'Only TheIsland entries are removed. A backup is saved first.'
      })
      if (response !== 0) return
      const r = applyPlan(plan)
      log('hooks removed')
      dialog.showMessageBox({ message: 'Hooks removed.', detail: 'Backup: ' + r.backup })
    } catch (e) {
      dialog.showErrorBox('TheIsland', 'Hooks not removed: ' + e.message)
    }
    refresh()
  }

  async function setCalendarFromClipboard() {
    // readText() returns a Promise in this Electron version.
    const url = String((await clipboard.readText()) || '').trim()
    let ok = false
    try {
      const u = new URL(url)
      ok = u.protocol === 'https:' && /\.ics$/i.test(u.pathname)
    } catch {}
    if (!ok) {
      dialog.showErrorBox(
        'TheIsland',
        'Copy the "Secret address in iCal format" from Google Calendar settings first. ' +
          'It starts with https:// and ends with .ics.'
      )
      return
    }
    try {
      setSecret('calendarUrl', url)
    } catch (e) {
      dialog.showErrorBox('TheIsland', 'Calendar not saved: ' + e.message)
      return
    }
    clipboard.clear()
    log('calendar url set')
    onCalendarChanged()
    refresh()
  }

  function refresh() {
    const cfg = getConfig()
    const installed = isInstalled()
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'TheIsland', enabled: false },
        { type: 'separator' },
        {
          label: 'Hide the island',
          type: 'checkbox',
          checked: isHidden(),
          accelerator: hideShortcut,
          registerAccelerator: false,
          click: onToggleHidden
        },
        { type: 'separator' },
        {
          label: 'Answer Claude Code approvals in the island',
          type: 'checkbox',
          checked: cfg.approvalsEnabled,
          click: (item) => {
            setConfig({ approvalsEnabled: item.checked })
            onConfigChanged()
            refresh()
          }
        },
        installed
          ? { label: 'Remove Claude Code hooks...', click: removeHooks }
          : { label: 'Install Claude Code hooks...', click: installHooks },
        { type: 'separator' },
        { label: 'Set calendar from copied iCal address', click: setCalendarFromClipboard },
        {
          label: 'Remove calendar',
          enabled: !!cfg.calendarUrl,
          click: () => {
            setSecret('calendarUrl', null)
            onCalendarChanged()
            refresh()
          }
        },
        { type: 'separator' },
        { label: 'Quit TheIsland', click: () => app.quit() }
      ])
    )
  }

  tray.on('click', () => tray.popUpContextMenu())
  refresh()
  return { refresh, destroy: () => tray.destroy() }
}
