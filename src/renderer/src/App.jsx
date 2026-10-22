import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ApprovalCard, ClaudeCompact, ClaudePanel, Dot, Mascot, mostRelevant } from './components/Claude'
import { SystemPanel } from './components/System'
import { emitPointer } from './pointer'
import { useIsland } from './store'
import { orderedWidgets } from './widgets'
import { CompactDate, CompactTime } from './widgets/clock'

const NOTICE_MS = 5000
// Shape sizes (px). The open size is measured from the content.
const CLOSED = { w: 190, h: 30, r: 13, ear: 9 }
const LIVE_W = 300
const NOTICE_W = 340
const OPEN_R = 30
const OPEN_EAR = 16
const PAD = 20
const DIVIDER = 33
const CLAUDE_W = 600
// Wide enough for the two columns of Control Center style modules (the window is 820).
const SYSTEM_W = 680
// Home tab with every widget hidden in settings.
const EMPTY_HOME_W = 300
// Fullscreen: reveal when the pointer touches the top edge near the centre, hide again after this.
const PEEK_ZONE = 180
const PEEK_HIDE_MS = 2500
// The closed pill never takes clicks: hovering it only makes it see-through so whatever is under it
// stays visible and clickable. Pushing the pointer into the top edge (this many px) over it opens it.
const EDGE = 2

