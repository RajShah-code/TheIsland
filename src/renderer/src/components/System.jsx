// System tab: live meters and quick controls. Data comes from the main process (island:system); CPU,
// RAM, GPU, disk and network only update while this tab is on screen (App.jsx turns the watch on and
// off). Nothing here runs a timer while the tab is hidden: meters only change on a push, the battery
// listens to its own events, and the only timers are the slider throttle and the sleep confirm, both
// started by a click or drag.
import { useEffect, useRef, useState } from 'react'

// Declared for the future settings window, which will hide and reorder these. The tab is rendered
// from this list. kind: 'meter' (left column) or 'control' (right column); layout tells a control
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

const METERS_W = 250
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

function Bar({ value }) {
  const ok = typeof value === 'number'
  return (
    <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10">
      <div
        className={`h-full rounded-full transition-[width] duration-300 ${value > 85 ? 'bg-amber-400' : 'bg-white/70'}`}
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
      <Bar value={level} />
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

function Icon({ children }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

function VolumeControl({ s, active }) {
  const a = s.audio
  const muted = a.available && a.muted
  return (
    <div className="flex h-7 items-center gap-2">
      <button
        onClick={() => send('mute', 'toggle')}
        disabled={!a.available}
        title={muted ? 'Unmute' : 'Mute'}
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full transition-colors hover:bg-white/12 disabled:opacity-30 ${
          muted ? 'text-rose-300' : 'text-white/80'
        }`}
      >
        <Icon>
          <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor" stroke="none" />
          {muted ? <path d="M16 9.5l5 5M21 9.5l-5 5" /> : <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />}
        </Icon>
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
        <Icon>
          <circle cx="12" cy="12" r="3.5" />
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
        </Icon>
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

function Pill({ on, disabled, onClick, children, title }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors disabled:opacity-30 ${
        on ? 'bg-white text-black hover:bg-white/85' : 'bg-white/10 text-white/75 hover:bg-white/15'
      }`}
    >
      {children}
    </button>
  )
}

function RadioToggle({ name, cmd, value }) {
  return (
    <Pill
      on={value === true}
      disabled={value === null || value === undefined}
      title={value == null ? `No ${name} on this PC` : undefined}
      onClick={() => send(cmd, !value)}
    >
      {name}
    </Pill>
  )
}

// Sleep needs a second click within a few seconds. The confirm timer only exists after a click and is
// dropped when the tab is no longer visible.
function SleepButton({ active }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed || !active) return setArmed(false)
    const t = setTimeout(() => setArmed(false), SLEEP_CONFIRM_MS)
    return () => clearTimeout(t)
  }, [armed, active])
  return (
    <Pill
      on={armed}
      onClick={() => {
        if (!armed) return setArmed(true)
        setArmed(false)
        send('sleep')
      }}
    >
      {armed ? 'Click again to sleep' : 'Sleep'}
    </Pill>
  )
}

const CONTROLS = {
  volume: (p) => <VolumeControl {...p} />,
  brightness: (p) => <BrightnessControl {...p} />,
  wifi: ({ s }) => <RadioToggle name="Wi-Fi" cmd="wifi" value={s.radios.wifi} />,
  bluetooth: ({ s }) => <RadioToggle name="Bluetooth" cmd="bluetooth" value={s.radios.bluetooth} />,
  keepAwake: ({ s }) => (
    <Pill on={s.keepAwake} title="Keep the screen on" onClick={() => send('keepAwake', !s.keepAwake)}>
      Keep awake
    </Pill>
  ),
  lock: () => <Pill onClick={() => send('lock')}>Lock</Pill>,
  sleep: ({ active }) => <SleepButton active={active} />
}

// Consecutive pill controls share one wrapping row; row controls take a line each.
function groupControls(items) {
  const out = []
  for (const it of items) {
    const last = out[out.length - 1]
    if (it.layout === 'pill' && Array.isArray(last)) last.push(it)
    else out.push(it.layout === 'pill' ? [it] : it)
  }
  return out
}

export function SystemPanel({ system, settings, active }) {
  const hidden = new Set(settings?.system?.hidden || [])
  const shown = SYSTEM_ITEMS.filter((it) => !hidden.has(it.id))
  const meters = shown.filter((it) => it.kind === 'meter' && METERS[it.id])
  const controls = groupControls(shown.filter((it) => it.kind === 'control' && CONTROLS[it.id]))
  const props = { s: system, active }
  if (!meters.length && !controls.length) return <p className="text-xs text-white/45">Nothing to show</p>

  return (
    <div className="flex items-stretch">
      {meters.length > 0 && (
        <div className="flex flex-col justify-center gap-1" style={{ width: METERS_W }}>
          {meters.map((it) => {
            const M = METERS[it.id]
            return <M key={it.id} {...props} />
          })}
        </div>
      )}
      {meters.length > 0 && controls.length > 0 && <div className="mx-4 w-px bg-white/10" />}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
        {controls.map((g) =>
          Array.isArray(g) ? (
            <div key={g[0].id} className="flex flex-wrap gap-1.5 pt-0.5">
              {g.map((it) => {
                const C = CONTROLS[it.id]
                return <C key={it.id} {...props} />
              })}
            </div>
          ) : (
            (() => {
              const C = CONTROLS[g.id]
              return <C key={g.id} {...props} />
            })()
          )
        )}
      </div>
    </div>
  )
}
