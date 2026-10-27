// Calendar: merges the events of every enabled account (calendars/accounts.js: Google, Outlook,
// CalDAV, iCal links, Notion). The island gets the current week and the two after it, refreshed in the
// background, when the island opens and after the PC wakes up. Any other week is loaded when the widget
// pages to it (week()). Each account is fetched on its own: one that fails keeps its last events and
// shows its own error, so a broken account never blanks the others. Tokens and addresses stay in the
// main process and are never logged.
import { powerMonitor } from 'electron'
import { addDays, startOfWeek } from '../shared/weeks.mjs'
import { context, PROVIDERS } from './calendars/accounts'
import { log } from './log'

const WINDOW_WEEKS = 3
// After a failed fetch (often no network yet right after login), try again sooner.
const RETRY_MS = 60 * 1000
const WEEK_TTL_MS = 60 * 1000
const MAX_WEEKS_CACHED = 8
const MAX_EVENTS = 600
// How far the widget can page, either way.
const MAX_WEEK_DISTANCE_MS = 5 * 366 * 24 * 60 * 60 * 1000

const message = (account, e) =>
  e?.user ? e.message : `Couldn't load ${account.label}`

// getAccounts() returns the enabled accounts ({ id, kind, label, color, meta }).
export function startCalendar({ getAccounts, onChange }) {
  const empty = () => ({ configured: false, accounts: [], from: 0, to: 0, events: [], error: null, errors: {}, updatedAt: null })
  // Configured as soon as there is an account, so the island doesn't ask for one during the first fetch.
  let state = { ...empty(), configured: getAccounts().length > 0, accounts: getAccounts().map((a) => a.id) }
  let timer = null
  let retry = null
  let loading = false
  let again = false
  let attemptAt = 0
  const last = new Map() // account id -> its events in the current window, from the last good fetch
  const weeks = new Map() // week start -> { events, at }

  const tag = (account, events) => events.map((e) => ({ ...e, id: account.id + ':' + e.id, source: account.id, color: account.color }))
  const merge = (lists) => lists.flat().sort((a, b) => a.start - b.start).slice(0, MAX_EVENTS)

  async function refresh() {
    const accounts = getAccounts()
    if (accounts.length === 0) {
      last.clear()
      weeks.clear()
      state = empty()
      return onChange(state)
    }
    if (loading) {
      again = true
      return
    }
    loading = true
    attemptAt = Date.now()
    clearTimeout(retry)
    const ids = accounts.map((a) => a.id)
    for (const id of last.keys()) if (!ids.includes(id)) last.delete(id)
    if (!state.configured || ids.join() !== state.accounts.join()) {
      state = { ...state, configured: true, accounts: ids, events: merge(accounts.map((a) => last.get(a.id) || [])) }
      onChange(state)
    }
    const from = startOfWeek(Date.now())
    const to = addDays(from, WINDOW_WEEKS * 7)
    const results = await Promise.allSettled(
      accounts.map((a) => PROVIDERS[a.kind].events(context(a), from, to, true).then((events) => tag(a, events)))
    )
    const errors = {}
    results.forEach((r, i) => {
      const a = accounts[i]
      if (r.status === 'fulfilled') last.set(a.id, r.value)
      else {
        const e = r.reason
        log('calendar refresh failed:', a.kind, e && e.name === 'TimeoutError' ? 'timeout' : e && e.message)
        errors[a.id] = message(a, e)
      }
    })
    weeks.clear()
    const failed = Object.values(errors)
    const anyGood = failed.length < accounts.length
    state = {
      configured: true,
      accounts: ids,
      from,
      to,
      events: merge(accounts.map((a) => last.get(a.id) || [])),
      // One line for the widget: the first problem, and how many more.
      error: failed.length ? failed[0] + (failed.length > 1 ? ` (+${failed.length - 1} more)` : '') : null,
      errors,
      updatedAt: anyGood || state.updatedAt ? Date.now() : null
    }
    if (failed.length) {
      retry = setTimeout(refresh, RETRY_MS)
      retry.unref()
    }
    loading = false
    onChange(state)
    if (again) {
      again = false
      refresh()
    }
  }

  // The fastest refresh any enabled account wants (the API sources are cheap and current; iCal
  // copies change rarely).
  function schedule() {
    clearInterval(timer)
    const accounts = getAccounts()
    if (accounts.length === 0) return
    timer = setInterval(refresh, Math.min(...accounts.map((a) => PROVIDERS[a.kind].REFRESH_MS)))
    timer.unref()
  }

  // Events of the week starting at `start` (a Monday from startOfWeek). Inside the window the
  // island already has them; other weeks are fetched (APIs) or parsed from the cached file (iCal).
  async function week(start) {
    const accounts = getAccounts()
    if (accounts.length === 0 || !Number.isFinite(start) || Math.abs(start - Date.now()) > MAX_WEEK_DISTANCE_MS) return null
    start = startOfWeek(start)
    const end = addDays(start, 7)
    if (start >= state.from && end <= state.to) return state.events.filter((e) => e.start < end && e.end > start)
    const hit = weeks.get(start)
    if (hit && Date.now() - hit.at < WEEK_TTL_MS) return hit.events
    const results = await Promise.allSettled(
      accounts.map((a) => PROVIDERS[a.kind].events(context(a), start, end, false).then((events) => tag(a, events)))
    )
    const good = results.filter((r) => r.status === 'fulfilled').map((r) => r.value)
    if (good.length === 0) {
      log('calendar week failed')
      return hit ? hit.events : null
    }
    const events = merge(good)
    weeks.delete(start)
    weeks.set(start, { events, at: Date.now() })
    if (weeks.size > MAX_WEEKS_CACHED) weeks.delete(weeks.keys().next().value)
    return events
  }

  powerMonitor.on('resume', () => setTimeout(refresh, 5000))
  refresh()
  schedule()

  return {
    get: () => state,
    week,
    // The island was opened: fetch now unless the last fetch was very recent.
    touch: () => {
      const accounts = getAccounts()
      if (accounts.length && Date.now() - attemptAt > Math.min(...accounts.map((a) => PROVIDERS[a.kind].STALE_MS))) refresh()
    },
    refresh: () => {
      refresh()
      schedule()
    }
  }
}
