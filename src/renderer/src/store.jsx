// State pushed from the main process. Widgets read their slice with useIsland().
import { createContext, useContext, useEffect, useState } from 'react'

const IslandContext = createContext(null)

const EMPTY = {
  claude: { sessions: [], approvals: [] },
  media: { available: false, active: false },
  calendar: { configured: false, events: [] },
  settings: { approvalsEnabled: true }
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
      api.onSettings(set('settings'))
    ]
    api.getState().then((s) => s && setState(s))
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
