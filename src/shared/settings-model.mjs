// The settings model, shared by the main process (which validates and saves) and the renderers (which
// read it). normalizeSettings() turns anything (the config file, a patch from the settings window) into
// a clean object with known keys only; a bad value falls back to `base`, then to the default. Secrets
// like the calendar URL are never part of it, so this object is safe to send to any renderer.

export const WIDGET_IDS = ['music', 'clock', 'calendar']

// System tab items. kind tells the System tab how to draw one:
//   'meter'   a live reading in the left column
//   'slider'  a full-width row with a slider (volume, brightness)
//   'picker'  a full-width row that opens a short list (sound output)
//   'toggle'  a Quick Settings tile that shows on/off from the system state
//   'action'  a tile that does one thing (a shortcut, lock, sleep)
//   'link'    a tile that opens a page of Windows Settings
// Everything that is not a meter sits in the right column. New ids are appended to a saved order by
// normalizeSettings, so existing users get new tiles at the end, visible.
export const SYSTEM_ITEMS = [
  { id: 'cpu', name: 'CPU', kind: 'meter' },
  { id: 'ram', name: 'Memory', kind: 'meter' },
  { id: 'gpu', name: 'GPU', kind: 'meter' },
  { id: 'disk', name: 'Disk', kind: 'meter' },
  { id: 'network', name: 'Network', kind: 'meter' },
  { id: 'battery', name: 'Battery', kind: 'meter' },
  { id: 'volume', name: 'Volume', kind: 'slider' },
  { id: 'brightness', name: 'Brightness', kind: 'slider' },
  { id: 'output', name: 'Sound output', kind: 'picker' },
  { id: 'wifi', name: 'Wi-Fi', kind: 'toggle' },
  { id: 'bluetooth', name: 'Bluetooth', kind: 'toggle' },
  { id: 'airplane', name: 'Airplane mode', kind: 'toggle' },
  { id: 'hotspot', name: 'Mobile hotspot', kind: 'toggle' },
  { id: 'energySaver', name: 'Energy saver', kind: 'link' },
  { id: 'nightLight', name: 'Night light', kind: 'toggle' },
  { id: 'dnd', name: 'Do not disturb', kind: 'link' },
  { id: 'accessibility', name: 'Accessibility', kind: 'link' },
  { id: 'nearby', name: 'Nearby sharing', kind: 'link' },
  { id: 'cast', name: 'Cast', kind: 'action' },
  { id: 'project', name: 'Project', kind: 'action' },
  { id: 'captions', name: 'Live captions', kind: 'action' },
  { id: 'colorFilters', name: 'Color filters', kind: 'toggle' },
  { id: 'keyboard', name: 'Keyboard layout', kind: 'action' },
  { id: 'mic', name: 'Mic mute', kind: 'toggle' },
  { id: 'keepAwake', name: 'Keep awake', kind: 'toggle' },
  { id: 'screenshot', name: 'Screenshot', kind: 'action' },
  { id: 'notifications', name: 'Notifications', kind: 'action' },
  { id: 'lock', name: 'Lock', kind: 'action' },
  { id: 'sleep', name: 'Sleep', kind: 'action' },
  { id: 'settings', name: 'Settings', kind: 'link' }
]
export const isSystemControl = (it) => it.kind !== 'meter'
// How the System tab draws its tiles: icon and label, icon only (label as tooltip) or label only.
export const CONTROL_STYLES = ['both', 'icon', 'label']
export const SYSTEM_IDS = SYSTEM_ITEMS.map((it) => it.id)

export const PILL_LEFT = ['time', 'date', 'none']
export const PILL_RIGHT = ['none', 'time', 'date']
// The relay gives up after 290 s and Claude Code kills the hook at 300 s (see hook/TheIslandRelay.cs),
// so a longer island timeout would never be reached.
export const TIMEOUT_MIN = 30
export const TIMEOUT_MAX = 285
export const GHOST_MIN = 0.05
export const GHOST_MAX = 0.6

