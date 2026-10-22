// Setting and removing the calendar ICS address. Shared by the tray and the settings window, which
// each show the result their own way. The address itself never leaves the main process.
import { clipboard } from 'electron'
import { getSecret, setSecret } from './config'
import { log } from './log'

// Checks the decrypted value, so an address that can no longer be decrypted counts as not set.
export function hasCalendarUrl() {
  return !!getSecret('calendarUrl')
}

// Checks the address and saves it encrypted. Returns { ok: true } or { ok: false, error }.
export function setCalendarUrl(text) {
  const url = String(text || '').trim()
  let ok = false
  try {
    const u = new URL(url)
    ok = u.protocol === 'https:' && /\.ics$/i.test(u.pathname)
  } catch {}
  if (!ok) {
    return {
      ok: false,
      error:
        'That is not an iCal address. Use the "Secret address in iCal format" from Google Calendar ' +
        'settings. It starts with https:// and ends with .ics.'
    }
  }
  try {
    setSecret('calendarUrl', url)
  } catch (e) {
    return { ok: false, error: 'Calendar not saved: ' + e.message }
  }
  log('calendar url set')
  return { ok: true }
}

// Same, reading the copied address. Clears the clipboard once it is saved.
export async function setCalendarFromClipboard() {
  // readText() returns a Promise in this Electron version.
  const r = setCalendarUrl(await clipboard.readText())
  if (r.ok) clipboard.clear()
  return r
}

export function removeCalendarUrl() {
  setSecret('calendarUrl', null)
  log('calendar url removed')
}
