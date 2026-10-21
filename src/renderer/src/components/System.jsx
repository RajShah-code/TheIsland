// System tab: live meters on the left, Windows Quick Settings style controls on the right (sliders,
// the sound output picker and a grid of tiles). Data comes from the main process (island:system); CPU,
// RAM, GPU, disk and network only update while this tab is on screen (App.jsx turns the watch on and
// off). Nothing here runs a timer while the tab is hidden: meters only change on a push, the battery
// listens to its own events, and the only timers are the slider throttle and the sleep confirm, both
// started by a click or drag.
import { useEffect, useRef, useState } from 'react'
import { SYSTEM_ITEMS, isSystemControl, sortByOrder } from '../../../shared/settings-model.mjs'
import { Icon, SYSTEM_ICONS } from './icons'

// The tab is rendered from SYSTEM_ITEMS (declared in the shared settings model, so the main process
// can validate settings.system and the settings window can list them), in the user's order.
export { SYSTEM_ITEMS }

const METERS_W = 250
// The open island is at most about 380 px tall; this keeps the tab inside it (the column scrolls).
const CONTROLS_MAX_H = 296
const THROTTLE_MS = 80
// After a drag ends, keep showing our value a moment so a late push can't make the thumb jump.
const HOLD_MS = 600
const SLEEP_CONFIRM_MS = 3000

const send = (cmd, value) => window.island.system(cmd, value)

// undefined: not sampled yet. null: not available on this PC.
function missing(v) {
  if (v === undefined) return '...'
  if (v === null) return 'n/a'
  return null
}

function rate(v) {
  const m = missing(v)
  if (m) return m
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s']
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return (i === 0 || v >= 100 ? Math.round(v) : v.toFixed(1)) + ' ' + units[i]
}

const gb = (bytes) => (bytes / 1024 ** 3).toFixed(1)

// Load bars warn when high; pass color to override (the battery is good when high).
function Bar({ value, color }) {
  const ok = typeof value === 'number'
  return (
    <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10">
      <div
        className={`h-full rounded-full transition-[width] duration-300 ${color || (value > 85 ? 'bg-amber-400' : 'bg-white/70')}`}
        style={{ width: ok ? Math.max(0, Math.min(100, value)) + '%' : 0 }}
      />
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex h-5 items-center gap-2.5 text-[11px]">
      <span className="w-[52px] shrink-0 text-white/50">{label}</span>
      {children}
    </div>
  )
}

function Value({ children, wide }) {
  return (
    <span className={`shrink-0 text-right text-white/85 tabular-nums ${wide ? 'w-[110px]' : 'w-[70px]'}`}>
      {children}
    </span>
  )
}

function PercentMeter({ label, value }) {
  return (
    <Row label={label}>
      <Bar value={value} />
      <Value>{missing(value) ?? Math.round(value) + '%'}</Value>
    </Row>
  )
}

function Pair({ a, b, aLabel, bLabel }) {
  return (
    <span className="flex min-w-0 flex-1 justify-between gap-2 text-white/85 tabular-nums">
      <span className="truncate">
        <span className="text-white/40">{aLabel} </span>
        {a}
      </span>
      <span className="truncate">
        <span className="text-white/40">{bLabel} </span>
        {b}
      </span>
    </span>
  )
}

// Battery from the page itself (navigator.getBattery), listening only while the tab is visible.
function useBattery(active) {
  const [battery, setBattery] = useState(undefined)
  useEffect(() => {
    if (!active) return
    if (!navigator.getBattery) return setBattery(null)
    let alive = true
    let bat = null
    const read = () => alive && bat && setBattery({ level: bat.level, charging: bat.charging })
    const events = ['levelchange', 'chargingchange']
    navigator
      .getBattery()
      .then((b) => {
        if (!alive) return
        bat = b
        read()
        events.forEach((ev) => bat.addEventListener(ev, read))
      })
      .catch(() => alive && setBattery(null))
    return () => {
      alive = false
      if (bat) events.forEach((ev) => bat.removeEventListener(ev, read))
    }
  }, [active])
  return battery
}

