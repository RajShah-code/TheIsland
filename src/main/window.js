// The island window: one frameless, transparent, always-on-top window touching the top edge of the
// primary display, centred. It is sized for the expanded island; the renderer draws the notch, and the
// rest of the window lets clicks through. The window ignores the mouse completely (no forwarding:
// Windows UIPI drops forwarded moves over elevated windows, and forwarding every move was costly);
// pointer.js polls the cursor and tells the renderer where it is. The mouse is turned on only while the
// island is open and the pointer is on it. focusable:false: no focus steal.
import path from 'node:path'
import { app, BrowserWindow, screen, shell } from 'electron'

export const WIDTH = 820
export const HEIGHT = 420

function position(win) {
  const { bounds } = screen.getPrimaryDisplay()
  win.setBounds({
    x: Math.round(bounds.x + (bounds.width - WIDTH) / 2),
    y: bounds.y,
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
  win.setIgnoreMouseEvents(true)
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
