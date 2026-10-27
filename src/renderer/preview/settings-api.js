// A fake window.settingsApi for preview/settings.html, kept in memory. ?hooks=on|old|off|missing sets
// the Claude Code hooks state (default off); installing or removing them just flips it.
import { DEFAULT_SETTINGS, applySettingsPatch } from '../../shared/settings-model.mjs'

const q = new URLSearchParams(location.search)
const HOOKS = {
  on: { found: true, installed: true, upToDate: true },
  old: { found: true, installed: true, upToDate: false },
  off: { found: true, installed: false, upToDate: false },
  missing: { found: false, installed: false, upToDate: false }
}
let view = {
  ...DEFAULT_SETTINGS,
  island: { ...DEFAULT_SETTINGS.island, startWithWindows: true },
  store: q.has('store'),
  calendar: {
    accounts: q.has('cal')
      ? [
          { id: 'a', kind: 'google', label: 'me@gmail.com', color: '#3b9cff', enabled: true, ownClient: false, error: null },
          { id: 'b', kind: 'caldav', label: 'iCloud (me@icloud.com)', color: '#34d399', enabled: true, ownClient: false, error: 'The calendar server refused the sign-in. Check the email and app-specific password in Settings.' },
          { id: 'c', kind: 'notion', label: 'Content calendar', color: '#f59e0b', enabled: false, ownClient: false, error: null }
        ]
      : [],
    builtIn: { google: !q.has('nogoogle'), microsoft: !q.has('noms') }
  },
  claudeHooks: HOOKS[q.get('hooks')] || HOOKS.off,
  version: '0.1.0',
  update: q.has('update') ? { version: '0.2.0' } : null
}

window.opened = []
window.settingsApi = {
  get: async () => view,
  set: async (patch) => (view = { ...view, ...applySettingsPatch(view, patch) }),
  calendarAdd: async () => ({ ok: false, error: 'Not in the preview.', view }),
  calendarUpdate: async (id, patch) =>
    (view = { ...view, calendar: { ...view.calendar, accounts: view.calendar.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)) } }),
  calendarRemove: async (id) =>
    (view = { ...view, calendar: { ...view.calendar, accounts: view.calendar.accounts.filter((a) => a.id !== id) } }),
  openCalendarHelp: (name) => window.opened.push(name),
  openLink: (name) => window.opened.push(name),
  claudeHooks: async (action) =>
    (view = { ...view, claudeHooks: action === 'install' ? HOOKS.on : { ...HOOKS.off, found: view.claudeHooks.found } }),
  onChange: () => () => {}
}
