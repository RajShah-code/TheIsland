// Tray menu: update notice, Settings window, hide switch, approvals switch, hook install/remove (with the diff shown
// first), calendar URL, quit. Everything else lives in the settings window (settings-window.js).
import { app, dialog, Menu, nativeImage, Tray } from 'electron'
import {
  applyPlan,
  bundledRelayPath,
  installRelayFile,
  isInstalled,
  isUpToDate,
  planInstall,
  planUninstall
} from '../shared/hooks-installer.mjs'
import { hasCalendarUrl, removeCalendarUrl, setCalendarFromClipboard } from './calendar-url'
import { getSettings, updateSettings } from './config'
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

function shortDiff(diff) {
  const lines = diff.split('\n')
  const keep = new Set()
  lines.forEach((l, i) => {
    if (!l.startsWith('  ')) for (let k = i - 1; k <= i + 1; k++) keep.add(k)
  })
  return lines.filter((_, i) => keep.has(i)).join('\n')
}

export function createTray({
  onConfigChanged,
  onCalendarChanged,
  onOpenSettings,
  isHidden,
  getUpdate,
  onOpenDownload,
  onToggleHidden,
  onQuit,
  hideShortcut
}) {
  const tray = new Tray(trayIcon())
  tray.setToolTip('TheIsland')

  async function installHooks() {
    try {
      const plan = planInstall()
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
      installRelayFile(bundledRelayPath(app.getAppPath()))
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

  async function setCalendar() {
    const r = await setCalendarFromClipboard()
    if (!r.ok) return dialog.showErrorBox('TheIsland', r.error)
    onCalendarChanged()
  }

  function refresh() {
    const cfg = getSettings()
    const installed = isInstalled()
    const update = getUpdate()
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'TheIsland', enabled: false },
        // A newer GitHub release (updates.js): opens the website's Download page.
        ...(update ? [{ label: `Update available: version ${update.version}...`, click: onOpenDownload }] : []),
        { type: 'separator' },
        { label: 'Settings...', click: onOpenSettings },
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
            updateSettings({ approvalsEnabled: item.checked })
            onConfigChanged()
          }
        },
        // An older install misses newer events; installing again shows the diff and adds them.
        ...(installed && !isUpToDate() ? [{ label: 'Update Claude Code hooks...', click: installHooks }] : []),
        installed
          ? { label: 'Remove Claude Code hooks...', click: removeHooks }
          : { label: 'Install Claude Code hooks...', click: installHooks },
        { type: 'separator' },
        { label: 'Set calendar from copied iCal address', click: setCalendar },
        {
          label: 'Remove calendar',
          enabled: hasCalendarUrl(),
          click: () => {
            removeCalendarUrl()
            onCalendarChanged()
          }
        },
        { type: 'separator' },
        { label: 'Quit TheIsland', click: () => (onQuit ? onQuit() : app.quit()) }
      ])
    )
  }

  tray.on('click', () => tray.popUpContextMenu())
  refresh()
  return { refresh, destroy: () => tray.destroy() }
}
