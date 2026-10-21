const time12 = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
const dayFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short' })

// 12-hour clock, e.g. "3:07 PM".
export function formatTime(ms) {
  return time12.format(ms)
}

export function formatDay(ms) {
  return dayFmt.format(ms)
}

function startOfDay(ms) {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// "Today", "Tomorrow" or "Thu".
export function relativeDay(ms, now) {
  const diff = Math.round((startOfDay(ms) - startOfDay(now)) / 86400000)
  if (diff <= 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return weekday.format(ms)
}
