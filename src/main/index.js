import path from 'node:path'
import { app, globalShortcut, ipcMain } from 'electron'
import { installRelayFile } from '../shared/hooks-installer.mjs'
import { createClaudeHub } from './claude'
import { startCalendar } from './calendar'
import { getConfig, getSecret } from './config'
import { log } from './log'
import { startHelper } from './helper'
import { startRelayServer } from './relay-server'
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

function start() {
  log('starting')
  let win = null
  let hidden = false
  let tray = null
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
    log(on ? 'island hidden' : 'island shown')
    tray?.refresh()
  }

  // Keep the copy the hooks run up to date with this version of the relay.
  try {
    installRelayFile(path.join(app.getAppPath(), 'hook', 'theisland-relay.cjs'))
  } catch (e) {
    log('could not copy relay', e.message)
  }

  const hub = createClaudeHub({
    getConfig,
    onChange: (snap) => send('island:claude', snap),
    onAttention: (a) => {
      // An approval needs an answer, so it brings a hidden island back.
      if (hidden && a.kind === 'approval') setHidden(false)
      if (win && !win.isDestroyed()) win.setAlwaysOnTop(true, 'screen-saver')
      send('island:attention', a)
    }
  })
  const server = startRelayServer({ dir: app.getPath('userData'), onEvent: hub.handle })
  const media = startHelper({
    onMedia: (m) => send('island:media', m),
    onFullscreen: (on) => send('island:fullscreen', on)
  })
  const calendar = startCalendar({
    getUrl: () => getSecret('calendarUrl'),
    onChange: (c) => send('island:calendar', c)
  })
  const settings = () => ({ approvalsEnabled: getConfig().approvalsEnabled })
  tray = createTray({
    onConfigChanged: () => {
      if (!getConfig().approvalsEnabled) hub.releaseAll()
      send('island:settings', settings())
    },
    onCalendarChanged: () => calendar.refresh(),
    isHidden: () => hidden,
    onToggleHidden: () => setHidden(!hidden),
    hideShortcut: HIDE_SHORTCUT
  })

  win = createIslandWindow()
  if (!globalShortcut.register(HIDE_SHORTCUT, () => setHidden(!hidden)))
    log('could not register', HIDE_SHORTCUT, '(another app has it)')
  const fromIsland = (e) => win && !win.isDestroyed() && e.sender === win.webContents

  ipcMain.handle('island:state', (e) =>
    fromIsland(e)
      ? {
          claude: hub.snapshot(),
          media: media.get(),
          calendar: calendar.get(),
          settings: settings(),
          fullscreen: media.isFullscreen()
        }
      : null
  )
  ipcMain.on('island:decide', (e, id, decision) => {
    if (fromIsland(e) && typeof id === 'string') hub.decide(id, decision)
  })
  ipcMain.on('island:media', (e, cmd) => {
    if (fromIsland(e)) media.command(cmd)
  })
  ipcMain.on('island:interactive', (e, on) => {
    if (fromIsland(e)) win.setIgnoreMouseEvents(!on, { forward: true })
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
