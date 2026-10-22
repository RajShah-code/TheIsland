// Calendar weeks run Monday to Sunday, in local time. Shared by the main process (which loads
// weeks) and the calendar widget (which pages through them), so both agree on where a week starts.
export function startOfDay(ms) {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function addDays(ms, n) {
  const d = new Date(ms)
  d.setDate(d.getDate() + n)
  return d.getTime()
}

export function startOfWeek(ms) {
  const day = startOfDay(ms)
  return addDays(day, -((new Date(day).getDay() + 6) % 7))
}
