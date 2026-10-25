// A fake window.settingsApi for preview/settings.html, kept in memory.
import { DEFAULT_SETTINGS, applySettingsPatch } from '../../shared/settings-model.mjs'

const q = new URLSearchParams(location.search)
let view = {
  ...DEFAULT_SETTINGS,
  island: { ...DEFAULT_SETTINGS.island, startWithWindows: true },
  store: q.has('store'),
  calendarConfigured: false,
  google: { signedIn: false, clientId: '' },
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
  onChange: () => () => {}
}
