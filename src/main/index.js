import path from 'node:path'
import { app, globalShortcut, ipcMain } from 'electron'
import { installRelayFile } from '../shared/hooks-installer.mjs'
import { createClaudeHub } from './claude'
import { startCalendar } from './calendar'
import { hasCalendarUrl, removeCalendarUrl, setCalendarFromClipboard } from './calendar-url'
import { getSecret, getSettings, updateSettings } from './config'
import { log } from './log'
import { startHelper } from './helper'
import { startRelayServer } from './relay-server'
import { createSettingsWindowManager } from './settings-window'
import { createTray } from './tray'
import { createIslandWindow } from './window'

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.setAppUserModelId('TheIsland')
  // Smaller footprint: the island has no use for these.
  app.commandLine.appendSwitch('disable-features', 'SpareRendererForSitePerProcess,MediaRouter')
  // A small 2D overlay doesn't need the GPU; software rendering saves ~100 MB.
  if (!process.env.ISLAND_GPU) app.disableHardwareAcceleration()
  app.whenReady().then(start)
}

// Hides the whole island until pressed again (also in the tray menu).
const HIDE_SHORTCUT = 'Control+Alt+I'

// Start with Windows. Run unpackaged (`electron .`), the login item must carry the app path, and
// reading it back has to use the same path and args.
function loginItemOptions() {
  return app.isPackaged ? {} : { path: process.execPath, args: [app.getAppPath()] }
}
function startsWithWindows() {
  try {
    return app.getLoginItemSettings(loginItemOptions()).openAtLogin === true
  } catch {
    return false
  }
}
function setStartWithWindows(on) {
  try {
    app.setLoginItemSettings({ ...loginItemOptions(), openAtLogin: on })
    log(on ? 'start with windows on' : 'start with windows off')
  } catch (e) {
    log('could not change the login item', e.message)
  }
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

function start() {
  log('starting')
  let win = null
  let hidden = false
  let tray = null
  let media = null
  // The renderer asks for System tab stats only while that tab is on screen; a hidden island never.
  let systemWanted = false
  const updateSystemWatch = () => media?.system.setWatch(systemWanted && !hidden)
  const send = (channel, data) => {
    if (win && !win.isDestroyed()) win.webContents.send(channel, data)
  }
  const setHidden = (on) => {
    hidden = on
    if (win && !win.isDestroyed()) {
      if (on) win.hide()
      else {
        win.showInactive()
        win.setAlwaysOnTop(true, 'screen-saver')
      }
    }
    updateSystemWatch()
    log(on ? 'island hidden' : 'island shown')
    tray?.refresh()
  }

  // Keep the copy the hooks run up to date with this version of the relay.
  try {
    installRelayFile(path.join(app.getAppPath(), 'hook', 'theisland-relay.cjs'))
  } catch (e) {
    log('could not copy relay', e.message)
  }

  const settingsWin = createSettingsWindowManager()
  const hub = createClaudeHub({
    getConfig: getSettings,
    onChange: (snap) => send('island:claude', snap),
    onAttention: (a) => {
      // An approval needs an answer, so it brings a hidden island back.
      if (hidden && a.kind === 'approval') setHidden(false)
      if (win && !win.isDestroyed()) win.setAlwaysOnTop(true, 'screen-saver')
      send('island:attention', a)
    }
  })
  const server = startRelayServer({ dir: app.getPath('userData'), onEvent: hub.handle })
  media = startHelper({
    onMedia: (m) => send('island:media', m),
    onFullscreen: (on) => send('island:fullscreen', on),
    onSystem: (s) => send('island:system', s)
  })
  const calendar = startCalendar({
    getUrl: () => getSecret('calendarUrl'),
    onChange: (c) => send('island:calendar', c)
  })
  // The island gets the validated settings (no secrets). The settings window also gets a few facts it
  // shows: the real login item state, whether a calendar is set (never its address) and the version.
  const settings = () => getSettings()
  const settingsView = () => {
    const s = getSettings()
    return {
      ...s,
      island: { ...s.island, startWithWindows: startsWithWindows() },
      calendarConfigured: hasCalendarUrl(),
      version: app.getVersion()
    }
  }
  // One path for every change, from the tray or the settings window: apply, push live, sync both UIs.
  const settingsChanged = () => {
    if (!getSettings().approvalsEnabled) hub.releaseAll()
    send('island:settings', settings())
    if (settingsWin.isOpen()) settingsWin.send('settings:changed', settingsView())
    tray?.refresh()
  }
  const calendarChanged = () => {
    calendar.refresh()
    if (settingsWin.isOpen()) settingsWin.send('settings:changed', settingsView())
    tray?.refresh()
  }
  tray = createTray({
    onConfigChanged: settingsChanged,
    onCalendarChanged: calendarChanged,
    onOpenSettings: () => settingsWin.open(),
    isHidden: () => hidden,
    onToggleHidden: () => setHidden(!hidden),
    hideShortcut: HIDE_SHORTCUT
  })

  win = createIslandWindow()
  if (!globalShortcut.register(HIDE_SHORTCUT, () => setHidden(!hidden)))
    log('could not register', HIDE_SHORTCUT, '(another app has it)')
  const fromIsland = (e) => win && !win.isDestroyed() && e.sender === win.webContents
  // A reloading or crashed page can't say the System tab closed, so stop the stats for it.
  const dropSystemWatch = () => {
    systemWanted = false
    updateSystemWatch()
  }
  win.webContents.on('did-start-loading', dropSystemWatch)
  win.webContents.on('render-process-gone', dropSystemWatch)

  ipcMain.handle('island:state', (e) =>
    fromIsland(e)
      ? {
          claude: hub.snapshot(),
          media: media.get(),
          calendar: calendar.get(),
          settings: settings(),
          fullscreen: media.isFullscreen(),
          system: media.system.get()
        }
      : null
  )
  ipcMain.on('island:decide', (e, id, decision) => {
    if (fromIsland(e) && typeof id === 'string') hub.decide(id, decision)
  })
  ipcMain.on('island:media', (e, cmd) => {
    if (fromIsland(e)) media.command(cmd)
  })
  ipcMain.on('island:system', (e, cmd, value) => {
    if (fromIsland(e) && typeof cmd === 'string') media.system.command(cmd, value)
  })
  ipcMain.on('island:system-watch', (e, on) => {
    if (!fromIsland(e)) return
    systemWanted = on === true
    updateSystemWatch()
  })
  ipcMain.on('island:interactive', (e, on) => {
    if (fromIsland(e)) win.setIgnoreMouseEvents(!on, { forward: true })
  })
  ipcMain.on('island:open-settings', (e) => {
    if (fromIsland(e)) settingsWin.open()
  })

  // Settings window. Every handler checks the sender, so the island page can't call these.
  ipcMain.handle('settings:get', (e) => (settingsWin.isSender(e) ? settingsView() : null))
  ipcMain.handle('settings:set', (e, patch) => {
    if (!settingsWin.isSender(e) || !isPlainObject(patch)) return null
    const login = isPlainObject(patch.island) ? patch.island.startWithWindows : undefined
    if (typeof login === 'boolean' && login !== startsWithWindows()) setStartWithWindows(login)
    updateSettings(patch)
    settingsChanged()
    return settingsView()
  })
  ipcMain.handle('settings:calendar-set', async (e) => {
    if (!settingsWin.isSender(e)) return null
    const r = await setCalendarFromClipboard()
    if (r.ok) calendarChanged()
    return { ok: r.ok, error: r.error || null, view: settingsView() }
  })
  ipcMain.handle('settings:calendar-remove', (e) => {
    if (!settingsWin.isSender(e)) return null
    removeCalendarUrl()
    calendarChanged()
    return settingsView()
  })

  app.on('before-quit', () => {
    globalShortcut.unregisterAll()
    hub.releaseAll()
    server.close()
    media.stop()
    tray.destroy()
    log('quit')
  })
  app.on('window-all-closed', () => app.quit())
}
