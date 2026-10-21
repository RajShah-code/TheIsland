// The island window: one frameless, transparent, always-on-top window at the top centre of the
// primary display. It is sized for the expanded island; the renderer only draws the pill, and the
// rest of the window lets clicks through (setIgnoreMouseEvents with forward, toggled by the
// renderer when the pointer enters/leaves the pill). focusable:false means it never steals focus.
import path from 'node:path'
import { app, BrowserWindow, screen, shell } from 'electron'

export const WIDTH = 540
export const HEIGHT = 480

function position(win) {
  const { workArea } = screen.getPrimaryDisplay()
  win.setBounds({
    x: Math.round(workArea.x + (workArea.width - WIDTH) / 2),
    y: workArea.y,
    width: WIDTH,
    height: HEIGHT
  })
}

export function createIslandWindow() {
  const win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    thickFrame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false,
    alwaysOnTop: true,
    title: 'TheIsland',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      devTools: !app.isPackaged
    }
  })

  win.setAlwaysOnTop(true, 'screen-saver')
  win.setIgnoreMouseEvents(true, { forward: true })
  position(win)

  // The window only ever shows our own page.
  win.webContents.on('will-navigate', (e) => e.preventDefault())
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })

  const reposition = () => !win.isDestroyed() && position(win)
  screen.on('display-metrics-changed', reposition)
  screen.on('display-added', reposition)
  screen.on('display-removed', reposition)

  win.once('ready-to-show', () => win.showInactive())

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(path.join(__dirname, '../renderer/index.html'))

  return win
}
