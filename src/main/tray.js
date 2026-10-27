// Tray menu: update notice, Settings window, hide switch, approvals switch, hook install/remove
// (claude-hooks.js, which shows the diff first), add an iCal calendar, feedback, quit. Everything else lives in the
// settings window (settings-window.js).
import { app, dialog, Menu, nativeImage, Tray } from 'electron'
import { isInstalled, isUpToDate } from '../shared/hooks-installer.mjs'
import { addCalendarFromClipboard } from './calendar-url'
import { getSettings, updateSettings } from './config'
import { installClaudeHooks, removeClaudeHooks } from './claude-hooks'

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

export function createTray({
  onConfigChanged,
  onCalendarChanged,
  onOpenSettings,
  isHidden,
  getUpdate,
  onOpenDownload,
  onOpenFeedback,
  onToggleHidden,
  onQuit,
  hideShortcut
}) {
  const tray = new Tray(trayIcon())
  tray.setToolTip('TheIsland')

  // onConfigChanged refreshes this menu and the settings window, which shows the hooks too.
  async function installHooks() {
    await installClaudeHooks()
    onConfigChanged()
  }

  async function removeHooks() {
    await removeClaudeHooks()
    onConfigChanged()
  }

  async function addCalendar() {
    const r = await addCalendarFromClipboard()
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
          label: 'Answer agent approvals in the island',
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
        // Other calendars and removing one are in Settings > Calendar.
        { label: 'Add calendar from copied iCal address', click: addCalendar },
        { type: 'separator' },
        { label: 'Send feedback...', click: onOpenFeedback },
        { label: 'Quit TheIsland', click: () => (onQuit ? onQuit() : app.quit()) }
      ])
    )
  }

  tray.on('click', () => tray.popUpContextMenu())
  refresh()
  return { refresh, destroy: () => tray.destroy() }
}