function BatteryMeter({ active }) {
  const b = useBattery(active)
  const level = b ? Math.round(b.level * 100) : b
  const note = b ? (b.charging ? (level >= 100 ? 'plugged in' : 'charging') : '') : ''
  return (
    <Row label="Battery">
      <Bar value={level} color={level >= 90 ? 'bg-emerald-400' : level <= 20 ? 'bg-rose-500' : 'bg-white/70'} />
      <Value wide>
        {missing(level) ?? level + '%'}
        {note && <span className="text-white/40"> {note}</span>}
      </Value>
    </Row>
  )
}

const METERS = {
  cpu: ({ s }) => <PercentMeter label="CPU" value={s.cpu} />,
  ram: ({ s }) => {
    const p = typeof s.ramUsed === 'number' && s.ramTotal ? (s.ramUsed / s.ramTotal) * 100 : s.ramUsed
    return (
      <Row label="Memory">
        <Bar value={p} />
        <Value wide>
          {missing(s.ramUsed) ?? (
            <>
              {gb(s.ramUsed)}/{gb(s.ramTotal)} GB <span className="text-white/40">{Math.round(p)}%</span>
            </>
          )}
        </Value>
      </Row>
    )
  },
  gpu: ({ s }) => <PercentMeter label="GPU" value={s.gpu} />,
  disk: ({ s }) => (
    <Row label="Disk">
      <Pair aLabel="R" a={rate(s.diskRead)} bLabel="W" b={rate(s.diskWrite)} />
    </Row>
  ),
  network: ({ s }) => (
    <Row label="Network">
      <Pair aLabel="↓" a={rate(s.netDown)} bLabel="↑" b={rate(s.netUp)} />
    </Row>
  ),
  battery: ({ active }) => <BatteryMeter active={active} />
}

// A range input that sends while dragging (at most every THROTTLE_MS, plus the final value on
// release) and ignores pushed values while the user holds it.
function useSlider(value, onSend, active) {
  const [draft, setDraft] = useState(null)
  const r = useRef({ last: 0, timer: null, hold: null, pending: null, end: null })
  const sendRef = useRef(onSend)
  sendRef.current = onSend

  useEffect(
    () => () => {
      const c = r.current
      clearTimeout(c.timer)
      clearTimeout(c.hold)
      if (c.end) c.end()
    },
    []
  )
  // The island closed mid-drag (the release may never reach this window): finish the drag.
  useEffect(() => {
    if (!active && r.current.end) r.current.end()
  }, [active])

  function flush() {
    const c = r.current
    clearTimeout(c.timer)
    c.timer = null
    if (c.pending === null) return
    sendRef.current(c.pending)
    c.pending = null
    c.last = Date.now()
  }
  function release(delay) {
    const c = r.current
    clearTimeout(c.hold)
    c.hold = setTimeout(() => setDraft(null), delay)
  }
  function onChange(e) {
    const c = r.current
    const v = Number(e.target.value)
    setDraft(v)
    c.pending = v
    clearTimeout(c.hold)
    const wait = THROTTLE_MS - (Date.now() - c.last)
    if (wait <= 0) flush()
    else if (!c.timer) c.timer = setTimeout(flush, wait)
    if (!c.end) release(HOLD_MS + THROTTLE_MS) // a change without a drag (a click on the track)
  }
  function onPointerDown() {
    const c = r.current
    if (c.end) return
    clearTimeout(c.hold)
    c.end = () => {
      window.removeEventListener('pointerup', c.end)
      window.removeEventListener('pointercancel', c.end)
      c.end = null
      flush()
      release(HOLD_MS)
    }
    window.addEventListener('pointerup', c.end)
    window.addEventListener('pointercancel', c.end)
  }
  return { value: draft ?? value, onChange, onPointerDown }
}

function Slider({ value, onSend, disabled, label, active }) {
  const s = useSlider(value ?? 0, onSend, active)
  return (
    <input
      type="range"
      min="0"
      max="100"
      step="1"
      aria-label={label}
      disabled={disabled}
      value={s.value}
      onChange={s.onChange}
      onPointerDown={s.onPointerDown}
      className="island-range min-w-0 flex-1"
      style={{ '--val': s.value + '%' }}
    />
  )
}

const focusRing =
  'outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-black'

