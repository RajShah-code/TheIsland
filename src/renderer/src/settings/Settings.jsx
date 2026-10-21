// The settings window. Reads the settings view from the main process, saves every change at once
// (settings:set), and follows changes made elsewhere (the tray) through settings:changed. The main
// process validates everything; this page only shows what it gets back.
import { useEffect, useRef, useState } from 'react'
import {
  GHOST_MAX,
  GHOST_MIN,
  SYSTEM_ITEMS,
  TIMEOUT_MAX,
  TIMEOUT_MIN,
  WIDGET_IDS,
  isSystemControl,
  sortByOrder
} from '../../../shared/settings-model.mjs'
import { Icon, SYSTEM_ICONS } from '../components/icons'
import { Card, ReorderList, Row, Segmented, Slider, Toggle } from './controls'

const api = window.settingsApi

const SECTIONS = [
  { id: 'pill', label: 'Pill', title: 'Pill', help: 'What the closed island shows when nothing else needs the space.' },
  { id: 'home', label: 'Home', title: 'Home', help: 'The widgets in the Home tab and their indicators in the pill.' },
  { id: 'system', label: 'System tab', title: 'System tab', help: 'Which meters and controls the System tab shows, and in what order.' },
  { id: 'claude', label: 'Claude Code', title: 'Claude Code', help: 'Session status and permission prompts from Claude Code.' },
  { id: 'island', label: 'Island', title: 'Island', help: 'How the island behaves on your desktop.' },
  { id: 'calendar', label: 'Calendar', title: 'Calendar', help: 'Your Google Calendar in the island, read from its private iCal address.' },
  { id: 'about', label: 'About', title: 'About', help: 'Version and footprint.' }
]

const ICONS = {
  pill: <rect x="3" y="9" width="18" height="6" rx="3" />,
  home: (
    <>
      <rect x="3" y="5" width="5" height="14" rx="1.5" />
      <rect x="10" y="5" width="5" height="14" rx="1.5" />
      <rect x="17" y="5" width="4" height="14" rx="1.5" />
    </>
  ),
  system: <path d="M4 18V12M9 18V6M14 18v-8M19 18V9" />,
  claude: <path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z" />,
  island: (
    <>
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <rect x="8.5" y="4" width="7" height="3" rx="1.5" fill="currentColor" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  about: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.5" />
    </>
  )
}

const WIDGET_INFO = {
  music: { name: 'Music', help: 'Now playing with controls. Takes a column only while a player is open.' },
  clock: { name: 'Clock', help: 'The time and the date.' },
  calendar: { name: 'Calendar', help: 'Today and the next days. The next event shows in the pill 30 minutes ahead.' }
}

const FALLBACK_LEFT = [
  { value: 'time', label: 'Time' },
  { value: 'date', label: 'Date' },
  { value: 'none', label: 'Nothing' }
]
const FALLBACK_RIGHT = [
  { value: 'none', label: 'Nothing' },
  { value: 'time', label: 'Time' },
  { value: 'date', label: 'Date' }
]

// Optimistic local merge so a control answers at once; the main process's reply replaces it.
function mergeLocal(view, patch) {
  const next = { ...view }
  for (const [k, v] of Object.entries(patch))
    next[k] = v && typeof v === 'object' && !Array.isArray(v) ? { ...view[k], ...v } : v
  return next
}

