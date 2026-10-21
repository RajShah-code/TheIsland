// Claude Code status and approvals (core of the island, not a widget).
import { useEffect, useState } from 'react'

// Blinks the "working" dot once a second with a timer instead of a CSS animation: a running CSS
// animation makes Chromium repaint the transparent overlay every frame (measured: ~50% of a core).
function useBlink(on) {
  const [lit, setLit] = useState(true)
  useEffect(() => {
    if (!on) return
    const t = setInterval(() => setLit((v) => !v), 1000)
    return () => clearInterval(t)
  }, [on])
  return !on || lit
}

export const STATE = {
  working: { label: 'Working', dot: 'bg-amber-400', pulse: true },
  waiting: { label: 'Needs you', dot: 'bg-rose-500', pulse: false },
  done: { label: 'Done', dot: 'bg-emerald-400', pulse: false },
  idle: { label: 'Idle', dot: 'bg-white/40', pulse: false },
  stale: { label: 'No updates', dot: 'bg-white/20', pulse: false }
}

export function Dot({ state }) {
  const s = STATE[state] || STATE.idle
  const lit = useBlink(s.pulse)
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${s.dot} ${lit ? '' : 'opacity-35'}`} />
}

const PRIORITY = { waiting: 0, working: 1, done: 2, idle: 3, stale: 4 }

export function mostRelevant(sessions) {
  return [...sessions].sort((a, b) => PRIORITY[a.state] - PRIORITY[b.state] || b.updatedAt - a.updatedAt)[0]
}

// Collapsed pill: the session that matters most right now.
export function ClaudeCompact({ sessions }) {
  const s = mostRelevant(sessions)
  if (!s) return null
  const more = sessions.length - 1
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-[12px]">
      <Dot state={s.state} />
      <span className="max-w-[110px] truncate text-white/85">{s.project}</span>
      {s.state === 'working' && s.tool && <span className="max-w-[80px] truncate text-white/45">{s.tool}</span>}
      {s.state !== 'working' && <span className="text-white/45">{STATE[s.state]?.label}</span>}
      {more > 0 && <span className="text-white/40">+{more}</span>}
    </span>
  )
}

export function ClaudePanel({ sessions }) {
  if (sessions.length === 0) {
    return <p className="text-xs text-white/45">No Claude Code sessions right now</p>
  }
  return (
    <div className="space-y-1">
      {sessions.map((s) => (
        <div key={s.id} className={`flex items-center gap-2 text-xs ${s.state === 'stale' ? 'opacity-50' : ''}`}>
          <Dot state={s.state} />
          <span className="max-w-[150px] shrink-0 truncate font-medium">{s.title || s.project}</span>
          <span className="shrink-0 text-white/45">{STATE[s.state]?.label}</span>
          {s.state === 'working' && (
            <span className="min-w-0 truncate font-mono text-[11px] text-white/40">
              {s.tool}
              {s.hint ? ': ' + s.hint : ''}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

function Block({ children, tone }) {
  const color = tone === 'del' ? 'text-rose-300' : tone === 'add' ? 'text-emerald-300' : 'text-white/90'
  return (
    <pre
      className={`scroll-thin max-h-36 overflow-auto rounded-lg bg-white/[0.07] px-2.5 py-2 font-mono text-[11px] leading-snug whitespace-pre-wrap break-all select-text ${color}`}
    >
      {children}
    </pre>
  )
}

// Shows exactly what is being approved.
function Details({ tool, input }) {
  if (typeof input.command === 'string') {
    return (
      <>
        <Block>{input.command}</Block>
        {input.description && <p className="text-[11px] text-white/50">{input.description}</p>}
      </>
    )
  }
  if (typeof input.file_path === 'string' || typeof input.notebook_path === 'string') {
    const file = input.file_path || input.notebook_path
    return (
      <>
        <p className="font-mono text-[11px] break-all text-white/80">{file}</p>
        {typeof input.old_string === 'string' && <Block tone="del">{input.old_string}</Block>}
        {typeof input.new_string === 'string' && <Block tone="add">{input.new_string}</Block>}
        {Array.isArray(input.edits) && <Block>{`${input.edits.length} edits`}</Block>}
        {typeof input.content === 'string' && <Block tone="add">{input.content}</Block>}
        {typeof input.new_source === 'string' && <Block tone="add">{input.new_source}</Block>}
      </>
    )
  }
  if (typeof input.url === 'string') {
    return (
      <>
        <p className="font-mono text-[11px] break-all text-white/80">{input.url}</p>
        {input.prompt && <p className="text-[11px] text-white/50">{input.prompt}</p>}
      </>
    )
  }
  return <Block>{JSON.stringify(input, null, 2)}</Block>
}

function useSecondsLeft(until) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  return Math.max(0, Math.round((until - now) / 1000))
}

export function ApprovalCard({ approval, queued }) {
  const left = useSecondsLeft(approval.expiresAt)
  const decide = (d) => window.island.decide(approval.id, d)
  return (
    <div className="space-y-2 rounded-2xl bg-white/[0.06] p-3 ring-1 ring-rose-500/40">
      <div className="flex items-center gap-2 text-xs">
        <Dot state="waiting" />
        <span className="font-semibold">{approval.project}</span>
        <span className="text-white/50">wants to use</span>
        <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px]">{approval.tool}</span>
        {queued > 0 && <span className="ml-auto text-white/40">+{queued} more</span>}
      </div>
      <Details tool={approval.tool} input={approval.input} />
      <div className="flex items-center gap-2 pt-1">
        <span className="text-[10px] text-white/35 tabular-nums">
          Terminal in {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
        </span>
        <button
          onClick={() => decide(null)}
          className="ml-auto rounded-full px-3 py-1.5 text-xs text-white/60 transition hover:bg-white/10"
        >
          Answer in terminal
        </button>
        <button
          onClick={() => decide('deny')}
          className="rounded-full bg-rose-500/20 px-4 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/35"
        >
          Deny
        </button>
        <button
          onClick={() => decide('allow')}
          className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-black transition hover:bg-white/85"
        >
          Allow once
        </button>
      </div>
    </div>
  )
}