function VolumeControl({ s, active }) {
  const a = s.audio
  const muted = a.available && a.muted
  return (
    <div className="flex h-7 items-center gap-2">
      <button
        type="button"
        onClick={() => send('mute', 'toggle')}
        disabled={!a.available}
        title={muted ? 'Unmute' : 'Mute'}
        aria-label={muted ? 'Unmute' : 'Mute'}
        aria-pressed={muted}
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full transition-colors hover:bg-white/12 disabled:opacity-30 ${focusRing} ${
          muted ? 'text-rose-300' : 'text-white/80'
        }`}
      >
        <Icon name={muted ? 'speakerMuted' : 'speaker'} />
      </button>
      <Slider value={a.volume} disabled={!a.available} label="Volume" active={active} onSend={(v) => send('volume', v)} />
      <span className="w-[42px] shrink-0 text-right text-[11px] text-white/60 tabular-nums">
        {a.available ? (muted ? 'Muted' : a.volume + '%') : 'n/a'}
      </span>
    </div>
  )
}

function BrightnessControl({ s, active }) {
  const b = s.brightness
  return (
    <div className="flex h-7 items-center gap-2">
      <span className={`grid h-7 w-7 shrink-0 place-items-center text-white/80 ${b.available ? '' : 'opacity-30'}`}>
        <Icon name="sun" />
      </span>
      {b.available ? (
        <>
          <Slider value={b.value} label="Brightness" active={active} onSend={(v) => send('brightness', v)} />
          <span className="w-[42px] shrink-0 text-right text-[11px] text-white/60 tabular-nums">{b.value}%</span>
        </>
      ) : (
        <span className="text-[11px] text-white/40">Brightness is not adjustable on this display</span>
      )}
    </div>
  )
}

// Sound output: a compact button showing the default device that opens a short list right below it
// (in the page, not a native popup, so it can never leave the island window).
function OutputPicker({ s, active }) {
  const [open, setOpen] = useState(false)
  const outputs = Array.isArray(s.outputs) ? s.outputs : []
  const current = outputs.find((o) => o.default)
  const listRef = useRef(null)
  useEffect(() => {
    if (!active || outputs.length === 0) setOpen(false)
  }, [active, outputs.length])
  useEffect(() => {
    const el = listRef.current
    if (open && el) (el.querySelector('[aria-checked="true"]') || el.querySelector('button'))?.focus()
  }, [open])
  const none = outputs.length === 0
  return (
    <div className="flex flex-col gap-1">
      <div className="flex h-7 items-center gap-2">
        <span className={`grid h-7 w-7 shrink-0 place-items-center text-white/80 ${none ? 'opacity-30' : ''}`}>
          <Icon name="headphones" />
        </span>
        <button
          type="button"
          disabled={none}
          aria-expanded={open}
          aria-haspopup="true"
          aria-label={`Sound output: ${current ? current.name : 'none'}`}
          title={none ? 'No sound outputs reported yet' : 'Choose the sound output'}
          onClick={() => setOpen((o) => !o)}
          className={`flex h-7 min-w-0 flex-1 items-center gap-2 rounded-lg bg-white/8 px-2.5 text-left text-[11px] text-white/85 transition-colors hover:bg-white/14 disabled:opacity-35 disabled:hover:bg-white/8 ${focusRing}`}
        >
          <span className="min-w-0 flex-1 truncate">{none ? 'Sound output' : current ? current.name : 'Choose output'}</span>
          <Icon name="chevronDown" size={12} className={`shrink-0 text-white/50 ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {open && (
        <div
          ref={listRef}
          role="radiogroup"
          aria-label="Sound output"
          className="ml-9 flex flex-col rounded-lg bg-white/6 p-1"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation()
              setOpen(false)
            }
          }}
        >
          {outputs.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={o.default}
              onClick={() => {
                if (!o.default) send('output', o.id)
                setOpen(false)
              }}
              className={`flex h-6 items-center gap-2 rounded-md px-2 text-left text-[11px] transition-colors hover:bg-white/10 ${focusRing} ${
                o.default ? 'text-white' : 'text-white/70'
              }`}
            >
              <span className="grid w-3 shrink-0 place-items-center text-accent">
                {o.default && <Icon name="check" size={12} strokeWidth={2} />}
              </span>
              <span className="min-w-0 flex-1 truncate">{o.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// One Quick Settings tile. style: 'both' (icon over label), 'icon' (square, label as tooltip) or
// 'label' (text pill). on: true/false for toggles, undefined for tiles without a state. unavailable:
// a reason string dims the tile and makes it do nothing. link: opens a Settings page (small arrow).
function Tile({ style, name, icon, on, unavailable, link, title, onClick }) {
  const off = !!unavailable
  const tip = unavailable || title || name
  const hint = link && !off
  const look = on
    ? 'bg-accent text-white hover:bg-accent/85'
    : 'bg-white/8 text-white/80 hover:bg-white/14 hover:text-white'
  const shape =
    style === 'icon'
      ? 'relative grid h-9 w-9 place-items-center rounded-lg'
      : style === 'label'
        ? 'flex h-7 items-center gap-1 rounded-full px-3 text-[11px] font-medium'
        : 'relative flex h-[54px] min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 pt-0.5'
  return (
    <button
      type="button"
      onClick={off ? undefined : onClick}
      aria-disabled={off || undefined}
      aria-pressed={on === undefined || link ? undefined : on}
      aria-label={style === 'icon' || off ? `${name}${off ? ', ' + unavailable : ''}` : undefined}
      title={style === 'icon' || off || title ? tip : undefined}
      className={`${shape} transition-colors ${focusRing} ${off ? 'cursor-default bg-white/5 text-white/30' : look}`}
    >
      {style !== 'label' && <Icon name={icon} />}
      {style === 'both' && (
        <span className="line-clamp-2 w-full text-center text-[10px] leading-[1.15] font-medium">{name}</span>
      )}
      {style === 'label' && name}
      {hint &&
        (style === 'label' ? (
          <Icon name="chevronRight" size={10} strokeWidth={2} className="-mr-1 opacity-60" />
        ) : (
          <Icon
            name="arrowUpRight"
            size={style === 'icon' ? 7 : 8}
            strokeWidth={2}
            className={`absolute opacity-55 ${style === 'icon' ? 'top-1 right-1' : 'top-1.5 right-1.5'}`}
          />
        ))}
    </button>
  )
}

const notHere = (what) => `${what} is not available on this PC`

// What each tile shows and does, from the system state. Missing values (an older helper, or a PC
// without the feature) come through as null or undefined and dim the tile.
function tileFor(id, s, sleep) {
  const q = s.quick || {}
  const toggle = (v, what, cmd) => ({
    on: v === true,
    unavailable: v == null ? notHere(what) : null,
    onClick: () => send(cmd, !v)
  })
  const keys = (name) => ({ onClick: () => send('keys', name) })
  const open = (page, title) => ({ link: true, title, onClick: () => send('open', page) })
  switch (id) {
    case 'wifi':
      return toggle(s.radios?.wifi, 'Wi-Fi', 'wifi')
    case 'bluetooth':
      return toggle(s.radios?.bluetooth, 'Bluetooth', 'bluetooth')
    case 'airplane':
      return toggle(q.airplane, 'Airplane mode', 'airplane')
    case 'hotspot':
      return toggle(q.hotspot, 'Mobile hotspot', 'hotspot')
    case 'energySaver':
      // Windows doesn't let other apps switch it, so it shows the state and opens its settings.
      return {
        ...open(
          'energy',
          q.energySaver == null ? 'Open Energy saver settings' : `Energy saver is ${q.energySaver ? 'on' : 'off'}. Change it in Settings`
        ),
        on: q.energySaver === true
      }
    case 'nightLight':
      return q.nightLight == null ? open('nightlight', 'Open Night light settings') : toggle(q.nightLight, 'Night light', 'nightlight')
    case 'dnd':
      return open('focus', 'Open Do not disturb and Focus settings')
    case 'accessibility':
      return open('accessibility', 'Open Accessibility settings')
    case 'nearby':
      return open('nearby', 'Open Nearby sharing settings')
    case 'settings':
      return open('settings', 'Open Windows Settings')
    case 'cast':
      return { ...keys('cast'), title: 'Cast to a wireless display (Win+K)' }
    case 'project':
      return { ...keys('project'), title: 'Project to a second screen (Win+P)' }
    case 'captions':
      return { ...keys('captions'), title: 'Live captions (Win+Ctrl+L)' }
    case 'keyboard':
      return { ...keys('keyboard'), title: 'Switch keyboard layout (Win+Space)' }
    case 'screenshot':
      return { ...keys('screenshot'), title: 'Snipping Tool (Win+Shift+S)' }
    case 'notifications':
      return { ...keys('notifications'), title: 'Notifications (Win+N)' }
    case 'colorFilters':
      return {
        on: q.colorFilters === true,
        unavailable: q.colorFilters == null ? notHere('Color filters') : null,
        onClick: () => send('colorfilters', 'toggle')
      }
    case 'mic': {
      const ok = q.micAvailable === true && q.micMuted != null
      return {
        on: q.micMuted === true,
        icon: q.micMuted ? 'micOff' : 'mic',
        unavailable: ok ? null : 'No microphone found',
        title: q.micMuted ? 'Microphone is muted. Click to unmute' : 'Mute the microphone',
        onClick: () => send('micmute', 'toggle')
      }
    }
    case 'keepAwake':
      return { on: s.keepAwake === true, title: 'Keep the screen on', onClick: () => send('keepAwake', !s.keepAwake) }
    case 'lock':
      return { title: 'Lock the PC', onClick: () => send('lock') }
    case 'sleep':
      return {
        on: sleep.armed,
        name: sleep.armed ? 'Click again' : undefined,
        title: sleep.armed ? 'Click again to sleep' : 'Sleep (asks again first)',
        onClick: sleep.click
      }
  }
  return null
}

// Sleep needs a second click within a few seconds. The confirm timer only exists after a click and is
// dropped when the tab is no longer visible.
function useSleepConfirm(active) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed || !active) return setArmed(false)
    const t = setTimeout(() => setArmed(false), SLEEP_CONFIRM_MS)
    return () => clearTimeout(t)
  }, [armed, active])
  return {
    armed,
    click() {
      if (!armed) return setArmed(true)
      setArmed(false)
      send('sleep')
    }
  }
}

