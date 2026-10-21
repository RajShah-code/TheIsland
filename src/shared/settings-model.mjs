// The settings model, shared by the main process (which validates and saves) and the renderers (which
// read it). normalizeSettings() turns anything (the config file, a patch from the settings window) into
// a clean object with known keys only; a bad value falls back to `base`, then to the default. Secrets
// like the calendar URL are never part of it, so this object is safe to send to any renderer.

export const WIDGET_IDS = ['music', 'clock', 'calendar']

// System tab items. kind: 'meter' (left column) or 'control' (right column); layout tells a control
// whether it takes a full row ('row') or sits with its neighbours as a pill ('pill').
export const SYSTEM_ITEMS = [
  { id: 'cpu', name: 'CPU', kind: 'meter' },
  { id: 'ram', name: 'Memory', kind: 'meter' },
  { id: 'gpu', name: 'GPU', kind: 'meter' },
  { id: 'disk', name: 'Disk', kind: 'meter' },
  { id: 'network', name: 'Network', kind: 'meter' },
  { id: 'battery', name: 'Battery', kind: 'meter' },
  { id: 'volume', name: 'Volume', kind: 'control', layout: 'row' },
  { id: 'brightness', name: 'Brightness', kind: 'control', layout: 'row' },
  { id: 'wifi', name: 'Wi-Fi', kind: 'control', layout: 'pill' },
  { id: 'bluetooth', name: 'Bluetooth', kind: 'control', layout: 'pill' },
  { id: 'keepAwake', name: 'Keep awake', kind: 'control', layout: 'pill' },
  { id: 'lock', name: 'Lock', kind: 'control', layout: 'pill' },
  { id: 'sleep', name: 'Sleep', kind: 'control', layout: 'pill' }
]
export const SYSTEM_IDS = SYSTEM_ITEMS.map((it) => it.id)

export const PILL_LEFT = ['time', 'date', 'none']
export const PILL_RIGHT = ['none', 'time', 'date']
// The relay gives up after 290 s and Claude Code kills the hook at 300 s (see hook/theisland-relay.cjs),
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
  system: { order: [...SYSTEM_IDS], hidden: [] },
  claude: { buddy: true },
  island: { ghostOpacity: 0.15 }
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const bool = (v, base) => (typeof v === 'boolean' ? v : base)
const oneOf = (v, allowed, base) => (allowed.includes(v) ? v : base)

function num(v, lo, hi, base) {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : base
}

// Known ids in the given order, no repeats, then any missing ones in their default order.
function order(v, ids, base) {
  if (!Array.isArray(v)) return base
  const out = []
  for (const id of v) if (ids.includes(id) && !out.includes(id)) out.push(id)
  for (const id of ids) if (!out.includes(id)) out.push(id)
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
      hidden: hidden(g('system').hidden, SYSTEM_IDS, base.system?.hidden ?? d.system.hidden)
    },
    claude: { buddy: bool(g('claude').buddy, base.claude?.buddy ?? d.claude.buddy) },
    island: {
      ghostOpacity:
        Math.round(num(g('island').ghostOpacity, GHOST_MIN, GHOST_MAX, base.island?.ghostOpacity ?? d.island.ghostOpacity) * 100) /
        100
    }
  }
}

// Applies a partial settings object (same shape, any subset of keys) on top of `current`. Unknown keys
// are ignored and invalid values keep the current one.
export function applySettingsPatch(current, patch) {
  if (!isObj(patch)) return current
  const merged = { ...current }
  for (const k of ['approvalsEnabled', 'approvalTimeoutSec']) if (k in patch) merged[k] = patch[k]
  for (const k of ['pill', 'widgets', 'system', 'claude', 'island'])
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
