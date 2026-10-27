// The settings window. Reads the settings view from the main process, saves every change at once
// (settings:set), and follows changes made elsewhere (the tray) through settings:changed. The main
// process validates everything; this page only shows what it gets back.
import { useEffect, useRef, useState } from 'react'
import {
  CALENDAR_COLORS,
  GHOST_MAX,
  GHOST_MIN,
  SYSTEM_ITEMS,
  TIMEOUT_MAX,
  TIMEOUT_MIN,
  WIDGET_IDS,
  isSystemControl,
  sortByOrder
} from '../../../shared/settings-model.mjs'
import { AGENT_NAMES, APPROVAL_AGENTS } from '../../../shared/agents.mjs'
import { Icon, SYSTEM_ICONS } from '../components/icons'
import { Card, ReorderList, Row, Segmented, Slider, Toggle } from './controls'

const api = window.settingsApi

const SECTIONS = [
  { id: 'pill', label: 'Pill', title: 'Pill', help: 'What the closed island shows when nothing else needs the space.' },
  { id: 'home', label: 'Home', title: 'Home', help: 'The widgets in the Home tab and their indicators in the pill.' },
  { id: 'system', label: 'System tab', title: 'System tab', help: 'Which meters and controls the System tab shows, and in what order.' },
  {
    id: 'claude',
    label: 'Coding agents',
    title: 'Coding agents',
    help: 'Live sessions from Claude Code, Codex, Gemini CLI, Antigravity, Cursor and Copilot CLI, and permission prompts you can answer in the island.'
  },
  { id: 'island', label: 'Island', title: 'Island', help: 'How the island behaves on your desktop.' },
  { id: 'calendar', label: 'Calendar', title: 'Calendar', help: 'Google, Outlook, iCloud, Notion and iCal calendars in the island.' },
  { id: 'about', label: 'About', title: 'About', help: 'Version, updates and footprint.' }
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
                  {s.id === 'about' && view?.update && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" title="Update available" />
                  )}
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
              {section === 'claude' && <ClaudeSection view={view} save={save} setView={setView} />}
              {section === 'island' && <IslandSection view={view} save={save} />}
              {section === 'calendar' && <CalendarSection view={view} setView={setView} />}
              {section === 'about' && <AboutSection view={view} save={save} />}
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
        Music, the calendar and coding agents take these spots whenever they have something to show.
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
        <Row id="pill-right" label="Right side" help="Shown when there is no coding agent session or notice.">
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
        <Row id="system-style" label="Control buttons" help="The round buttons of the grid: with a label under them, icon only (the name shows on hover), or text only.">
          <Segmented
            labelledBy="system-style"
            value={controlStyle}
            options={CONTROL_STYLE_OPTIONS}
            onChange={(v) => save({ system: { controlStyle: v } })}
          />
        </Row>
      </Card>
      <Card title="Activity" help="The rings and rates under Wi-Fi and Bluetooth. Stats are only sampled while the System tab is open.">
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
        help="Laid out like the Mac's Control Center: Wi-Fi, Bluetooth, airplane mode and hotspot get their own block, brightness and volume their own sliders, and the rest share a grid of round buttons, in this order."
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

function ClaudeSection({ view, save, setView }) {
  return (
    <>
      <AgentsCard status={view.agentHooks} setView={setView} />
      <Card title="Approvals">
        <Row
          label="Answer approvals in the island"
          help={`Allow or deny ${APPROVAL_AGENTS.map((a) => AGENT_NAMES[a]).join(' and ')} permission prompts from the island. Off: they stay in the terminal. Other agents show that they are waiting for you.`}
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
        <Row label="Pixel buddy" help="A small creature that reacts to your agents' sessions. Off shows a coloured dot instead.">
          <Toggle checked={view.claude.buddy} onChange={(on) => save({ claude: { buddy: on } })} label="Pixel buddy" />
        </Row>
      </Card>
    </>
  )
}

