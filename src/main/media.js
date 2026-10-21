// Music: runs resources/media-helper.exe (see helper/MediaHelper.cs), which pushes a JSON line
// whenever the Windows media session changes. No polling. The helper exits when we close its stdin.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { log } from './log'

export function startMedia({ onChange }) {
  const exe = path.join(app.getAppPath(), 'resources', 'media-helper.exe').replace('app.asar', 'app.asar.unpacked')
  let child = null
  let state = { available: false, active: false }
  let restarts = 0
  let stopped = false

  function launch() {
    if (!fs.existsSync(exe)) {
      log('media helper missing; run npm run build:helper')
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
    child.on('error', (e) => log('media helper error', e.message))
    child.on('exit', (code) => {
      child = null
      if (stopped) return
      log('media helper exited', code)
      // Back off; give up after a few crashes so a broken helper can't spin the CPU.
      if (restarts++ < 5) setTimeout(launch, 2000 * restarts)
      else onChange((state = { available: false, active: false }))
    })
  }

  function handle(line) {
    let m
    try {
      m = JSON.parse(line)
    } catch {
      return
    }
    if (m.type !== 'media') return
    const art = m.art !== undefined ? m.art || null : state.art
    state = { available: true, ...m, art }
    delete state.type
    onChange(state)
  }

  launch()

  return {
    get: () => state,
    command(cmd) {
      if (child && ['toggle', 'next', 'prev'].includes(cmd)) child.stdin.write(cmd + '\n')
    },
    stop() {
      stopped = true
      if (child) child.stdin.end()
    }
  }
}
