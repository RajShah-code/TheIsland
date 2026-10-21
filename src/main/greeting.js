// Hello when the island starts and goodbye when it quits or Windows shuts down, by the time of day.
import os from 'node:os'

function firstName() {
  try {
    const n = os.userInfo().username.split(/[\s._-]/)[0]
    return n ? n[0].toUpperCase() + n.slice(1) : ''
  } catch {
    return ''
  }
}

const withName = (text) => {
  const name = firstName()
  return name ? `${text}, ${name}` : text
}

export function greetingText(date = new Date()) {
  const h = date.getHours()
  if (h >= 5 && h < 12) return withName('Good morning')
  if (h >= 12 && h < 17) return withName('Good afternoon')
  return withName('Good evening')
}

export function goodbyeText(date = new Date()) {
  const h = date.getHours()
  return withName(h >= 21 || h < 5 ? 'Good night' : 'Goodbye')
}
