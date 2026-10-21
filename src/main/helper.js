// Runs resources/island-helper.exe (see helper/IslandHelper.cs). It pushes a JSON line when the
// Windows media session changes or when a fullscreen app starts/stops. The helper exits when we close
// its stdin.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { log } from './log'

export function startHelper({ onMedia, onFullscreen }) {
  const exe = path.join(app.getAppPath(), 'resources', 'island-helper.exe').replace('app.asar', 'app.asar.unpacked')
  let child = null
  let state = { available: false, active: false }
  let fullscreen = false
  let restarts = 0
  let stopped = false

  function launch() {
    if (!fs.existsSync(exe)) {
      log('helper missing; run npm run build:helper')
      return
    }
    child = spawn(exe, [], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true })
    state = { ...state, available: true }
    let buf = ''
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (d) => {
      buf += d
      let i
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim()
        buf = buf.slice(i + 1)
        if (line) handle(line)
      }
    })
    child.on('error', (e) => log('helper error', e.message))
    child.on('exit', (code) => {
      child = null
      if (stopped) return
      log('helper exited', code)
      // Back off; give up after a few crashes so a broken helper can't spin the CPU.
      if (restarts++ < 5) setTimeout(launch, 2000 * restarts)
      else onMedia((state = { available: false, active: false }))
    })
  }

  function handle(line) {
    let m
    try {
      m = JSON.parse(line)
    } catch {
      return
    }
    if (m.type === 'fullscreen') {
      fullscreen = !!m.on
      return onFullscreen(fullscreen)
    }
    if (m.type !== 'media') return
    const art = m.art !== undefined ? m.art || null : state.art
    state = { available: true, ...m, art }
    delete state.type
    onMedia(state)
  }

  launch()

  return {
    get: () => state,
    isFullscreen: () => fullscreen,
    command(cmd) {
      if (child && ['toggle', 'next', 'prev'].includes(cmd)) child.stdin.write(cmd + '\n')
    },
    stop() {
      stopped = true
      if (child) child.stdin.end()
    }
  }
}