// Connecting coding agents. The main process shows the exact change in a dialog before writing anything.
// Agents not found on this PC are listed last, so people can see what else works.
function AgentsCard({ status, setView }) {
  const [busy, setBusy] = useState(null)
  async function run(agent, action) {
    setBusy(agent)
    const v = await api.agentHooks(agent, action)
    if (v) setView(v)
    setBusy(null)
  }
  const ids = Object.keys(AGENT_NAMES).sort((a, b) => Number(!!status[b]?.found) - Number(!!status[a]?.found))
  return (
    <Card title="Connection" help="TheIsland adds a small hook to each agent's own settings, with a backup first. Restart sessions that are already open.">
      {ids.map((id) => {
        const st = status[id] || {}
        const name = AGENT_NAMES[id]
        const help = st.installed
          ? st.upToDate
            ? APPROVAL_AGENTS.includes(id)
              ? 'Connected. Sessions, permission prompts and questions come to the island.'
              : 'Connected. Sessions and what they are doing show in the island.'
            : 'Connected by an older version, which misses some events. Update to get them all.'
          : st.found
            ? 'Not connected.'
            : `Not found on this PC. Install the hooks once you use ${name}.`
        const button = (action, label) => (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => run(id, action)}
            className={`${btn} bg-white/[0.07] text-white/80 hover:bg-white/[0.12] disabled:opacity-50`}
          >
            {label}
          </button>
        )
        return (
          <Row key={id} label={name} help={help}>
            <span className="flex flex-wrap justify-end gap-2">
              {st.installed && !st.upToDate && button('install', 'Update...')}
              {st.installed ? button('remove', 'Remove...') : button('install', 'Install...')}
            </span>
          </Row>
        )
      })}
    </Card>
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
        {view.store ? (
          // The Store version starts through its package's startup task, which Windows switches on and off.
          <Row label="Start with Windows" help="On by default. Turn it off or on in Windows Settings > Apps > Startup.">
            <button
              type="button"
              onClick={() => api.openLink('startup')}
              className={`${btn} bg-white/[0.07] text-white/80 hover:bg-white/[0.12]`}
            >
              Open startup settings
            </button>
          </Row>
        ) : (
          <Row label="Start with Windows" help="Open TheIsland when you sign in.">
            <Toggle
              checked={view.island.startWithWindows}
              onChange={(on) => save({ island: { startWithWindows: on } })}
              label="Start with Windows"
            />
          </Row>
        )}
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

const KIND_NAMES = { google: 'Google', microsoft: 'Outlook', caldav: 'CalDAV', ics: 'iCal link', notion: 'Notion' }
const ADD_KINDS = [
  { value: 'google', label: 'Google' },
  { value: 'microsoft', label: 'Outlook' },
  { value: 'caldav', label: 'iCloud' },
  { value: 'ics', label: 'iCal link' },
  { value: 'notion', label: 'Notion' }
]

// Calendar accounts: any number of Google, Outlook, iCloud (CalDAV), iCal links and Notion databases,
// merged in the widget with a colour each. Passwords and tokens go to the main process with the add and
// are never sent back.
function CalendarSection({ view, setView }) {
  const { accounts, builtIn } = view.calendar
  const [kind, setKind] = useState('google')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  async function add(k, payload, wait) {
    setBusy(true)
    setMsg(wait ? { ok: true, text: wait } : null)
    const r = await api.calendarAdd(k, payload)
    setBusy(false)
    if (!r) return false
    setView(r.view)
    setMsg(r.ok ? { ok: true, text: 'Calendar added. Events appear after the first fetch.' } : { ok: false, text: r.error })
    return r.ok
  }
  const update = async (id, patch) => {
    const v = await api.calendarUpdate(id, patch)
    if (v) setView(v)
  }
  const remove = async (a) => {
    const v = await api.calendarRemove(a.id)
    if (v) setView(v)
    setMsg({ ok: true, text: `${a.label} removed.` })
  }
  const nextColor = (c) => CALENDAR_COLORS[(CALENDAR_COLORS.indexOf(c) + 1) % CALENDAR_COLORS.length]

  return (
    <>
      <Card title="Your calendars" help="Events from every calendar that is switched on show together in the island.">
        {accounts.length === 0 ? (
          <Row label="No calendars yet" help="Add one below." />
        ) : (
          accounts.map((a) => (
            <div key={a.id} className="flex min-h-[60px] items-center gap-3 px-4 py-3">
              <button
                type="button"
                onClick={() => update(a.id, { color: nextColor(a.color) })}
                title="Change colour"
                aria-label={`Change colour of ${a.label}`}
                className="h-3.5 w-3.5 shrink-0 rounded-full ring-2 ring-white/10 hover:ring-white/30"
                style={{ backgroundColor: a.color }}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-white/90">{a.label}</div>
                <p className={`mt-0.5 text-[12px] leading-snug ${a.error ? 'text-amber-300/90' : 'text-white/45'}`}>
                  {a.error || `${KIND_NAMES[a.kind]}${a.ownClient ? ', your own client' : ''}${a.enabled ? '' : ', hidden'}`}
                </p>
              </div>
              <Toggle checked={a.enabled} onChange={(on) => update(a.id, { enabled: on })} label={`Show ${a.label}`} />
              <button type="button" onClick={() => remove(a)} className={secondary}>
                Remove
              </button>
            </div>
          ))
        )}
      </Card>

      <Card title="Add a calendar">
        <Row id="cal-kind" label="Service">
          <Segmented
            labelledBy="cal-kind"
            value={kind}
            options={ADD_KINDS}
            onChange={(k) => {
              setKind(k)
              setMsg(null)
            }}
          />
        </Row>
        <div className="space-y-3 px-4 py-4">
          {kind === 'google' && <GoogleForm builtIn={builtIn.google} busy={busy} add={add} />}
          {kind === 'microsoft' && <OutlookForm builtIn={builtIn.microsoft} busy={busy} add={add} onIcs={() => setKind('ics')} />}
          {kind === 'caldav' && <ICloudForm busy={busy} add={add} />}
          {kind === 'ics' && <IcsForm busy={busy} add={add} />}
          {kind === 'notion' && <NotionForm busy={busy} add={add} />}
          <p aria-live="polite" className={`min-h-[18px] text-[12px] ${msg ? (msg.ok ? 'text-white/55' : 'text-amber-300/90') : ''}`}>
            {msg?.text}
          </p>
        </div>
      </Card>
    </>
  )
}

const input =
  'min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-black/30 px-3 py-1.5 text-[13px] text-white placeholder:text-white/30'
const primary = `${btn} bg-accent text-white hover:bg-[#2b95ff]`
const secondary = `${btn} bg-white/[0.07] text-white/80 hover:bg-white/[0.12]`
const linkish = 'text-[12px] text-white/45 underline-offset-2 hover:text-white/75 hover:underline'

function Steps({ children }) {
  return <ol className="list-decimal space-y-1 pl-4 text-[12px] leading-snug text-white/55">{children}</ol>
}
const B = ({ children }) => <b className="text-white/75">{children}</b>

function Field({ type = 'text', value, onChange, placeholder, label }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={label}
      autoComplete="off"
      spellCheck={false}
      className={input}
    />
  )
}

