// Dev-only harness: renders the calendar widget with sample events in a normal browser tab.
import { createRoot } from 'react-dom/client'
import '../src/styles.css'
import { addDays, startOfDay, startOfWeek } from '../../shared/weeks.mjs'
import { IslandProvider } from '../src/store'
import calendar from '../src/widgets/calendar'

const today = startOfDay(Date.now())
const from = startOfWeek(Date.now())
const ev = (day, title, allDay = true) => ({ id: title + day, title, start: addDays(today, day), end: addDays(today, day + 1), allDay })
const state = {
  calendar: {
    configured: true, source: 'google', from, to: addDays(from, 21), updatedAt: Date.now(), error: null,
    events: [ev(-4, 'Lecture'), ev(-3, 'Lab'), ev(-1, 'DS EXAM'), ev(0, 'Project review'), ev(1, 'Gym'), ev(2, 'Family')]
  }
}
const noop = () => () => {}
window.island = {
  getState: () => Promise.resolve(state),
  calendarWeek: () => Promise.resolve([]),
  onClaude: noop, onMedia: noop, onCalendar: noop, onSettings: noop, onFullscreen: noop, onSystem: noop
}

createRoot(document.getElementById('root')).render(
  <IslandProvider>
    <div style={{ margin: 40, width: calendar.width, padding: 20, background: '#000', borderRadius: 30 }} className="font-sans text-white">
      <calendar.Panel />
    </div>
  </IslandProvider>
)
