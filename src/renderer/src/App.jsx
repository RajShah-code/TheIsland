import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ApprovalCard, ClaudeCompact, ClaudePanel, Dot, mostRelevant } from './components/Claude'
import { useIsland } from './store'
import { widgets } from './widgets'

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
// Fullscreen: reveal when the pointer touches the top edge near the centre, hide again after this.
const PEEK_ZONE = 180
const PEEK_HIDE_MS = 2500
// Short delay so sweeping the pointer across the top of the screen doesn't pop the island open.
const HOVER_INTENT_MS = 90

export default function App() {
  const state = useIsland()
  const { claude, settings, fullscreen } = state
  const [hover, setHover] = useState(false)
  const [peek, setPeek] = useState(false)
  const [notice, setNotice] = useState(null)
  const [tab, setTab] = useState('home')
  const [openSize, setOpenSize] = useState({ w: 600, h: 180 })
  const openRef = useRef(null)
  const timers = useRef({})

  const approvals = claude.approvals
  const hasClaude = claude.sessions.length > 0
  const expanded = hover || approvals.length > 0
  const hidden = fullscreen && !peek && !expanded
  const activeTab = approvals.length > 0 ? 'claude' : tab === 'claude' && !hasClaude ? 'home' : tab
  const homeWidgets = widgets.filter((w) => w.Panel && (!w.visible || w.visible(state)))

  // Brief message in the notch when a session finishes or needs input.
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
    if (!fullscreen) {
      setPeek(false)
      return
    }
    const onMove = (e) => {
      if (e.clientY <= 2 && Math.abs(e.clientX - window.innerWidth / 2) < PEEK_ZONE) reveal()
    }
    document.addEventListener('mousemove', onMove)
    return () => document.removeEventListener('mousemove', onMove)
  }, [fullscreen])

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

  // The window lets clicks through except over the notch itself.
  const enter = () => {
    clearTimeout(timers.current.leave)
    clearTimeout(timers.current.peek)
    window.island.setInteractive(true)
    timers.current.intent = setTimeout(() => setHover(true), HOVER_INTENT_MS)
  }
  const leave = () => {
    clearTimeout(timers.current.intent)
    window.island.setInteractive(false)
    timers.current.leave = setTimeout(() => setHover(false), 220)
    if (fullscreen) timers.current.peek = setTimeout(() => setPeek(false), PEEK_HIDE_MS)
  }

  const live = !!notice || hasClaude || (state.media.active && state.media.status === 'Playing')
  const size = expanded
    ? { w: openSize.w, h: openSize.h, r: OPEN_R, ear: OPEN_EAR }
    : { ...CLOSED, w: notice ? NOTICE_W : live ? LIVE_W : CLOSED.w }

  const openWidth =
    activeTab === 'claude'
      ? CLAUDE_W
      : PAD * 2 + homeWidgets.reduce((sum, w) => sum + w.width, 0) + DIVIDER * (homeWidgets.length - 1)

  return (
    <div className="h-full font-sans text-white">
      <div
        className="notch"
        data-open={expanded}
        data-hidden={hidden}
        onMouseEnter={enter}
        onMouseLeave={leave}
        style={{ width: size.w, height: size.h, '--radius': size.r + 'px', '--ear': size.ear + 'px' }}
      >
        <div className="notch-ear left" />
        <div className="notch-ear right" />
        <div className="notch-body">
          <div className="layer" data-on={!expanded} style={{ width: size.w, height: CLOSED.h }}>
            <Closed state={state} notice={notice} />
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
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// Closed notch: empty when nothing is happening; small live indicators on the sides otherwise.
function Closed({ state, notice }) {
  const left = widgets.map((w) => w.Compact && <w.Compact key={w.id} />)
  return (
    <div className="flex h-full items-center justify-between gap-3 px-3.5 text-[12px] whitespace-nowrap">
      <span className="flex min-w-0 items-center gap-2">{left}</span>
      {notice ? (
        <span className="flex min-w-0 items-center gap-1.5">
          <Dot state={notice.kind === 'done' ? 'done' : 'waiting'} />
          <span className="max-w-[150px] truncate">{notice.project}</span>
          <span className="text-white/55">{notice.kind === 'done' ? 'finished' : 'needs you'}</span>
        </span>
      ) : (
        <ClaudeCompact sessions={state.claude.sessions} />
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

function Open({ state, tab, setTab, hasClaude, approvals, widgets, settings }) {
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
        {!settings.approvalsEnabled && hasClaude && (
          <span className="ml-auto text-[10px] text-white/35">Approvals off</span>
        )}
      </div>
      {tab === 'claude' ? (
        approvals.length > 0 ? (
          <ApprovalCard key={approvals[0].id} approval={approvals[0]} queued={approvals.length - 1} />
        ) : (
          <ClaudePanel sessions={state.claude.sessions} />
        )
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