export default function App() {
  const state = useIsland()
  const { claude, settings, fullscreen } = state
  const [hover, setHover] = useState(false)
  const [ghost, setGhost] = useState(false)
  const [peek, setPeek] = useState(false)
  const [notice, setNotice] = useState(null)
  const [tab, setTab] = useState('home')
  const [openSize, setOpenSize] = useState({ w: 600, h: 180 })
  const openRef = useRef(null)
  const notchRef = useRef(null)
  const timers = useRef({})
  const interactive = useRef(false)
  const now = useRef({})

  const approvals = claude.approvals
  const hasClaude = claude.sessions.length > 0
  const expanded = hover || approvals.length > 0
  const hidden = fullscreen && !peek && !expanded
  const activeTab = approvals.length > 0 ? 'claude' : tab === 'claude' && !hasClaude ? 'home' : tab
  const shownWidgets = orderedWidgets(settings)
  const homeWidgets = shownWidgets.filter((w) => w.Panel && (!w.visible || w.visible(state)))
  now.current = { fullscreen, expanded, hidden }
  // System stats are sampled only while they are on screen (see src/main/helper.js).
  const systemVisible = expanded && activeTab === 'system'

  useEffect(() => {
    window.island.setSystemWatch(systemVisible)
  }, [systemVisible])
  useEffect(() => {
    const off = () => window.island.setSystemWatch(false)
    window.addEventListener('beforeunload', off)
    return () => {
      window.removeEventListener('beforeunload', off)
      off()
    }
  }, [])

  // Brief message in the notch when a session finishes or needs input, and the hello / goodbye
  // (kind 'greet' / 'bye', with `text`).
  useEffect(
    () =>
      window.island.onAttention((a) => {
        if (a.kind === 'approval') return
        setNotice(a)
        clearTimeout(timers.current.notice)
        timers.current.notice = setTimeout(() => setNotice(null), NOTICE_MS)
        if (fullscreen) reveal()
      }),
    [fullscreen]
  )

  // Fullscreen app in front: the notch hides; touching the top edge near the centre brings it back.
  useEffect(() => {
    if (!fullscreen) setPeek(false)
  }, [fullscreen])

  // The window ignores the mouse unless the island is open and the pointer is on it, so everything
  // below the pill stays clickable. Meanwhile main polls the cursor and sends `island:pointer` (forwarded
  // mouse moves don't reach us over elevated windows and cost more). While interactive, real mousemove
  // events take over. Both feed the same handler.
  useEffect(() => {
    const onMove = (x, y) => {
      emitPointer({ x, y })
      const { fullscreen, expanded, hidden } = now.current
      const r = notchRef.current.getBoundingClientRect()
      const overX = x >= r.left && x <= r.right
      const inside = overX && y >= r.top && y <= r.bottom
      const atEdge = y <= EDGE
      if (fullscreen && atEdge && Math.abs(x - window.innerWidth / 2) < PEEK_ZONE) reveal()
      if (expanded) {
        if (inside) {
          cancelLeave()
          setInteractive(true)
        } else if (interactive.current) leave()
        return
      }
      if (atEdge && overX) return open()
      setGhost(!hidden && inside)
    }
    // Pointer gone from the window (or main took the mouse back): no ghost, and leave if interactive.
    const onGone = () => (interactive.current ? leave() : setGhost(false))
    const offPolled = window.island.onPointer((p) => {
      if (!p || p.inside !== true) return onGone()
      // A poll sent just before we turned interactive is stale; real events are coming now.
      if (!interactive.current && Number.isFinite(p.x) && Number.isFinite(p.y)) onMove(p.x, p.y)
    })
    const onMouseMove = (e) => onMove(e.clientX, e.clientY)
    document.addEventListener('mousemove', onMouseMove)
    return () => {
      offPolled()
      document.removeEventListener('mousemove', onMouseMove)
    }
  }, [])

  // Closing (an approval answered, the hover timer) hands the mouse back at once.
  useEffect(() => {
    if (!expanded) setInteractive(false)
  }, [expanded])

  function reveal() {
    setPeek(true)
    clearTimeout(timers.current.peek)
    timers.current.peek = setTimeout(() => setPeek(false), PEEK_HIDE_MS)
  }

  // Measure the open layer so the shape can animate to its exact size.
  useLayoutEffect(() => {
    const el = openRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setOpenSize({ w: el.offsetWidth, h: el.offsetHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  function setInteractive(on) {
    if (interactive.current === on) return
    interactive.current = on
    window.island.setInteractive(on)
  }
  function cancelLeave() {
    clearTimeout(timers.current.leave)
    timers.current.leave = null
    clearTimeout(timers.current.peek)
  }
  function open() {
    cancelLeave()
    setGhost(false)
    setInteractive(true)
    setHover(true)
  }
  function leave() {
    setInteractive(false)
    setGhost(false)
    if (!timers.current.leave)
      timers.current.leave = setTimeout(() => {
        timers.current.leave = null
        setHover(false)
      }, 220)
    if (now.current.fullscreen) timers.current.peek = setTimeout(() => setPeek(false), PEEK_HIDE_MS)
  }
  // Backup for a fast move that leaves the window between two mousemove events.
  const onMouseLeave = () => (interactive.current ? leave() : setGhost(false))

  const live = !!notice || hasClaude || (state.media.active && state.media.status === 'Playing')
  const size = expanded
    ? { w: openSize.w, h: openSize.h, r: OPEN_R, ear: OPEN_EAR }
    : { ...CLOSED, w: notice ? NOTICE_W : live ? LIVE_W : CLOSED.w }

  const openWidth =
    activeTab === 'claude'
      ? CLAUDE_W
      : activeTab === 'system'
        ? SYSTEM_W
        : homeWidgets.length === 0
          ? EMPTY_HOME_W
          : PAD * 2 + homeWidgets.reduce((sum, w) => sum + w.width, 0) + DIVIDER * (homeWidgets.length - 1)

  return (
    <div className="h-full font-sans text-white">
      <div
        ref={notchRef}
        className="notch"
        data-open={expanded}
        data-hidden={hidden}
        data-ghost={ghost && !expanded}
        onMouseLeave={onMouseLeave}
        style={{
          width: size.w,
          height: size.h,
          '--radius': size.r + 'px',
          '--ear': size.ear + 'px',
          '--ghost': settings.island?.ghostOpacity ?? 0.15
        }}
      >
        <div className="notch-ear left" />
        <div className="notch-ear right" />
        <div className="notch-body">
          <div className="layer" data-on={!expanded} style={{ width: size.w, height: CLOSED.h }}>
            <Closed state={state} widgets={shownWidgets} pill={settings.pill} notice={notice} active={!expanded} />
          </div>
          <div ref={openRef} className="layer open" data-on={expanded} style={{ width: openWidth }}>
            <Open
              state={state}
              tab={activeTab}
              setTab={setTab}
              hasClaude={hasClaude}
              approvals={approvals}
              widgets={homeWidgets}
              settings={settings}
              active={expanded}
              systemVisible={systemVisible}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

const FALLBACK = { time: CompactTime, date: CompactDate }

// Closed notch: small live indicators on the sides. When no widget has anything to show on the left,
// the chosen fallback (time, date or nothing) fills it; the right side gets its own fallback when no
// Claude Code session or notice is there. Both are set in the settings window (settings.pill).
function Closed({ state, widgets, pill, notice, active }) {
  const left = widgets.map((w) => w.Compact && <w.Compact key={w.id} />)
  const LeftFallback = FALLBACK[pill?.leftFallback ?? 'time']
  const RightFallback = FALLBACK[pill?.rightFallback]
  return (
    <div className="flex h-full items-center justify-between gap-3 px-3.5 text-[12px] whitespace-nowrap">
      <span className="flex min-w-0 items-center gap-2">
        <span className="peer flex min-w-0 items-center gap-2 empty:hidden">{left}</span>
        {LeftFallback && (
          <span className="hidden peer-empty:inline">
            <LeftFallback />
          </span>
        )}
      </span>
      {notice?.text ? (
        <span className="flex min-w-0 items-center gap-1.5">
          <Mascot mood="done" cell={1.5} active={active} />
          <span className="max-w-[200px] truncate">{notice.text}</span>
        </span>
      ) : notice ? (
        <span className="flex min-w-0 items-center gap-1.5">
          <Mascot mood={notice.kind === 'done' ? 'done' : 'waiting'} cell={1.5} active={active} />
          <span className="max-w-[150px] truncate">{notice.project}</span>
          <span className="text-white/55">{notice.kind === 'done' ? 'finished' : 'needs you'}</span>
        </span>
      ) : state.claude.sessions.length > 0 ? (
        <ClaudeCompact sessions={state.claude.sessions} active={active} />
      ) : (
        RightFallback && <RightFallback />
      )}
    </div>
  )
}

function Tab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold transition-colors ${
        active ? 'bg-white/12 text-white' : 'text-white/50 hover:text-white/80'
      }`}
    >
      {children}
    </button>
  )
}

function Open({ state, tab, setTab, hasClaude, approvals, widgets, settings, active, systemVisible }) {
  const top = mostRelevant(state.claude.sessions)
  return (
    <div className="px-5 pt-2.5 pb-4">
      <div className="mb-3 flex items-center gap-1">
        <Tab active={tab === 'home'} onClick={() => setTab('home')}>
          Home
        </Tab>
        {hasClaude && (
          <Tab active={tab === 'claude'} onClick={() => setTab('claude')}>
            {top && <Dot state={top.state} />}
            Claude Code
          </Tab>
        )}
        <Tab active={tab === 'system'} onClick={() => setTab('system')}>
          System
        </Tab>
        <span className="ml-auto flex items-center gap-2">
          {!settings.approvalsEnabled && hasClaude && <span className="text-[10px] text-white/35">Approvals off</span>}
          <button
            onClick={() => window.island.openSettings()}
            title="Settings"
            aria-label="Open settings"
            className="grid h-6 w-6 place-items-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white/80"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </span>
      </div>
      {tab === 'claude' ? (
        approvals.length > 0 ? (
          <ApprovalCard key={approvals[0].id} approval={approvals[0]} queued={approvals.length - 1} active={active} />
        ) : (
          <ClaudePanel sessions={state.claude.sessions} active={active} />
        )
      ) : tab === 'system' ? (
        <SystemPanel system={state.system} settings={settings} active={systemVisible} />
      ) : widgets.length === 0 ? (
        <p className="text-xs text-white/45">Every Home widget is hidden. Turn some back on in Settings.</p>
      ) : (
        <div className="flex items-stretch">
          {widgets.map((w, i) => (
            <div key={w.id} className="flex items-stretch">
              {i > 0 && <div className="mx-4 w-px bg-white/10" />}
              <div style={{ width: w.width }}>
                <w.Panel />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