export const DEFAULT_SETTINGS = {
  approvalsEnabled: true,
  approvalTimeoutSec: 120,
  pill: { leftFallback: 'time', rightFallback: 'none' },
  widgets: { order: [...WIDGET_IDS], hidden: [] },
  system: { order: [...SYSTEM_IDS], hidden: [], controlStyle: 'both' },
  claude: { buddy: true },
  island: { ghostOpacity: 0.15 },
  // The GitHub installer build asks GitHub for a newer release now and then (src/main/updates.js).
  updates: { check: true }
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const bool = (v, base) => (typeof v === 'boolean' ? v : base)
const oneOf = (v, allowed, base) => (allowed.includes(v) ? v : base)

function num(v, lo, hi, base) {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : base
}

// Known ids in the given order, no repeats, plus any missing ones placed by their default order.
function order(v, ids, base) {
  if (!Array.isArray(v)) return base
  const out = []
  for (const id of v) if (ids.includes(id) && !out.includes(id)) out.push(id)
  // A missing (new) id goes right after its default predecessor, so new System tab tiles join the
  // tiles and the output picker sits with the sliders instead of everything landing at the very end.
  ids.forEach((id, i) => {
    if (out.includes(id)) return
    const prev = i > 0 ? out.indexOf(ids[i - 1]) : -1
    out.splice(prev + 1, 0, id)
  })
  return out
}

function hidden(v, ids, base) {
  if (!Array.isArray(v)) return base
  return ids.filter((id) => v.includes(id))
}

export function normalizeSettings(raw, base = DEFAULT_SETTINGS) {
  const r = isObj(raw) ? raw : {}
  const g = (k) => (isObj(r[k]) ? r[k] : {})
  const d = DEFAULT_SETTINGS
  return {
    approvalsEnabled: bool(r.approvalsEnabled, base.approvalsEnabled),
    approvalTimeoutSec: Math.round(num(r.approvalTimeoutSec, TIMEOUT_MIN, TIMEOUT_MAX, base.approvalTimeoutSec)),
    pill: {
      leftFallback: oneOf(g('pill').leftFallback, PILL_LEFT, base.pill?.leftFallback ?? d.pill.leftFallback),
      rightFallback: oneOf(g('pill').rightFallback, PILL_RIGHT, base.pill?.rightFallback ?? d.pill.rightFallback)
    },
    widgets: {
      order: order(g('widgets').order, WIDGET_IDS, base.widgets?.order ?? d.widgets.order),
      hidden: hidden(g('widgets').hidden, WIDGET_IDS, base.widgets?.hidden ?? d.widgets.hidden)
    },
    system: {
      order: order(g('system').order, SYSTEM_IDS, base.system?.order ?? d.system.order),
      hidden: hidden(g('system').hidden, SYSTEM_IDS, base.system?.hidden ?? d.system.hidden),
      controlStyle: oneOf(g('system').controlStyle, CONTROL_STYLES, base.system?.controlStyle ?? d.system.controlStyle)
    },
    claude: { buddy: bool(g('claude').buddy, base.claude?.buddy ?? d.claude.buddy) },
    island: {
      ghostOpacity:
        Math.round(num(g('island').ghostOpacity, GHOST_MIN, GHOST_MAX, base.island?.ghostOpacity ?? d.island.ghostOpacity) * 100) /
        100
    },
    updates: { check: bool(g('updates').check, base.updates?.check ?? d.updates.check) }
  }
}

// Applies a partial settings object (same shape, any subset of keys) on top of `current`. Unknown keys
// are ignored and invalid values keep the current one.
export function applySettingsPatch(current, patch) {
  if (!isObj(patch)) return current
  const merged = { ...current }
  for (const k of ['approvalsEnabled', 'approvalTimeoutSec']) if (k in patch) merged[k] = patch[k]
  for (const k of ['pill', 'widgets', 'system', 'claude', 'island', 'updates'])
    if (isObj(patch[k])) merged[k] = { ...current[k], ...patch[k] }
  return normalizeSettings(merged, current)
}

// Sorts items ({ id }) by an order list of ids; ids not in the list keep their place at the end.
export function sortByOrder(items, ids) {
  if (!Array.isArray(ids)) return items
  const at = (id) => {
    const i = ids.indexOf(id)
    return i < 0 ? ids.length : i
  }
  return items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => at(a.it.id) - at(b.it.id) || a.i - b.i)
    .map((x) => x.it)
}