// Google: one button with TheIsland's own client. The user's own Google Cloud client stays as an option.
function GoogleForm({ builtIn, busy, add }) {
  const [own, setOwn] = useState(!builtIn)
  const [clientId, setClientId] = useState('')
  const [secret, setSecret] = useState('')
  const wait = 'Finish signing in in your browser...'
  return (
    <>
      <p className="text-[12px] leading-snug text-white/55">
        Read-only access to the calendars you show in Google Calendar. Changes appear within seconds of opening the island.
      </p>
      {builtIn && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={busy} onClick={() => add('google', {}, wait)} className={primary}>
            Sign in with Google
          </button>
          <button type="button" onClick={() => setOwn(!own)} className={linkish}>
            {own ? 'Hide own client' : 'Use my own Google Cloud client'}
          </button>
        </div>
      )}
      {own && (
        <form
          className="space-y-2 rounded-lg bg-white/[0.03] p-3"
          onSubmit={async (e) => {
            e.preventDefault()
            if (await add('google', { clientId, clientSecret: secret }, wait)) setSecret('')
          }}
        >
          <Steps>
            <li>
              In Google Cloud Console, create a project and enable the <B>Google Calendar API</B>.
            </li>
            <li>
              Under <B>Google Auth Platform</B>, set up the consent screen (External) and add yourself as a test user, or publish
              the app so sign-in doesn't expire every 7 days.
            </li>
            <li>
              Under <B>Clients</B>, create a client of type <B>Desktop app</B> and paste its ID and secret here.
            </li>
          </Steps>
          <button type="button" onClick={() => api.openCalendarHelp('googleConsole')} className={secondary}>
            Open Google Cloud Console
          </button>
          <div className="flex gap-2">
            <Field value={clientId} onChange={setClientId} placeholder="Client ID (...apps.googleusercontent.com)" label="Client ID" />
          </div>
          <div className="flex gap-2">
            <Field type="password" value={secret} onChange={setSecret} placeholder="Client secret" label="Client secret" />
            <button type="submit" disabled={busy || !clientId.trim() || !secret.trim()} className={primary}>
              Sign in
            </button>
          </div>
        </form>
      )}
    </>
  )
}

