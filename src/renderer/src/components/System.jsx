// System tab, laid out like the Mac's Control Center: rounded modules for connectivity (Wi-Fi,
// Bluetooth, ...), live stats as ring gauges, Display and Sound sliders with the output picker, and a
// grid of round buttons for everything else. Data comes from the main process (island:system); CPU,
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

const LEFT_W = 288
// The open island is at most about 380 px tall; this keeps the tab inside it (the columns scroll).
const MAX_H = 300
// Shown as Control Center style rows with a status line, in the user's order.
const CONNECTIVITY = new Set(['wifi', 'bluetooth', 'airplane', 'hotspot'])
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

// A module: one rounded group, like the blocks of the Mac's Control Center.
function Module({ title, aside, className = '', children }) {
  return (
    <section className={`rounded-2xl bg-white/[0.08] p-2 ring-1 ring-white/[0.06] ring-inset ${className}`}>
      {(title || aside) && (
        <div className="mb-1.5 flex h-3.5 items-center justify-between px-1">
          <h3 className="text-[11px] font-semibold text-white/85">{title}</h3>
          {aside}
        </div>
      )}
      {children}
    </section>
  )
}

// A ring gauge (Apple Watch style). Warns when a load is high; pass color for the battery.
function Ring({ value, label, sub, color }) {
  const ok = typeof value === 'number'
  const v = ok ? Math.max(0, Math.min(100, value)) : 0
  const R = 17
  const C = 2 * Math.PI * R
  const stroke = color || (v > 85 ? '#fbbf24' : '#fff')
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center">
      <div className="relative h-11 w-11">
        <svg viewBox="0 0 44 44" className="h-11 w-11 -rotate-90" aria-hidden="true">
          <circle cx="22" cy="22" r={R} fill="none" stroke="rgb(255 255 255 / 0.12)" strokeWidth="4.5" />
          <circle
            cx="22"
            cy="22"
            r={R}
            fill="none"
            stroke={stroke}
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - v / 100)}
            opacity={ok && v > 0 ? 1 : 0}
            className="transition-[stroke-dashoffset] duration-300"
          />
        </svg>
        <span className="absolute inset-0 grid place-items-center text-[10px] font-semibold text-white tabular-nums">
          {missing(value) ?? Math.round(v)}
        </span>
      </div>
      <span className="mt-1 text-[10px] font-medium text-white/70">{label}</span>
      <span className="h-3 max-w-full truncate text-[9px] text-white/40 tabular-nums">{sub}</span>
    </div>
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

function BatteryRing({ active }) {
  const b = useBattery(active)
  const level = b ? Math.round(b.level * 100) : b
  const sub = b ? (b.charging ? (level >= 100 ? 'Plugged in' : 'Charging') : 'On battery') : ''
  return <Ring label="Battery" value={level} sub={sub} color={level >= 90 ? '#34d399' : level <= 20 ? '#f43f5e' : '#fff'} />
}

const RINGS = {
  cpu: ({ s }) => <Ring label="CPU" value={s.cpu} />,
  ram: ({ s }) => {
    const p = typeof s.ramUsed === 'number' && s.ramTotal ? (s.ramUsed / s.ramTotal) * 100 : s.ramUsed
    return <Ring label="Memory" value={p} sub={typeof s.ramUsed === 'number' ? `${gb(s.ramUsed)} GB` : ''} />
  },
  gpu: ({ s }) => <Ring label="GPU" value={s.gpu} />,
  battery: ({ active }) => <BatteryRing active={active} />
}

// Transfer rates under the rings: an icon and two figures.
function Rate({ icon, label, a, b, aLabel, bLabel }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5 text-[10px]" title={label}>
      <Icon name={icon} size={12} className="shrink-0 text-white/45" />
      <span className="min-w-0 truncate text-white/85 tabular-nums">
        <span className="text-white/40">{aLabel}</span> {a} <span className="text-white/40">{bLabel}</span> {b}
      </span>
    </div>
  )
}

