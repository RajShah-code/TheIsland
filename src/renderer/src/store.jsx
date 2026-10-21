// State pushed from the main process. Widgets read their slice with useIsland().
import { createContext, useContext, useEffect, useState } from 'react'
import { DEFAULT_SETTINGS } from '../../shared/settings-model.mjs'

const IslandContext = createContext(null)

const EMPTY = {
  claude: { sessions: [], approvals: [] },
  media: { available: false, active: false },
  calendar: { configured: false, events: [] },
  // Replaced by the main process's validated settings (src/shared/settings-model.mjs) on load.
  settings: DEFAULT_SETTINGS,
  fullscreen: false,
  // Stats are undefined until first sampled, null when not available (see src/main/helper.js).
  system: {
    audio: { available: false },
    brightness: { available: false },
    radios: { wifi: null, bluetooth: null },
    keepAwake: false
  }
}

export function IslandProvider({ children }) {
  const [state, setState] = useState(EMPTY)

  useEffect(() => {
    const api = window.island
    const set = (key) => (value) => setState((s) => ({ ...s, [key]: value }))
    const offs = [
      api.onClaude(set('claude')),
      api.onMedia(set('media')),
      api.onCalendar(set('calendar')),
      api.onSettings(set('settings')),
      api.onFullscreen(set('fullscreen')),
      api.onSystem(set('system'))
    ]
    api.getState().then((s) => s && setState((cur) => ({ ...cur, ...s })))
    return () => offs.forEach((off) => off())
  }, [])

  return <IslandContext.Provider value={state}>{children}</IslandContext.Provider>
}

export function useIsland() {
  return useContext(IslandContext)
}

// Re-renders once a minute, on the minute. Used by the clock and calendar.
export function useMinute() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    let t
    const tick = () => {
      setNow(Date.now())
      t = setTimeout(tick, 60000 - (Date.now() % 60000) + 50)
    }
    t = setTimeout(tick, 60000 - (Date.now() % 60000) + 50)
    return () => clearTimeout(t)
  }, [])
  return now
}
