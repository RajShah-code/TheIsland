import { execFile } from 'node:child_process'
import path from 'node:path'
import { app, globalShortcut, ipcMain, shell } from 'electron'
import { installRelayFile } from '../shared/hooks-installer.mjs'
import { createClaudeHub } from './claude'
import { startCalendar } from './calendar'
import { hasCalendarUrl, removeCalendarUrl, setCalendarFromClipboard } from './calendar-url'
import { getSecret, getSettings, updateSettings } from './config'
import { goodbyeText, greetingText } from './greeting'
import { log } from './log'
import { startHelper } from './helper'
import { startRelayServer } from './relay-server'
import { createSettingsWindowManager } from './settings-window'
import { createTray } from './tray'
import { createPointerTracker } from './pointer'
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
const GREET_DELAY_MS = 1200
const GOODBYE_MS = 1800

// Start with Windows. Run unpackaged (`electron .`), the login item must carry the app path, and
// reading it back has to use the same path and args.
const LOGIN_NAME = 'TheIsland'
const APPROVED_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run'
function loginItemOptions() {
  return { name: LOGIN_NAME, ...(app.isPackaged ? {} : { path: process.execPath, args: [app.getAppPath()] }) }
}
// Windows skips a Run entry that has no "approved" mark (seen on 2026-10-22: Spotify, Chrome and Drive
// ran at login, the island did not). Electron removes the mark instead of writing one, so write the
// enabled value ourselves. `force` is for the user's own switch; at startup we only fill in a missing
// mark and leave one the user turned off in Task Manager alone.
function approveLoginItem(force) {
  const add = () =>
    execFile('reg', ['add', APPROVED_KEY, '/v', LOGIN_NAME, '/t', 'REG_BINARY', '/d', '02' + '0'.repeat(22), '/f'], (e) =>
      e ? log('could not approve the login item', e.message) : log('login item approved')
    )
  if (force) return add()
  execFile('reg', ['query', APPROVED_KEY, '/v', LOGIN_NAME], (e) => e && add())
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
    if (on) approveLoginItem(true)
    log(on ? 'start with windows on' : 'start with windows off')
  } catch (e) {
    log('could not change the login item', e.message)
  }
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

// Windows Settings pages the System tab may open ("open <name>"). Nothing else reaches openExternal.
const SETTINGS_PAGES = {
  accessibility: 'ms-settings:easeofaccess',
  nearby: 'ms-settings:crossdevice',
  focus: 'ms-settings:quiethours',
  energy: 'ms-settings:batterysaver',
  nightlight: 'ms-settings:nightlight',
  display: 'ms-settings:display',
  sound: 'ms-settings:sound',
  network: 'ms-settings:network',
  bluetooth: 'ms-settings:bluetooth',
  settings: 'ms-settings:'
}

function openSettingsPage(name) {
  if (typeof name !== 'string' || !Object.hasOwn(SETTINGS_PAGES, name)) return
  shell.openExternal(SETTINGS_PAGES[name]).catch((e) => log('could not open', name, e.message))
}

function start() {
  log('starting')
  let win = null
  let hidden = false
  let tray = null
  let media = null
  let pointer = null
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
    pointer?.setEnabled(!on)
    log(on ? 'island hidden' : 'island shown')
    tray?.refresh()
  }
  // Returns false when there is no visible island to say it on.
  let saidGoodbye = false
  const sayGoodbye = () => {
    if (hidden || !win || win.isDestroyed()) return false
    if (!saidGoodbye) send('island:attention', { kind: 'bye', text: goodbyeText() })
    saidGoodbye = true
    return true
  }

  // Fill in a missing "approved" mark for a login item made before that fix.
  if (startsWithWindows()) approveLoginItem(false)

  // Keep the copy the hooks run up to date with this version of the relay.
  try {
    installRelayFile(path.join(app.getAppPath(), 'hook', 'theisland-relay.cjs'))
  } catch (e) {
    log('could not copy relay', e.message)
  }

  const settingsWin = createSettingsWindowManager()
  const hub = createClaudeHub({
    getConfig: getSettings,
    closedHosts: (pids) => (media ? media.closedHosts(pids) : Promise.resolve(new Set())),
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
    onQuit: () => {
      // Quit from the tray: show the goodbye for a moment first.
      if (!sayGoodbye()) return app.quit()
      setTimeout(() => app.quit(), GOODBYE_MS)
    },
    hideShortcut: HIDE_SHORTCUT
  })

  win = createIslandWindow()
  // Hello once the page is up (a moment later, so the island is on screen and listening).
  win.webContents.once('did-finish-load', () =>
    setTimeout(() => send('island:attention', { kind: 'greet', text: greetingText() }), GREET_DELAY_MS)
  )
  // Windows is shutting down, restarting or signing out: say goodbye while it closes apps.
  win.on('query-session-end', () => sayGoodbye())
  win.on('session-end', () => log('windows session ending'))
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
  // Cursor polling instead of forwarded mouse moves (see pointer.js). A reloading or crashed page
  // starts out not interactive, so hand the mouse back for it too.
  pointer = createPointerTracker(win, (p) => send('island:pointer', p))
  if (hidden) pointer.setEnabled(false)
  const dropInteractive = () => pointer.setInteractive(false)
  win.webContents.on('did-start-loading', dropInteractive)
  win.webContents.on('render-process-gone', dropInteractive)
  win.on('closed', () => pointer.stop())

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
    if (!fromIsland(e) || typeof cmd !== 'string') return
    // Settings pages open here (only the whitelisted ones); everything else goes to the helper.
    if (cmd === 'open') return openSettingsPage(value)
    media.system.command(cmd, value)
  })
  ipcMain.on('island:system-watch', (e, on) => {
    if (!fromIsland(e)) return
    systemWanted = on === true
    updateSystemWatch()
  })
  ipcMain.on('island:interactive', (e, on) => {
    if (fromIsland(e)) pointer.setInteractive(on === true)
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
    pointer?.stop()
    tray.destroy()
    log('quit')
  })
  app.on('window-all-closed', () => app.quit())
}
