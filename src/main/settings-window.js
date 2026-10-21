// The settings window: a normal framed window with its own page (src/renderer/settings.html) and its
// own preload (src/preload/settings.js). It exists only while open: created on demand, destroyed on
// close, so it costs nothing the rest of the time. Only one at a time.
import path from 'node:path'
import { app, BrowserWindow, shell } from 'electron'

export function createSettingsWindowManager() {
  let win = null

  function open() {
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore()
      win.show()
      // Windows may refuse focus to an app that isn't in front (the island never takes focus);
      // a short trip to the top brings it forward anyway.
      win.setAlwaysOnTop(true)
      win.focus()
      win.setAlwaysOnTop(false)
      return
    }
    win = new BrowserWindow({
      width: 880,
      height: 640,
      minWidth: 720,
      minHeight: 500,
      show: false,
      title: 'TheIsland Settings',
      backgroundColor: '#0b0b0c',
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, '../preload/settings.js'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        spellcheck: false,
        devTools: !app.isPackaged
      }
    })
    win.setMenu(null)

    // The window only ever shows our own page.
    win.webContents.on('will-navigate', (e) => e.preventDefault())
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('https://')) shell.openExternal(url)
      return { action: 'deny' }
    })
    win.once('ready-to-show', () => win && !win.isDestroyed() && win.show())
    win.on('closed', () => {
      win = null
    })

    if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL)
      win.loadURL(process.env.ELECTRON_RENDERER_URL + '/settings.html')
    else win.loadFile(path.join(__dirname, '../renderer/settings.html'))
  }

  return {
    open,
    // True when an IPC message comes from the settings page.
    isSender: (e) => !!win && !win.isDestroyed() && e.sender === win.webContents,
    send: (channel, data) => {
      if (win && !win.isDestroyed()) win.webContents.send(channel, data)
    },
    isOpen: () => !!win && !win.isDestroyed(),
    close: () => win && !win.isDestroyed() && win.destroy()
  }
}
