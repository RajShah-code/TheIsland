// Small building blocks for the settings window: cards, rows, switch, segmented choice, slider and a
// reorderable list (native HTML5 drag plus up/down buttons for the keyboard). Nothing animates on its
// own; the few transitions only run while a control changes.
import { useEffect, useRef, useState } from 'react'

export function Card({ title, help, children }) {
  return (
    <section className="space-y-2">
      {(title || help) && (
        <div className="px-1">
          {title && <h3 className="text-[13px] font-semibold text-white/85">{title}</h3>}
          {help && <p className="text-[12px] leading-snug text-white/45">{help}</p>}
        </div>
      )}
      <div className="divide-y divide-white/[0.06] rounded-xl bg-panel ring-1 ring-white/[0.07]">{children}</div>
    </section>
  )
}

export function Row({ label, help, htmlFor, children, id }) {
  return (
    <div className="flex min-h-[60px] items-center gap-6 px-4 py-3">
      <div className="min-w-0 flex-1">
        {htmlFor ? (
          <label htmlFor={htmlFor} id={id} className="block text-[13px] font-medium text-white/90">
            {label}
          </label>
        ) : (
          <div id={id} className="text-[13px] font-medium text-white/90">
            {label}
          </div>
        )}
        {help && <p className="mt-0.5 text-[12px] leading-snug text-white/45">{help}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  )
}

export function Toggle({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors duration-150 disabled:opacity-40 ${
        checked ? 'bg-accent' : 'bg-white/[0.16] hover:bg-white/[0.22]'
      }`}
    >
      <span
        className={`absolute top-[3px] left-[3px] h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-150 ${
          checked ? 'translate-x-4' : ''
        }`}
      />
    </button>
  )
}

// A radio group drawn as a segmented control. Arrow keys move the choice, like native radios.
export function Segmented({ value, options, onChange, labelledBy }) {
  const refs = useRef([])
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  )
  function onKeyDown(e) {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const next = (index + step + options.length) % options.length
    onChange(options[next].value)
    refs.current[next]?.focus()
  }
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="flex rounded-lg bg-white/[0.06] p-0.5" onKeyDown={onKeyDown}>
      {options.map((o, i) => {
        const on = i === index
        return (
          <button
            key={o.value}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={`rounded-md px-3 py-1 text-[12px] font-medium transition-colors ${
              on ? 'bg-white/[0.16] text-white shadow-sm' : 'text-white/55 hover:text-white/85'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// A range that saves while dragging (at most every 120 ms, plus the final value) and shows its own
// value until the user lets go, so a late push can't make the thumb jump.
export function Slider({ value, min, max, step, onCommit, format, label, id }) {
  const [draft, setDraft] = useState(null)
  const t = useRef({ timer: null, pending: null, hold: null })
  const commitRef = useRef(onCommit)
  commitRef.current = onCommit
  useEffect(
    () => () => {
      clearTimeout(t.current.timer)
      clearTimeout(t.current.hold)
    },
    []
  )
  function flush() {
    const c = t.current
    clearTimeout(c.timer)
    c.timer = null
    if (c.pending === null) return
    commitRef.current(c.pending)
    c.pending = null
  }
  function onChange(e) {
    const v = Number(e.target.value)
    const c = t.current
    setDraft(v)
    c.pending = v
    clearTimeout(c.hold)
    if (!c.timer) c.timer = setTimeout(flush, 120)
  }
  function done() {
    flush()
    clearTimeout(t.current.hold)
    t.current.hold = setTimeout(() => setDraft(null), 400)
  }
  const v = draft ?? value
  const pct = ((v - min) / (max - min)) * 100
  return (
    <div className="flex items-center gap-3">
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={v}
        aria-label={label}
        aria-valuetext={format(v)}
        onChange={onChange}
        onPointerUp={done}
        onKeyUp={done}
        onBlur={done}
        className="set-range w-44"
        style={{ '--val': pct + '%' }}
      />
      <span className="w-10 text-right text-[12px] text-white/70 tabular-nums">{format(v)}</span>
    </div>
  )
}

function Grip() {
  return (
    <svg viewBox="0 0 12 16" className="h-4 w-3" fill="currentColor" aria-hidden="true">
      {[3, 8, 13].map((y) => (
        <g key={y}>
          <circle cx="3.5" cy={y} r="1.3" />
          <circle cx="8.5" cy={y} r="1.3" />
        </g>
      ))}
    </svg>
  )
}

function Arrow({ up }) {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d={up ? 'M4 10l4-4 4 4' : 'M4 6l4 4 4-4'} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const iconBtn =
  'grid h-7 w-7 place-items-center rounded-md text-white/50 transition-colors hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-25'

// items: [{ id, name, help?, icon? }] already in display order (icon: a small element shown first). hidden: Set of ids.
// onReorder(ids) gets the new order; onToggle(id, shown) shows or hides one.
export function ReorderList({ items, hidden, onReorder, onToggle, label }) {
  const [drag, setDrag] = useState(null)
  const [over, setOver] = useState(null)
  const [refocus, setRefocus] = useState(null)
  const listRef = useRef(null)
  const ids = items.map((it) => it.id)

  // After a keyboard move the row is re-rendered elsewhere; put focus back on the same button (or
  // its twin when it hit the top or bottom and became disabled).
  useEffect(() => {
    if (!refocus || !listRef.current) return
    const q = (dir) => listRef.current.querySelector(`[data-move="${refocus.id}:${dir}"]`)
    const el = q(refocus.dir)
    ;(el && !el.disabled ? el : q(refocus.dir === 'up' ? 'down' : 'up'))?.focus()
    setRefocus(null)
  }, [refocus])

  function move(id, to) {
    const from = ids.indexOf(id)
    if (from < 0 || to < 0 || to >= ids.length || from === to) return
    const next = ids.filter((x) => x !== id)
    next.splice(to, 0, id)
    onReorder(next)
  }

  function onDrop(e) {
    e.preventDefault()
    if (drag && over) {
      const rest = ids.filter((x) => x !== drag)
      let at = rest.indexOf(over.id)
      if (at < 0) at = rest.length
      else if (over.after) at += 1
      onReorder([...rest.slice(0, at), drag, ...rest.slice(at)])
    }
    setDrag(null)
    setOver(null)
  }

  return (
    <ul ref={listRef} aria-label={label} className="divide-y divide-white/[0.06]">
      {items.map((it, i) => {
        const shown = !hidden.has(it.id)
        const line = over && over.id === it.id && drag !== it.id ? (over.after ? 'bottom' : 'top') : null
        return (
          <li
            key={it.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move'
              e.dataTransfer.setData('text/plain', it.id)
              setDrag(it.id)
            }}
            onDragOver={(e) => {
              if (!drag) return
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              const r = e.currentTarget.getBoundingClientRect()
              const after = e.clientY > r.top + r.height / 2
              if (!over || over.id !== it.id || over.after !== after) setOver({ id: it.id, after })
            }}
            onDrop={onDrop}
            onDragEnd={() => {
              setDrag(null)
              setOver(null)
            }}
            className={`relative flex min-h-[52px] items-center gap-3 px-3 py-2 ${drag === it.id ? 'opacity-40' : ''}`}
          >
            {line && (
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute right-3 left-3 h-0.5 rounded-full bg-accent ${
                  line === 'top' ? '-top-px' : '-bottom-px'
                }`}
              />
            )}
            <span className="cursor-grab text-white/25 hover:text-white/50 active:cursor-grabbing" title="Drag to reorder">
              <Grip />
            </span>
            {it.icon && (
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-md bg-white/[0.06] ${shown ? 'text-white/80' : 'text-white/30'}`}
              >
                {it.icon}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className={`text-[13px] font-medium ${shown ? 'text-white/90' : 'text-white/40'}`}>{it.name}</div>
              {it.help && <p className="text-[12px] leading-snug text-white/40">{it.help}</p>}
            </div>
            <div className="flex items-center">
              <button
                type="button"
                data-move={it.id + ':up'}
                className={iconBtn}
                disabled={i === 0}
                aria-label={`Move ${it.name} up`}
                onClick={() => {
                  move(it.id, i - 1)
                  setRefocus({ id: it.id, dir: 'up' })
                }}
              >
                <Arrow up />
              </button>
              <button
                type="button"
                data-move={it.id + ':down'}
                className={iconBtn}
                disabled={i === items.length - 1}
                aria-label={`Move ${it.name} down`}
                onClick={() => {
                  move(it.id, i + 1)
                  setRefocus({ id: it.id, dir: 'down' })
                }}
              >
                <Arrow />
              </button>
            </div>
            <Toggle checked={shown} onChange={(on) => onToggle(it.id, on)} label={`Show ${it.name}`} />
          </li>
        )
      })}
    </ul>
  )
}
