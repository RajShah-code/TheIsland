// Runs resources/island-helper.exe (see helper/IslandHelper.cs). It pushes a JSON line when the
// Windows media session changes, when a fullscreen app starts/stops, and for the System tab (audio,
// brightness, radios on change; GPU/disk/network once a second only while asked with "stats on").
// The helper exits when we close its stdin.
//
// System tab: CPU and RAM are sampled here (node's os module), but only while the renderer says the
// tab is on screen (setWatch). Outside that, nothing here runs on a timer.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { app, powerSaveBlocker } from 'electron'
import { log } from './log'

const STATS_MS = 1000
// No helper stats line for this long while watching: treat GPU/disk/network as unavailable.
const STATS_STALE_MS = 3000

function cpuTimes() {
  let idle = 0
  let total = 0
  for (const c of os.cpus()) {
    const t = c.times
    idle += t.idle
    total += t.user + t.nice + t.sys + t.idle + t.irq
  }
  return { idle, total }
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const bool = (v) => (typeof v === 'boolean' ? v : null)
const pct = (v) => Math.max(0, Math.min(100, Math.round(v)))
const NO_RADIOS = { wifi: null, bluetooth: null }

export function startHelper({ onMedia, onFullscreen, onSystem }) {
  const exe = path.join(app.getAppPath(), 'resources', 'island-helper.exe').replace('app.asar', 'app.asar.unpacked')
  let child = null
  let state = { available: false, active: false }
  let fullscreen = false
  let restarts = 0
  let stopped = false

  // Stats fields are undefined until first sampled (the renderer shows a placeholder) and null when
  // not available.
  let system = {
    cpu: undefined,
    ramUsed: undefined,
    ramTotal: os.totalmem(),
    gpu: undefined,
    diskRead: undefined,
    diskWrite: undefined,
    netDown: undefined,
    netUp: undefined,
    audio: { available: false },
    brightness: { available: false },
    radios: NO_RADIOS,
    keepAwake: false
  }
  let watching = false
  let statsTimer = null
  let lastCpu = null
  let lastHelperStats = 0
  let watchSince = 0
  let blocker = null

  const emitSystem = () => onSystem({ ...system })

  function write(line) {
    if (!child) return
    try {
      child.stdin.write(line + '\n')
    } catch (e) {
      log('helper write failed', e.message)
    }
  }

  function launch() {
    if (!fs.existsSync(exe)) {
      log('helper missing; run npm run build:helper')
      return
    }
    child = spawn(exe, [], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true })
    child.stdin.on('error', (e) => log('helper stdin', e.message))
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
      else {
        onMedia((state = { available: false, active: false }))
        system = { ...system, audio: { available: false }, brightness: { available: false }, radios: NO_RADIOS }
        emitSystem()
      }
    })
    // A restarted helper: ask for the system state again, and resume stats if the tab is open.
    if (restarts > 0) write('system refresh')
    if (watching) write('stats on')
  }

  function handle(line) {
    let m
    try {
      m = JSON.parse(line)
    } catch {
      return
    }
    switch (m.type) {
      case 'fullscreen':
        fullscreen = !!m.on
        return onFullscreen(fullscreen)
      case 'media': {
        const art = m.art !== undefined ? m.art || null : state.art
        state = { available: true, ...m, art }
        delete state.type
        return onMedia(state)
      }
      case 'stats':
        // Stored only; the 1 s CPU tick sends everything together (one push per second).
        if (!watching) return
        lastHelperStats = Date.now()
        system = {
          ...system,
          gpu: num(m.gpu),
          diskRead: num(m.diskRead),
          diskWrite: num(m.diskWrite),
          netDown: num(m.netDown),
          netUp: num(m.netUp)
        }
        return
      case 'audio':
        system = {
          ...system,
          audio: m.available
            ? { available: true, volume: pct(num(m.volume) ?? 0), muted: !!m.muted }
            : { available: false }
        }
        return emitSystem()
      case 'brightness':
        system = {
          ...system,
          brightness: m.available ? { available: true, value: pct(num(m.value) ?? 0) } : { available: false }
        }
        return emitSystem()
      case 'radios':
        system = { ...system, radios: { wifi: bool(m.wifi), bluetooth: bool(m.bluetooth) } }
        return emitSystem()
    }
  }

  function sample() {
    const now = cpuTimes()
    let cpu = system.cpu
    if (lastCpu) {
      const total = now.total - lastCpu.total
      if (total > 0) cpu = Math.max(0, Math.min(100, (1 - (now.idle - lastCpu.idle) / total) * 100))
    }
    lastCpu = now
    const ramTotal = os.totalmem()
    system = { ...system, cpu, ramTotal, ramUsed: ramTotal - os.freemem() }
    const t = Date.now()
    if (t - watchSince > STATS_STALE_MS && t - lastHelperStats > STATS_STALE_MS) {
      system = { ...system, gpu: null, diskRead: null, diskWrite: null, netDown: null, netUp: null }
    }
  }

  // The renderer turns this on only while the island is open on the System tab.
  function setWatch(on) {
    on = !!on
    if (on === watching) return
    watching = on
    if (on) {
      watchSince = Date.now()
      lastCpu = null
      write('stats on')
      sample() // RAM right away; CPU needs a second sample for its delta.
      emitSystem()
      statsTimer = setInterval(() => {
        sample()
        emitSystem()
      }, STATS_MS)
    } else {
      clearInterval(statsTimer)
      statsTimer = null
      write('stats off')
    }
  }

  function setKeepAwake(on) {
    if (on && blocker === null) blocker = powerSaveBlocker.start('prevent-display-sleep')
    if (!on && blocker !== null) {
      powerSaveBlocker.stop(blocker)
      blocker = null
    }
    const keepAwake = blocker !== null
    if (keepAwake === system.keepAwake) return
    system = { ...system, keepAwake }
    emitSystem()
  }

  // Everything from the renderer goes through here: only these commands, every value checked.
  function systemCommand(cmd, value) {
    switch (cmd) {
      case 'volume':
      case 'brightness': {
        const v = num(value)
        if (v === null) return
        const p = pct(v)
        // Remember what was asked so the next push doesn't show the old value.
        if (cmd === 'volume' && system.audio.available) system = { ...system, audio: { ...system.audio, volume: p } }
        if (cmd === 'brightness' && system.brightness.available)
          system = { ...system, brightness: { ...system.brightness, value: p } }
        return write(`${cmd} ${p}`)
      }
      case 'mute':
        if (['on', 'off', 'toggle'].includes(value)) write('mute ' + value)
        return
      case 'wifi':
      case 'bluetooth':
        if (typeof value === 'boolean') write(`${cmd} ${value ? 'on' : 'off'}`)
        return
      case 'lock':
      case 'sleep':
        return write(cmd)
      case 'keepAwake':
        if (typeof value === 'boolean') setKeepAwake(value)
        return
    }
  }

  launch()

  return {
    get: () => state,
    isFullscreen: () => fullscreen,
    command(cmd) {
      if (child && ['toggle', 'next', 'prev'].includes(cmd)) child.stdin.write(cmd + '\n')
    },
    system: {
      get: () => ({ ...system }),
      command: systemCommand,
      setWatch
    },
    stop() {
      stopped = true
      setWatch(false)
      setKeepAwake(false)
      if (child) child.stdin.end()
    }
  }
}
