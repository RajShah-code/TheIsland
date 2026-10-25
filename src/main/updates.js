// Update notice for the GitHub installer build: asks GitHub for the latest release a minute after start
// and then every 12 hours, and reports a version newer than this one. Nothing is downloaded; the tray and
// the settings window link to the website's Download page. The Store build updates through the Store and
// never starts this. ISLAND_UPDATE_URL points the check at another server (for testing).
import { app, powerMonitor } from 'electron'
import { log } from './log'

const LATEST = process.env.ISLAND_UPDATE_URL || 'https://api.github.com/repos/RajShah-code/TheIsland/releases/latest'
const FIRST_MS = 60 * 1000
const EVERY_MS = 12 * 60 * 60 * 1000
const TIMEOUT_MS = 15 * 1000

// "v1.2.3" -> [1, 2, 3]; anything else (a pre-release, a missing tag) -> null.
function parse(v) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(v).trim())
  return m ? m.slice(1).map(Number) : null
}

export function isNewer(tag, current) {
  const a = parse(tag)
  const b = parse(current)
  if (!a || !b) return false
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i]
  return false
}

export function startUpdateCheck({ isEnabled, onChange }) {
  let available = null
  let lastCheck = 0
  let timer = null

  async function check() {
    lastCheck = Date.now()
    if (!isEnabled()) return
    try {
      const res = await fetch(LATEST, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'TheIsland/' + app.getVersion() },
        signal: AbortSignal.timeout(TIMEOUT_MS)
      })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const { tag_name: tag } = await res.json()
      const next = isNewer(tag, app.getVersion()) ? { version: String(tag).replace(/^v/, '') } : null
      if (next?.version !== available?.version) {
        available = next
        if (next) log('update available', next.version)
        onChange()
      }
    } catch (e) {
      log('update check failed', e.message)
    }
  }

  function schedule(ms) {
    clearTimeout(timer)
    timer = setTimeout(async () => {
      await check()
      schedule(EVERY_MS)
    }, ms)
  }

  // A PC that slept through the 12 hours checks soon after it wakes.
  const onResume = () => {
    if (Date.now() - lastCheck >= EVERY_MS) schedule(FIRST_MS)
  }
  powerMonitor.on('resume', onResume)
  schedule(FIRST_MS)

  return {
    get: () => available,
    // Turned on in Settings: check now. Turned off: forget a found update.
    setEnabled(on) {
      if (on) return void schedule(0)
      if (available) {
        available = null
        onChange()
      }
    },
    stop() {
      clearTimeout(timer)
      powerMonitor.removeListener('resume', onResume)
    }
  }
}