export default function Settings() {
  const [view, setView] = useState(null)
  const [section, setSection] = useState('pill')
  const navRefs = useRef({})

  useEffect(() => {
    const off = api.onChange(setView)
    api.get().then((v) => v && setView(v))
    return off
  }, [])

  function save(patch) {
    setView((v) => mergeLocal(v, patch))
    api.set(patch).then((v) => v && setView(v))
  }

  // Up and down arrows move between sidebar items, like a native list.
  function onNavKey(e) {
    const i = SECTIONS.findIndex((s) => s.id === section)
    const step = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const next = SECTIONS[(i + step + SECTIONS.length) % SECTIONS.length].id
    setSection(next)
    navRefs.current[next]?.focus()
  }

  const current = SECTIONS.find((s) => s.id === section)

  return (
    <div className="flex h-full font-sans text-white">
      <nav aria-label="Settings sections" className="flex w-[212px] shrink-0 flex-col border-r border-white/[0.06] bg-black/40 px-3 py-5">
        <div className="mb-5 flex items-center gap-2.5 px-2.5">
          <span className="relative h-[14px] w-[30px] rounded-b-[7px] bg-white" aria-hidden="true" />
          <span className="font-display text-[15px] font-semibold tracking-tight">TheIsland</span>
        </div>
        <ul className="space-y-0.5" onKeyDown={onNavKey}>
          {SECTIONS.map((s) => {
            const on = s.id === section
            return (
              <li key={s.id}>
                <button
                  ref={(el) => (navRefs.current[s.id] = el)}
                  type="button"
                  aria-current={on ? 'page' : undefined}
                  onClick={() => setSection(s.id)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left text-[13px] transition-colors ${
                    on ? 'bg-white/[0.1] font-medium text-white' : 'text-white/60 hover:bg-white/[0.05] hover:text-white/90'
                  }`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className={`h-4 w-4 shrink-0 ${on ? 'text-accent' : 'text-white/45'}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {ICONS[s.id]}
                  </svg>
                  {s.label}
                </button>
              </li>
            )
          })}
        </ul>
        <p className="mt-auto px-2.5 text-[11px] leading-snug text-white/30">Changes are saved as you make them.</p>
      </nav>

      <main className="scroll-thin min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[620px] px-8 pt-7 pb-10">
          <header className="mb-6">
            <h1 className="font-display text-[22px] font-semibold tracking-tight">{current.title}</h1>
            <p className="mt-1 text-[13px] text-white/50">{current.help}</p>
          </header>
          {!view ? (
            <p className="text-[13px] text-white/40">Loading...</p>
          ) : (
            <div className="space-y-7">
              {section === 'pill' && <PillSection view={view} save={save} />}
              {section === 'home' && <HomeSection view={view} save={save} />}
              {section === 'system' && <SystemSection view={view} save={save} />}
              {section === 'claude' && <ClaudeSection view={view} save={save} />}
              {section === 'island' && <IslandSection view={view} save={save} />}
              {section === 'calendar' && <CalendarSection view={view} setView={setView} />}
              {section === 'about' && <AboutSection view={view} />}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

const timeFmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
const dateFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

function fallbackText(kind, now) {
  if (kind === 'time') return timeFmt.format(now)
  if (kind === 'date') return dateFmt.format(now)
  return null
}

// A still picture of the closed pill with the chosen fallbacks (no timers, no animation).
function PillPreview({ left, right }) {
  const now = Date.now()
  const l = fallbackText(left, now)
  const r = fallbackText(right, now)
  return (
    <figure className="overflow-hidden rounded-xl bg-gradient-to-b from-[#1d2430] to-[#12151b] ring-1 ring-white/[0.07]">
      <div className="relative h-[92px]" role="img" aria-label={`Pill preview: left ${l || 'empty'}, right ${r || 'empty'}`}>
        <div className="absolute top-0 left-1/2 h-[30px] w-[190px] -translate-x-1/2">
          <span className="preview-ear left" />
          <span className="preview-ear right" />
          <div className="flex h-full items-center justify-between gap-3 rounded-b-[13px] bg-black px-3.5 text-[12px] whitespace-nowrap">
            <span className="text-white/85 tabular-nums">{l}</span>
            <span className="text-white/85 tabular-nums">{r}</span>
          </div>
        </div>
      </div>
      <figcaption className="border-t border-white/[0.06] px-4 py-2 text-[11px] text-white/40">
        Music, the calendar and Claude Code take these spots whenever they have something to show.
      </figcaption>
    </figure>
  )
}

function PillSection({ view, save }) {
  const { leftFallback, rightFallback } = view.pill
  return (
    <>
      <PillPreview left={leftFallback} right={rightFallback} />
      <Card>
        <Row id="pill-left" label="Left side" help="Shown when no widget has anything for the pill.">
          <Segmented
            labelledBy="pill-left"
            value={leftFallback}
            options={FALLBACK_LEFT}
            onChange={(v) => save({ pill: { leftFallback: v } })}
          />
        </Row>
        <Row id="pill-right" label="Right side" help="Shown when there is no Claude Code session or notice.">
          <Segmented
            labelledBy="pill-right"
            value={rightFallback}
            options={FALLBACK_RIGHT}
            onChange={(v) => save({ pill: { rightFallback: v } })}
          />
        </Row>
      </Card>
    </>
  )
}

function HomeSection({ view, save }) {
  const { order, hidden } = view.widgets
  const items = sortByOrder(
    WIDGET_IDS.map((id) => ({ id, ...WIDGET_INFO[id] })),
    order
  )
  const hiddenSet = new Set(hidden)
  return (
    <Card
      title="Widgets"
      help="Columns of the Home tab from left to right. A hidden widget also leaves the pill. Drag a row or use the arrows."
    >
      <ReorderList
        label="Home widgets"
        items={items}
        hidden={hiddenSet}
        onReorder={(ids) => save({ widgets: { order: ids } })}
        onToggle={(id, on) => save({ widgets: { hidden: on ? hidden.filter((x) => x !== id) : [...hidden, id] } })}
      />
    </Card>
  )
}

const CONTROL_STYLE_OPTIONS = [
  { value: 'both', label: 'Both' },
  { value: 'icon', label: 'Icon' },
  { value: 'label', label: 'Label' }
]

function SystemSection({ view, save }) {
  const { order, hidden, controlStyle } = view.system
  const sorted = sortByOrder(SYSTEM_ITEMS, order).map((it) => ({
    ...it,
    icon: <Icon name={SYSTEM_ICONS[it.id]} />,
    help: it.kind === 'link' ? 'Opens Windows Settings' : undefined
  }))
  const meters = sorted.filter((it) => !isSystemControl(it))
  const controls = sorted.filter(isSystemControl)
  const hiddenSet = new Set(hidden)
  const toggle = (id, on) => save({ system: { hidden: on ? hidden.filter((x) => x !== id) : [...hidden, id] } })
  const ids = (list) => list.map((it) => it.id)
  return (
    <>
      <Card>
        <Row id="system-style" label="Control buttons" help="Icon and label, icon only (the name shows on hover) or label only.">
          <Segmented
            labelledBy="system-style"
            value={controlStyle}
            options={CONTROL_STYLE_OPTIONS}
            onChange={(v) => save({ system: { controlStyle: v } })}
          />
        </Row>
      </Card>
      <Card title="Meters" help="The left column. Stats are only sampled while the System tab is open.">
        <ReorderList
          label="System meters"
          items={meters}
          hidden={hiddenSet}
          onReorder={(next) => save({ system: { order: [...next, ...ids(controls)] } })}
          onToggle={toggle}
        />
      </Card>
      <Card
        title="Controls"
        help="The right column, like Windows Quick Settings. Sliders take a full line; neighbouring buttons share a grid."
      >
        <ReorderList
          label="System controls"
          items={controls}
          hidden={hiddenSet}
          onReorder={(next) => save({ system: { order: [...ids(meters), ...next] } })}
          onToggle={toggle}
        />
      </Card>
    </>
  )
}

function TimeoutInput({ value, onCommit }) {
  const [draft, setDraft] = useState(null)
  const commit = () => {
    if (draft === null) return
    const n = Number(draft)
    if (draft.trim() !== '' && Number.isFinite(n)) onCommit(Math.round(n))
    setDraft(null)
  }
  return (
    <div className="flex items-center gap-2">
      <input
        id="approval-timeout"
        type="number"
        inputMode="numeric"
        min={TIMEOUT_MIN}
        max={TIMEOUT_MAX}
        step="5"
        value={draft ?? String(value)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') setDraft(null)
        }}
        className="w-[76px] rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-right text-[13px] text-white tabular-nums ring-1 ring-white/[0.08] hover:ring-white/[0.16]"
      />
      <span className="text-[12px] text-white/45">seconds</span>
    </div>
  )
}

function ClaudeSection({ view, save }) {
  return (
    <>
      <Card title="Approvals">
        <Row
          label="Answer approvals in the island"
          help="Allow or deny Claude Code permission prompts from the island. Off: they stay in the terminal."
        >
          <Toggle
            checked={view.approvalsEnabled}
            onChange={(on) => save({ approvalsEnabled: on })}
            label="Answer approvals in the island"
          />
        </Row>
        <Row
          htmlFor="approval-timeout"
          label="Hand back to the terminal after"
          help={`If you don't answer in time, the prompt goes back to the terminal. ${TIMEOUT_MIN} to ${TIMEOUT_MAX} seconds.`}
        >
          <TimeoutInput value={view.approvalTimeoutSec} onCommit={(n) => save({ approvalTimeoutSec: n })} />
        </Row>
      </Card>
      <Card title="Look">
        <Row label="Pixel buddy" help="A small creature that reacts to your sessions. Off shows a coloured dot instead.">
          <Toggle checked={view.claude.buddy} onChange={(on) => save({ claude: { buddy: on } })} label="Pixel buddy" />
        </Row>
      </Card>
      <p className="px-1 text-[12px] text-white/40">Install or remove the Claude Code hooks from the tray menu.</p>
    </>
  )
}

function IslandSection({ view, save }) {
  return (
    <>
      <Card>
        <Row
          htmlFor="ghost"
          label="See-through on hover"
          help="How visible the closed pill stays while the pointer is over it. Clicks always go through."
        >
          <Slider
            id="ghost"
            label="See-through on hover"
            value={view.island.ghostOpacity}
            min={GHOST_MIN}
            max={GHOST_MAX}
            step={0.01}
            format={(v) => Math.round(v * 100) + '%'}
            onCommit={(v) => save({ island: { ghostOpacity: v } })}
          />
        </Row>
        <Row label="Start with Windows" help="Open TheIsland when you sign in.">
          <Toggle
            checked={view.island.startWithWindows}
            onChange={(on) => save({ island: { startWithWindows: on } })}
            label="Start with Windows"
          />
        </Row>
      </Card>
      <Card title="Shortcuts">
        <Row label="Hide or show the island" help="Also in the tray menu.">
          <kbd className="rounded-md bg-white/[0.08] px-2 py-1 font-sans text-[12px] text-white/75 ring-1 ring-white/[0.08]">
            Ctrl + Alt + I
          </kbd>
        </Row>
        <Row label="Open the island" help="Push the pointer into the top edge over the pill.">
          <span className="text-[12px] text-white/45">Mouse</span>
        </Row>
      </Card>
    </>
  )
}

const btn =
  'rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-35'

function CalendarSection({ view, setView }) {
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = async () => {
    setBusy(true)
    const r = await api.setCalendar()
    setBusy(false)
    if (!r) return
    setView(r.view)
    setMsg(r.ok ? { ok: true, text: 'Calendar saved. Events appear after the first fetch.' } : { ok: false, text: r.error })
  }
  const remove = async () => {
    const v = await api.removeCalendar()
    if (v) setView(v)
    setMsg({ ok: true, text: 'Calendar removed.' })
  }
  return (
    <>
      <Card>
        <Row
          label="Google Calendar"
          help={view.calendarConfigured ? 'Connected. Refreshed every 15 minutes.' : 'Not set yet.'}
        >
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              view.calendarConfigured ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/[0.08] text-white/50'
            }`}
          >
            {view.calendarConfigured ? 'Connected' : 'Not set'}
          </span>
        </Row>
        <div className="space-y-3 px-4 py-4">
          <ol className="list-decimal space-y-1 pl-4 text-[12px] leading-snug text-white/55">
            <li>In Google Calendar, open Settings and pick your calendar.</li>
            <li>Copy the "Secret address in iCal format".</li>
            <li>Press the button below. The address is stored encrypted and the clipboard is cleared.</li>
          </ol>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button type="button" onClick={set} disabled={busy} className={`${btn} bg-accent text-white hover:bg-[#2b95ff]`}>
              Set from copied iCal address
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={!view.calendarConfigured}
              className={`${btn} bg-white/[0.07] text-white/80 hover:bg-white/[0.12]`}
            >
              Remove
            </button>
          </div>
          <p
            aria-live="polite"
            className={`min-h-[18px] text-[12px] ${msg ? (msg.ok ? 'text-white/55' : 'text-amber-300/90') : ''}`}
          >
            {msg?.text}
          </p>
        </div>
      </Card>
    </>
  )
}

function AboutSection({ view }) {
  return (
    <Card>
      <Row label="TheIsland" help="A light dynamic island for Windows 11.">
        <span className="text-[12px] text-white/55 tabular-nums">Version {view.version}</span>
      </Row>
      <Row
        label="Footprint"
        help="At rest the island uses about 120 to 200 MB of memory and close to 0% CPU. This window exists only while it is open, so closing it gives its memory back."
      />
      <Row label="Settings file" help="Saved in %APPDATA%\TheIsland\config.json. The calendar address is encrypted with Windows DPAPI." />
    </Card>
  )
}
