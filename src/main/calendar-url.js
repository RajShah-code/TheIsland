// Setting and removing the calendar ICS address. Shared by the tray and the settings window, which
// each show the result their own way. The address itself never leaves the main process.
import { clipboard } from 'electron'
import { getConfig, setSecret } from './config'
import { log } from './log'

export function hasCalendarUrl() {
  return !!getConfig().calendarUrl
}

// Reads the copied address, checks it, saves it encrypted and clears the clipboard.
// Returns { ok: true } or { ok: false, error }.
export async function setCalendarFromClipboard() {
  // readText() returns a Promise in this Electron version.
  const url = String((await clipboard.readText()) || '').trim()
  let ok = false
  try {
    const u = new URL(url)
    ok = u.protocol === 'https:' && /\.ics$/i.test(u.pathname)
  } catch {}
  if (!ok) {
    return {
      ok: false,
      error:
        'Copy the "Secret address in iCal format" from Google Calendar settings first. ' +
        'It starts with https:// and ends with .ics.'
    }
  }
  try {
    setSecret('calendarUrl', url)
  } catch (e) {
    return { ok: false, error: 'Calendar not saved: ' + e.message }
  }
  clipboard.clear()
  log('calendar url set')
  return { ok: true }
}

export function removeCalendarUrl() {
  setSecret('calendarUrl', null)
  log('calendar url removed')
}
