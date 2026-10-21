const time12 = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

// 12-hour clock, e.g. "3:07 PM".
export function formatTime(ms) {
  return time12.format(ms)
}
