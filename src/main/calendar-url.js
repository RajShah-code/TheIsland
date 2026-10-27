// The tray's "Add calendar from copied iCal address": adds the copied address as an iCal account and
// clears the clipboard once it is saved. The address itself never leaves the main process.
import { clipboard } from 'electron'
import { addAccount } from './calendars/accounts'

// Returns { ok: true } or { ok: false, error }.
export async function addCalendarFromClipboard() {
  // readText() returns a Promise in this Electron version.
  const url = await clipboard.readText()
  try {
    await addAccount('ics', { url })
  } catch (e) {
    return { ok: false, error: e.user ? e.message : 'Calendar not saved: ' + e.message }
  }
  clipboard.clear()
  return { ok: true }
}
