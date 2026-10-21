// Where the pointer is, for the island page, while the window ignores the mouse.
//
// Why polling and not setIgnoreMouseEvents(true, { forward: true }): forwarded mouse messages are blocked
// by Windows UIPI whenever the window under the pointer belongs to an elevated process (Task Manager,
// anything run as admin), so the pill never faded and the top-edge flick never opened it. Forwarding also
// pushed every mouse move over the whole 820x420 window through main and the renderer (about 15 to 25%
// of a core while the mouse moved up there). screen.getCursorScreenPoint() works over elevated windows
// and costs one cheap call per tick.
//
// Rates: about every 250 ms while the cursor is far away, about every 40 ms while it is within NEAR px of
// the window. The page gets `island:pointer` { x, y, inside: true } (window-relative CSS px) only when the
// point inside the window changed, and one { inside: false } when it leaves. No polling while the island
// is hidden. While the window is interactive the page gets real mouse events instead; then only a slow
// guard runs: if the cursor stays outside the window for GUARD_MS, the mouse is handed back here (stuck
// interactivity would block clicks on whatever is under the island) and the page is told.
import { screen } from 'electron'

const FAR_MS = 250
const NEAR_MS = 40
const NEAR = 40
const GUARD_TICK_MS = 250
const GUARD_MS = 500

export function createPointerTracker(win, send) {
  let enabled = true
  let interactive = false
  let timer = null
  // Last point sent while inside, or null when the page last heard "outside".
  let last = null
  let outsideSince = 0

  // getCursorScreenPoint and getBounds are both in DIP, and the page is at zoom 1, so DIP = CSS px.
  function where() {
    const p = screen.getCursorScreenPoint()
    const b = win.getBounds()
    const x = p.x - b.x
    const y = p.y - b.y
    return {
      x,
      y,
      inside: x >= 0 && y >= 0 && x < b.width && y < b.height,
      near: x >= -NEAR && y >= -NEAR && x < b.width + NEAR && y < b.height + NEAR
    }
  }

  function setIgnore(on) {
    if (!win.isDestroyed()) win.setIgnoreMouseEvents(on)
  }

  function tick() {
    timer = null
    if (!enabled || win.isDestroyed()) return
    const p = where()
    if (interactive) {
      if (p.inside) outsideSince = 0
      else if (!outsideSince) outsideSince = Date.now()
      else if (Date.now() - outsideSince >= GUARD_MS) {
        interactive = false
        setIgnore(true)
        last = null
        send({ inside: false })
        return schedule(NEAR_MS)
      }
      return schedule(GUARD_TICK_MS)
    }
    if (p.inside) {
      if (!last || last.x !== p.x || last.y !== p.y) {
        last = { x: p.x, y: p.y }
        send({ x: p.x, y: p.y, inside: true })
      }
    } else if (last) {
      last = null
      send({ inside: false })
    }
    schedule(p.near ? NEAR_MS : FAR_MS)
  }

  function schedule(ms) {
    clearTimeout(timer)
    timer = setTimeout(tick, ms)
  }

  function restart() {
    clearTimeout(timer)
    timer = null
    if (enabled) schedule(interactive ? GUARD_TICK_MS : NEAR_MS)
  }

  restart()
  return {
    // The page asks for the mouse while the island is open and the pointer is on it.
    setInteractive(on) {
      on = on === true
      setIgnore(!on)
      if (on === interactive) return
      interactive = on
      outsideSince = 0
      // Back from real mouse events: send the next point even if it equals the last polled one.
      last = null
      restart()
    },
    // Hidden island: nothing to track. Also hands the mouse back.
    setEnabled(on) {
      enabled = on === true
      if (!enabled) {
        interactive = false
        setIgnore(true)
        last = null
        // The page resets its own interactive state and ghost on this.
        send({ inside: false })
      }
      restart()
    },
    stop() {
      enabled = false
      clearTimeout(timer)
      timer = null
    }
  }
}