function OutlookForm({ builtIn, busy, add, onIcs }) {
  if (!builtIn) {
    return (
      <p className="text-[12px] leading-snug text-white/55">
        Outlook sign-in isn't in this build. You can still add Outlook as an iCal link: in Outlook on the web, open{' '}
        <B>Settings &gt; Calendar &gt; Shared calendars</B>, publish your calendar and copy the ICS link.{' '}
        <button type="button" onClick={onIcs} className="text-accent hover:underline">
          Add an iCal link
        </button>
      </p>
    )
  }
  return (
    <>
      <p className="text-[12px] leading-snug text-white/55">
        Outlook.com, Hotmail and Microsoft 365 work or school accounts. Read-only access to your main calendar.
      </p>
      <button type="button" disabled={busy} onClick={() => add('microsoft', {}, 'Finish signing in in your browser...')} className={primary}>
        Sign in with Microsoft
      </button>
    </>
  )
}

// iCloud has no sign-in for other apps: an app-specific password over CalDAV is Apple's way.
function ICloudForm({ busy, add }) {
  const [appleId, setAppleId] = useState('')
  const [password, setPassword] = useState('')
  const [server, setServer] = useState('')
  const [other, setOther] = useState(false)
  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault()
        if (await add('caldav', { appleId, password, server: other ? server : '' }, 'Connecting...')) setPassword('')
      }}
    >
      <Steps>
        <li>
          Sign in to your Apple Account, open <B>Sign-In and Security &gt; App-Specific Passwords</B> and make one called TheIsland.
        </li>
        <li>Enter your Apple ID email and that password. Your real Apple ID password is never needed.</li>
      </Steps>
      <button type="button" onClick={() => api.openCalendarHelp('appleAppPasswords')} className={secondary}>
        Open Apple Account
      </button>
      <div className="flex gap-2">
        <Field value={appleId} onChange={setAppleId} placeholder={other ? 'User name' : 'Apple ID email'} label="Apple ID email" />
      </div>
      {other && (
        <div className="flex gap-2">
          <Field value={server} onChange={setServer} placeholder="https://caldav.example.com/" label="CalDAV server" />
        </div>
      )}
      <div className="flex gap-2">
        <Field type="password" value={password} onChange={setPassword} placeholder="App-specific password" label="App-specific password" />
        <button type="submit" disabled={busy || !appleId.trim() || !password.trim()} className={primary}>
          Connect
        </button>
      </div>
      <button type="button" onClick={() => setOther(!other)} className={linkish}>
        {other ? 'Use iCloud' : 'Another CalDAV server (Fastmail, Nextcloud...)'}
      </button>
    </form>
  )
}

function IcsForm({ busy, add }) {
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault()
        if (await add('ics', { url, label }, 'Checking the address...')) {
          setUrl('')
          setLabel('')
        }
      }}
    >
      <p className="text-[12px] leading-snug text-white/55">
        Any calendar with an iCal (.ics or webcal) address: Google's secret address, a published Outlook calendar, Proton, Fastmail,
        school or team calendars. Some services only update these copies every few hours. The address is stored encrypted.
      </p>
      <div className="flex gap-2">
        <Field value={label} onChange={setLabel} placeholder="Name (optional)" label="Calendar name" />
      </div>
      <div className="flex gap-2">
        <Field type="password" value={url} onChange={setUrl} placeholder="https://... or webcal://..." label="iCal address" />
        <button type="submit" disabled={busy || !url.trim()} className={primary}>
          Add
        </button>
      </div>
    </form>
  )
}

