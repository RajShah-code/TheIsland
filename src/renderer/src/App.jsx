import { useEffect, useRef, useState } from 'react'
import { ApprovalCard, ClaudeCompact, Dot, SessionList } from './components/Claude'
import { useIsland } from './store'
import { clockWidget as Clock, widgets } from './widgets'

const NOTICE_MS = 5000

export default function App() {
  const { claude, settings } = useIsland()
  const [hover, setHover] = useState(false)
  const [notice, setNotice] = useState(null)
  const leaveTimer = useRef(null)
  const noticeTimer = useRef(null)

  // Brief message in the pill when a session finishes or needs input.
  useEffect(
    () =>
      window.island.onAttention((a) => {
        if (a.kind === 'approval') return
        setNotice(a)
        clearTimeout(noticeTimer.current)
        noticeTimer.current = setTimeout(() => setNotice(null), NOTICE_MS)
      }),
    []
  )

  const approvals = claude.approvals
  const expanded = hover || approvals.length > 0

  // The window lets clicks through except over the island itself.
  const enter = () => {
    clearTimeout(leaveTimer.current)
    window.island.setInteractive(true)
    setHover(true)
  }
  const leave = () => {
    window.island.setInteractive(false)
    leaveTimer.current = setTimeout(() => setHover(false), 250)
  }

  return (
    <div className="flex h-full justify-center pt-1.5 font-sans text-white">
      <div
        onMouseEnter={enter}
        onMouseLeave={leave}
        className={`h-fit overflow-hidden bg-black shadow-[0_8px_30px_rgb(0_0_0/0.45)] ring-1 ring-white/10 transition-[width,border-radius,padding] duration-300 ease-out ${
          expanded ? 'w-[520px] rounded-[26px] p-4' : 'w-fit max-w-[520px] rounded-full px-4 py-[7px]'
        }`}
      >
        {expanded ? (
          <Expanded claude={claude} approvals={approvals} settings={settings} />
        ) : (
          <Pill claude={claude} notice={notice} />
        )}
      </div>
    </div>
  )
}

function Pill({ claude, notice }) {
  return (
    <div className="flex h-[22px] min-w-[150px] items-center gap-3 whitespace-nowrap">
      <Clock.Compact />
      {notice ? (
        <span className="flex items-center gap-1.5 text-[12px]">
          <Dot state={notice.kind === 'done' ? 'done' : 'waiting'} />
          <span className="max-w-[160px] truncate">{notice.project}</span>
          <span className="text-white/55">{notice.kind === 'done' ? 'finished' : 'needs you'}</span>
        </span>
      ) : (
        <ClaudeCompact sessions={claude.sessions} />
      )}
      <span className="ml-auto flex items-center gap-2">
        {widgets.map((w) => w.Compact && <w.Compact key={w.id} />)}
      </span>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section className="rounded-2xl bg-white/[0.04] p-3">
      {title && <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">{title}</h2>}
      {children}
    </section>
  )
}

function Expanded({ claude, approvals, settings }) {
  return (
    <div className="scroll-thin max-h-[440px] space-y-2.5 overflow-y-auto">
      <div className="flex items-center justify-between px-1">
        <Clock.Panel />
        {!settings.approvalsEnabled && <span className="text-[10px] text-white/40">Approvals off</span>}
      </div>
      {approvals.length > 0 && <ApprovalCard key={approvals[0].id} approval={approvals[0]} queued={approvals.length - 1} />}
      <Section title="Claude Code">
        <SessionList sessions={claude.sessions} />
      </Section>
      {approvals.length === 0 &&
        widgets.map(
        (w) =>
          w.Panel && (
            <Section key={w.id} title={w.name}>
              <w.Panel />
            </Section>
          )
      )}
    </div>
  )
}
