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
  calendarConfigured: false,
  google: { signedIn: false, clientId: '' },
  claudeHooks: HOOKS[q.get('hooks')] || HOOKS.off,
  version: '0.1.0',
  update: q.has('update') ? { version: '0.2.0' } : null
}

window.opened = []
window.settingsApi = {
  get: async () => view,
  set: async (patch) => (view = { ...view, ...applySettingsPatch(view, patch) }),
  setCalendar: async () => ({ ok: false, error: 'Not in the preview.', view }),
  removeCalendar: async () => view,
  googleSignIn: async () => ({ ok: false, error: 'Not in the preview.', view }),
  googleSignOut: async () => view,
  openGoogleConsole: () => window.opened.push('google-console'),
  openLink: (name) => window.opened.push(name),
  claudeHooks: async (action) =>
    (view = { ...view, claudeHooks: action === 'install' ? HOOKS.on : { ...HOOKS.off, found: view.claudeHooks.found } }),
  onChange: () => () => {}
}