const RATES = {
  network: ({ s }) => <Rate icon="network" label="Network" aLabel="↓" a={rate(s.netDown)} bLabel="↑" b={rate(s.netUp)} />,
  disk: ({ s }) => <Rate icon="disk" label="Disk" aLabel="R" a={rate(s.diskRead)} bLabel="W" b={rate(s.diskWrite)} />
}

function StatsModule({ items, props }) {
  const rings = items.filter((it) => RINGS[it.id])
  const rates = items.filter((it) => RATES[it.id])
  return (
    <Module title="Activity">
      {rings.length > 0 && (
        <div className="flex">
          {rings.map((it) => {
            const R = RINGS[it.id]
            return <R key={it.id} {...props} />
          })}
        </div>
      )}
      {rates.length > 0 && (
        <div className={`flex flex-col gap-1 px-0.5 ${rings.length ? 'mt-1.5 border-t border-white/[0.07] pt-2' : ''}`}>
          {rates.map((it) => {
            const R = RATES[it.id]
            return <R key={it.id} {...props} />
          })}
        </div>
      )}
    </Module>
  )
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

// A thick Mac style slider. The fill always covers the left end, so the icon drawn there stays dark
// on white.
function Slider({ value, onSend, disabled, label, active, icon }) {
  const s = useSlider(value ?? 0, onSend, active)
  return (
    <div className={`relative flex min-w-0 flex-1 ${disabled ? 'opacity-35' : ''}`}>
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
        className="mac-range min-w-0 flex-1"
        style={{ '--fill': `calc(12px + (100% - 24px) * ${s.value / 100})` }}
      />
      {icon && (
        <span className="pointer-events-none absolute top-0 left-0 grid h-6 w-6 place-items-center text-black/60">
          <Icon name={icon} size={13} strokeWidth={1.8} />
        </span>
      )}
    </div>
  )
}

const focusRing =
  'outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-black'

function DisplayModule({ s, active }) {
  const b = s.brightness
  return (
    <Module title="Display">
      {b.available ? (
        <Slider value={b.value} label="Brightness" icon="sun" active={active} onSend={(v) => send('brightness', v)} />
      ) : (
        <p className="px-1 text-[10px] text-white/40">Brightness is not adjustable on this display</p>
      )}
    </Module>
  )
}

// Sound, like the Mac's: the volume slider, and the output device as a small button in the header
// that opens the list of outputs under the slider (in the page, not a native popup, so it can never
// leave the island window).
function SoundModule({ s, active, withVolume, withOutput }) {
  const a = s.audio
  const muted = a.available && a.muted
  const [open, setOpen] = useState(false)
  const outputs = withOutput && Array.isArray(s.outputs) ? s.outputs : []
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

  const outputButton = withOutput && (
    <button
      type="button"
      disabled={none}
      aria-expanded={open}
      aria-haspopup="true"
      aria-label={`Sound output: ${current ? current.name : 'none'}`}
      title={none ? 'No sound outputs reported yet' : current ? current.name : 'Choose the sound output'}
      onClick={() => setOpen((o) => !o)}
      className={`-my-1 -mr-1 flex h-5 max-w-[170px] min-w-0 items-center gap-1 rounded-full pr-1.5 pl-1 text-[10px] text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-35 ${focusRing} ${
        open ? 'bg-white/10 text-white' : ''
      }`}
    >
      <Icon name="headphones" size={11} strokeWidth={1.8} className="shrink-0" />
      <span className="min-w-0 truncate">{none ? 'Output' : current ? current.name : 'Choose output'}</span>
      <Icon name="chevronDown" size={10} strokeWidth={2} className={`shrink-0 ${open ? 'rotate-180' : ''}`} />
    </button>
  )

  return (
    <Module title="Sound" aside={outputButton}>
      {withVolume && (
        <div className="flex items-center gap-1.5">
          <Slider
            value={a.volume}
            disabled={!a.available}
            label="Volume"
            icon={muted ? 'speakerMuted' : 'speaker'}
            active={active}
            onSend={(v) => send('volume', v)}
          />
          <button
            type="button"
            onClick={() => send('mute', 'toggle')}
            disabled={!a.available}
            title={muted ? 'Unmute' : 'Mute'}
            aria-label={muted ? 'Unmute' : 'Mute'}
            aria-pressed={muted}
            className={`grid h-6 w-6 shrink-0 place-items-center rounded-full transition-colors disabled:opacity-30 ${focusRing} ${
              muted ? 'bg-rose-500 text-white' : 'bg-white/[0.12] text-white/75 hover:bg-white/20 hover:text-white'
            }`}
          >
            <Icon name="speakerMuted" size={13} />
          </button>
        </div>
      )}
      {open && (
        <div
          ref={listRef}
          role="radiogroup"
          aria-label="Sound output"
          className={`flex flex-col rounded-xl bg-black/30 p-1 ${withVolume ? 'mt-1.5' : ''}`}
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
    </Module>
  )
}

// The round button of a control: accent blue when on, translucent white otherwise. A link (opens a
// Settings page) gets a small arrow on its edge.
function Bubble({ icon, on, off, link, size }) {
  const look = off ? 'bg-white/[0.06] text-white/30' : on ? 'bg-accent text-white' : 'bg-white/[0.13] text-white/85'
  return (
    <span className={`relative grid shrink-0 place-items-center rounded-full transition-colors ${look}`} style={{ width: size, height: size }}>
      <Icon name={icon} size={size > 30 ? 16 : 14} />
      {link && !off && (
        <span className="absolute -top-0.5 -right-0.5 grid h-3 w-3 place-items-center rounded-full bg-neutral-700 text-white/80">
          <Icon name="arrowUpRight" size={7} strokeWidth={2.2} />
        </span>
      )}
    </span>
  )
}

// One control of the grid. style: 'both' (round button over a label, like the Mac's small modules),
// 'icon' (round button, label as tooltip) or 'label' (text pill). on: true/false for toggles,
// undefined for actions. unavailable: a reason string dims it and makes it do nothing.
function Tile({ style, name, icon, on, unavailable, link, title, onClick }) {
  const off = !!unavailable
  const tip = unavailable || title || name
  if (style === 'label') {
    return (
      <button
        type="button"
        onClick={off ? undefined : onClick}
        aria-disabled={off || undefined}
        aria-pressed={on === undefined || link ? undefined : on}
        title={tip}
        className={`flex h-7 items-center gap-1 rounded-full px-3 text-[11px] font-medium transition-colors ${focusRing} ${
          off ? 'cursor-default bg-white/5 text-white/30' : on ? 'bg-accent text-white' : 'bg-white/[0.1] text-white/85 hover:bg-white/[0.16]'
        }`}
      >
        {name}
        {link && !off && <Icon name="chevronRight" size={10} strokeWidth={2} className="-mr-1 opacity-60" />}
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={off ? undefined : onClick}
      aria-disabled={off || undefined}
      aria-pressed={on === undefined || link ? undefined : on}
      aria-label={style === 'icon' || off ? `${name}${off ? ', ' + unavailable : ''}` : undefined}
      title={tip}
      className={`group flex min-w-0 flex-col items-center gap-1 rounded-xl py-0.5 transition-colors ${focusRing} ${
        off ? 'cursor-default' : 'hover:bg-white/[0.06]'
      }`}
    >
      <Bubble icon={icon} on={on} off={off} link={link} size={style === 'icon' ? 34 : 32} />
      {style === 'both' && (
        <span className={`line-clamp-2 w-full px-0.5 text-center text-[9.5px] leading-[1.15] ${off ? 'text-white/30' : 'text-white/70'}`}>
          {name}
        </span>
      )}
    </button>
  )
}

// A connectivity row (Wi-Fi, Bluetooth, ...): round button, name and a status line.
function ConnectionRow({ name, icon, on, unavailable, onClick }) {
  const off = !!unavailable
  return (
    <button
      type="button"
      onClick={off ? undefined : onClick}
      aria-disabled={off || undefined}
      aria-pressed={off ? undefined : on}
      title={unavailable || undefined}
      className={`flex w-full items-center gap-2.5 rounded-xl p-1 text-left transition-colors ${focusRing} ${
        off ? 'cursor-default' : 'hover:bg-white/[0.06]'
      }`}
    >
      <Bubble icon={icon} on={on} off={off} size={28} />
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[11.5px] leading-tight font-semibold ${off ? 'text-white/35' : 'text-white/90'}`}>{name}</span>
        <span className="block truncate text-[10px] leading-tight text-white/45">{off ? 'Not available' : on ? 'On' : 'Off'}</span>
      </span>
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
    <div className={style === 'label' ? 'flex flex-wrap gap-1.5' : style === 'icon' ? 'grid grid-cols-6 gap-1' : 'grid grid-cols-6 gap-x-0.5 gap-y-0.5'}>
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

function ConnectivityModule({ items, s, sleep }) {
  return (
    <Module>
      {/* Two columns once there are three or more, like the Mac's connectivity block. */}
      <div className={items.length > 2 ? 'grid grid-cols-2 gap-0.5' : 'flex flex-col gap-0.5'}>
        {items.map((it) => {
          const t = tileFor(it.id, s, sleep)
          if (!t) return null
          return (
            <ConnectionRow
              key={it.id}
              name={it.name}
              icon={SYSTEM_ICONS[it.id]}
              on={t.on}
              unavailable={t.unavailable}
              onClick={t.onClick}
            />
          )
        })}
      </div>
    </Module>
  )
}

const columnClass = 'scroll-thin -my-1 flex min-w-0 flex-col gap-1.5 overflow-y-auto py-1'

export function SystemPanel({ system, settings, active }) {
  const sleep = useSleepConfirm(active)
  const hidden = new Set(settings?.system?.hidden || [])
  const style = settings?.system?.controlStyle || 'both'
  const shown = sortByOrder(SYSTEM_ITEMS, settings?.system?.order).filter((it) => !hidden.has(it.id))
  const has = (id) => shown.some((it) => it.id === id)
  const meters = shown.filter((it) => it.kind === 'meter')
  const connections = shown.filter((it) => CONNECTIVITY.has(it.id))
  const tiles = shown.filter((it) => isSystemControl(it) && !CONNECTIVITY.has(it.id) && !['volume', 'brightness', 'output'].includes(it.id))
  const props = { s: system, active }
  const left = connections.length > 0 || meters.length > 0
  const right = has('brightness') || has('volume') || has('output') || tiles.length > 0
  if (!left && !right) return <p className="text-xs text-white/45">Nothing to show</p>

  return (
    <div className="flex items-start gap-3">
      {left && (
        <div className={`${columnClass} shrink-0`} style={{ width: right ? LEFT_W : '100%', maxHeight: MAX_H }}>
          {connections.length > 0 && <ConnectivityModule items={connections} s={system} sleep={sleep} />}
          {meters.length > 0 && <StatsModule items={meters} props={props} />}
        </div>
      )}
      {right && (
        <div className={`${columnClass} flex-1 pr-1`} style={{ maxHeight: MAX_H }}>
          {has('brightness') && <DisplayModule {...props} />}
          {(has('volume') || has('output')) && <SoundModule {...props} withVolume={has('volume')} withOutput={has('output')} />}
          {tiles.length > 0 && (
            <Module>
              <Tiles items={tiles} s={system} style={style} sleep={sleep} />
            </Module>
          )}
        </div>
      )}
    </div>
  )
}