function Tiles({ items, s, style, sleep }) {
  return (
    <div className={style === 'both' ? 'grid grid-cols-4 gap-1.5' : 'flex flex-wrap gap-1.5'}>
      {items.map((it) => {
        const t = tileFor(it.id, s, sleep)
        if (!t) return null
        return (
          <Tile
            key={it.id}
            style={style}
            name={t.name || it.name}
            icon={t.icon || SYSTEM_ICONS[it.id]}
            on={t.on}
            unavailable={t.unavailable}
            link={t.link}
            title={t.title}
            onClick={t.onClick}
          />
        )
      })}
    </div>
  )
}

const ROWS = {
  volume: VolumeControl,
  brightness: BrightnessControl,
  output: OutputPicker
}

// Consecutive tiles share one grid; sliders and the output picker take a line each.
function groupControls(items) {
  const out = []
  for (const it of items) {
    const last = out[out.length - 1]
    if (ROWS[it.id]) out.push(it)
    else if (Array.isArray(last)) last.push(it)
    else out.push([it])
  }
  return out
}

export function SystemPanel({ system, settings, active }) {
  const sleep = useSleepConfirm(active)
  const hidden = new Set(settings?.system?.hidden || [])
  const style = settings?.system?.controlStyle || 'both'
  const shown = sortByOrder(SYSTEM_ITEMS, settings?.system?.order).filter((it) => !hidden.has(it.id))
  const meters = shown.filter((it) => it.kind === 'meter' && METERS[it.id])
  const controls = groupControls(shown.filter((it) => isSystemControl(it)))
  const props = { s: system, active }
  if (!meters.length && !controls.length) return <p className="text-xs text-white/45">Nothing to show</p>

  return (
    <div className="flex items-stretch">
      {meters.length > 0 && (
        <div className="flex shrink-0 flex-col justify-center gap-1" style={{ width: METERS_W }}>
          {meters.map((it) => {
            const M = METERS[it.id]
            return <M key={it.id} {...props} />
          })}
        </div>
      )}
      {meters.length > 0 && controls.length > 0 && <div className="mx-4 w-px shrink-0 bg-white/10" />}
      <div
        className="scroll-thin -my-1 -mr-2 -ml-1 flex min-w-0 flex-1 flex-col gap-1.5 overflow-y-auto py-1 pr-2 pl-1"
        style={{ maxHeight: CONTROLS_MAX_H }}
      >
        {controls.map((g) => {
          if (Array.isArray(g)) return <Tiles key={g[0].id} items={g} s={system} style={style} sleep={sleep} />
          const C = ROWS[g.id]
          return <C key={g.id} {...props} />
        })}
      </div>
    </div>
  )
}