function NotionForm({ busy, add }) {
  const [token, setToken] = useState('')
  const [database, setDatabase] = useState('')
  const [dateProperty, setDateProperty] = useState('')
  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault()
        if (await add('notion', { token, database, dateProperty }, 'Reading the database...')) setToken('')
      }}
    >
      <Steps>
        <li>
          On Notion's <B>Integrations</B> page, make an internal integration with <B>Read content</B> and copy its secret.
        </li>
        <li>
          Open your database, then <B>... &gt; Connections</B>, and add that integration.
        </li>
        <li>
          Paste the secret and the database link (<B>Share &gt; Copy link</B>). Items with a date show up as events.
        </li>
      </Steps>
      <button type="button" onClick={() => api.openCalendarHelp('notionIntegrations')} className={secondary}>
        Open Notion integrations
      </button>
      <div className="flex gap-2">
        <Field value={database} onChange={setDatabase} placeholder="Database link" label="Database link" />
      </div>
      <div className="flex gap-2">
        <Field value={dateProperty} onChange={setDateProperty} placeholder="Date property (optional, the first one by default)" label="Date property" />
      </div>
      <div className="flex gap-2">
        <Field type="password" value={token} onChange={setToken} placeholder="Integration secret" label="Integration secret" />
        <button type="submit" disabled={busy || !token.trim() || !database.trim()} className={primary}>
          Add
        </button>
      </div>
    </form>
  )
}

function AboutSection({ view, save }) {
  return (
    <Card>
      <Row label="TheIsland" help="A light dynamic island for Windows 11.">
        <span className="text-[12px] text-white/55 tabular-nums">Version {view.version}</span>
      </Row>
      {view.update && (
        <Row
          label={`Version ${view.update.version} is available`}
          help="Download the new installer and run it. It replaces this version and keeps your settings."
        >
          <LinkButton name="download">Download</LinkButton>
        </Row>
      )}
      {/* The Store version is updated by the Store. */}
      {!view.store && (
        <Row label="Check for updates" help="Asks GitHub about twice a day whether a newer version is out. Nothing is downloaded or installed on its own.">
          <Toggle checked={view.updates.check} onChange={(on) => save({ updates: { check: on } })} label="Check for updates" />
        </Row>
      )}
      <Row
        label="Footprint"
        help="At rest the island uses about 120 to 200 MB of memory and close to 0% CPU. This window exists only while it is open, so closing it gives its memory back."
      />
      <Row label="Settings file" help="Saved in %USERPROFILE%\.theisland\config.json. Calendar sign-ins, passwords and addresses are encrypted with Windows DPAPI." />
      <Row label="Feedback" help="Found a bug or want something new? Tell us on the website, no account needed.">
        <span className="flex flex-wrap justify-end gap-2">
          <LinkButton name="feedbackIdea">Suggest a feature</LinkButton>
          <LinkButton name="feedbackBug">Report a bug</LinkButton>
        </span>
      </Row>
      <Row label="Log file" help="For a bug report: opens the folder with island.log so you can attach it. Nothing is sent on its own.">
        <LinkButton name="logs">Open log folder</LinkButton>
      </Row>
      <Row label="Privacy" help="TheIsland collects nothing. The policy explains what it stores and what it connects to.">
        <LinkButton name="privacy">Privacy policy</LinkButton>
      </Row>
      <Row label="More" help="Free and open source under the MIT license.">
        <span className="flex flex-wrap justify-end gap-2">
          <LinkButton name="help">Help</LinkButton>
          <LinkButton name="license">License</LinkButton>
          <LinkButton name="website">Website</LinkButton>
        </span>
      </Row>
    </Card>
  )
}

// Opens one of the fixed pages the main process knows (it never takes an address from here).
function LinkButton({ name, children }) {
  return (
    <button
      type="button"
      onClick={() => api.openLink(name)}
      className={`${btn} bg-white/[0.07] text-white/80 hover:bg-white/[0.12]`}
    >
      {children}
    </button>
  )
}
