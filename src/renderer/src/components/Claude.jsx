// Coding agent status and approvals (core of the island, not a widget). Claude Code first; Codex,
// Gemini CLI, Antigravity, Cursor and Copilot CLI come through the same relay (src/shared/agents.mjs).
import { useEffect, useState } from 'react'
import { AGENT_NAMES } from '../../../shared/agents.mjs'
import { useIsland } from '../store'
import { Buddy, buddyReact } from './Buddy'

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

// Names the agent on an approval when it isn't Claude Code.
function AgentTag({ agent }) {
  if (!agent || agent === 'claude') return null
  return <span className="rounded bg-white/10 px-1 text-[10px] text-white/55">{AGENT_NAMES[agent] || agent}</span>
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

// The buddy, or the plain coloured dot when the user turned the buddy off (settings.claude.buddy).
export function useBuddyOn() {
  return useIsland().settings?.claude?.buddy !== false
}

export function Mascot({ mood, ...props }) {
  return useBuddyOn() ? <Buddy mood={mood} {...props} /> : <Dot state={mood} />
}

// ---- Subagents ----

export function runningAgents(s) {
  return s?.agents ? s.agents.filter((a) => a.state === 'running').length : 0
}

function elapsed(ms) {
  const sec = Math.max(0, Math.floor(ms / 1000))
  if (sec < 60) return sec + 's'
  const m = Math.floor(sec / 60)
  if (m < 60) return `${m}m ${String(sec % 60).padStart(2, '0')}s`
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}

function Check() {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" className="shrink-0" aria-hidden="true">
      <path d="M1 4.2 3.2 6.3 7 1.8" fill="none" stroke="#34d399" strokeWidth="1.6" />
    </svg>
  )
}

// One line per subagent under its session. `lit` and `now` come from the panel's render, which the
// blink timer repeats once a second while a subagent runs.
function AgentRow({ a, lit, now }) {
  const running = a.state === 'running'
  return (
    <div className={`flex items-center gap-2 text-[11px] ${running ? '' : 'opacity-60'}`}>
      <span className="flex w-2 shrink-0 justify-center">
        {running ? (
          <span className={`inline-block h-1.5 w-1.5 rounded-full bg-amber-400 ${lit ? '' : 'opacity-35'}`} />
        ) : (
          <Check />
        )}
      </span>
      <span className="max-w-[170px] shrink-0 truncate text-white/80">{a.description}</span>
      {a.type && <span className="max-w-[90px] shrink-0 truncate text-white/40">{a.type}</span>}
      {running && a.currentTool && (
        <span className="min-w-0 truncate font-mono text-[10px] text-white/35">
          {a.currentTool}
          {a.hint ? ': ' + a.hint : ''}
        </span>
      )}
      <span className="ml-auto shrink-0 pl-1 text-white/35 tabular-nums">
        {elapsed((running ? now : a.endedAt) - a.startedAt)}
      </span>
    </div>
  )
}

const PRIORITY = { waiting: 0, working: 1, done: 2, idle: 3, stale: 4 }

export function mostRelevant(sessions) {
  return [...sessions].sort((a, b) => PRIORITY[a.state] - PRIORITY[b.state] || b.updatedAt - a.updatedAt)[0]
}

// Collapsed pill: the session that matters most right now.
export function ClaudeCompact({ sessions, active }) {
  const s = mostRelevant(sessions)
  if (!s) return null
  const more = sessions.length - 1
  const agents = runningAgents(s)
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-[12px]">
      <Mascot mood={s.state} tool={s.tool} beat={s.updatedAt} cell={1.5} active={active} />
      <span className="max-w-[110px] truncate text-white/85">{s.project}</span>
      {agents > 0 ? (
        <span className="shrink-0 text-white/45">{agents === 1 ? '1 agent' : `${agents} agents`}</span>
      ) : (
        s.state === 'working' && s.tool && <span className="max-w-[80px] truncate text-white/45">{s.tool}</span>
      )}
      {s.state !== 'working' && <span className="text-white/45">{STATE[s.state]?.label}</span>}
      {more > 0 && <span className="text-white/40">+{more}</span>}
    </span>
  )
}

export function ClaudePanel({ sessions, active }) {
  const buddy = useBuddyOn()
  // One blink timer for every subagent row, only while one is running and the panel is shown. Each
  // toggle re-renders the panel, which also moves the elapsed times on.
  const lit = useBlink(active && sessions.some((s) => runningAgents(s) > 0))
  const now = Date.now()
  if (sessions.length === 0) {
    return <p className="text-xs text-white/45">No coding agent sessions right now</p>
  }
  const top = mostRelevant(sessions)
  // With sessions from more than one agent, each row says whose it is.
  const mixed = new Set(sessions.map((s) => s.agent || 'claude')).size > 1
  return (
    <div className="flex items-start gap-3">
      {buddy && <Buddy mood={top.state} tool={top.tool} beat={top.updatedAt} cell={2.5} active={active} follow />}
      <div className={`min-w-0 flex-1 space-y-1 ${buddy ? 'pt-2' : ''}`}>
        {sessions.map((s) => (
          <div key={s.id} className={s.state === 'stale' ? 'opacity-50' : ''}>
            <div className="flex items-center gap-2 text-xs">
              <Dot state={s.state} />
              <span className="max-w-[150px] shrink-0 truncate font-medium">{s.title || s.project}</span>
              {mixed && <span className="shrink-0 rounded bg-white/10 px-1 text-[10px] text-white/55">{AGENT_NAMES[s.agent] || s.agent}</span>}
              <span className="shrink-0 text-white/45">{STATE[s.state]?.label}</span>
              {s.state === 'working' && (
                <span className="min-w-0 truncate font-mono text-[11px] text-white/40">
                  {s.tool}
                  {s.hint ? ': ' + s.hint : ''}
                </span>
              )}
            </div>
            {s.agents?.length > 0 && (
              <div className="mt-0.5 space-y-0.5 pl-4">
                {s.agents.map((a) => (
                  <AgentRow key={a.key} a={a} lit={lit} now={now} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
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

function Countdown({ until }) {
  const left = useSecondsLeft(until)
  return (
    <span className="text-[10px] text-white/35 tabular-nums">
      Terminal in {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
    </span>
  )
}

function Tick({ on }) {
  return (
    <span
      className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded-[4px] ring-1 ${on ? 'bg-black ring-black' : 'ring-white/40'}`}
    >
      {on && (
        <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
          <path d="M1 4.2 3.2 6.3 7 1.8" fill="none" stroke="#fff" strokeWidth="1.6" />
        </svg>
      )}
    </span>
  )
}

// AskUserQuestion: the question as text and its options as buttons, answered right here. A single
// question with one choice is sent on the first click; otherwise pick an answer for each and press Send.
// Typing a different answer ("Other") still needs the terminal.
function QuestionCard({ approval, queued, active }) {
  const questions = approval.input.questions
  const [picked, setPicked] = useState(() => questions.map(() => []))
  const options = (q) => (Array.isArray(q.options) ? q.options.filter((o) => typeof o?.label === 'string') : [])
  const instant = questions.length === 1 && !questions[0].multiSelect
  const send = (answers) => {
    buddyReact('allow')
    // Multi-select labels in the order the options are listed, not the order they were clicked.
    const ordered = answers.map((p, i) => options(questions[i]).map((o) => o.label).filter((l) => p.includes(l)))
    window.island.decide(approval.id, 'allow', ordered)
  }
  const pick = (qi, label) => {
    if (instant) return send([[label]])
    setPicked((prev) =>
      prev.map((p, i) => {
        if (i !== qi) return p
        if (!questions[qi].multiSelect) return [label]
        return p.includes(label) ? p.filter((l) => l !== label) : [...p, label]
      })
    )
  }
  const complete = picked.every((p) => p.length > 0)
  return (
    <div className="space-y-3 rounded-2xl bg-white/[0.06] p-3 ring-1 ring-rose-500/40">
      <div className="flex items-center gap-2 text-xs">
        <Mascot mood="waiting" cell={2} active={active} />
        <span className="font-semibold">{approval.project}</span>
        <AgentTag agent={approval.agent} />
        <span className="text-white/50">{questions.length > 1 ? 'has a few questions' : 'asks you'}</span>
        {queued > 0 && <span className="ml-auto text-white/40">+{queued} more</span>}
      </div>
      <div className="scroll-thin max-h-[236px] space-y-4 overflow-auto pr-1">
        {questions.map((q, qi) => (
          <div key={qi} className="space-y-2">
            <div className="flex items-start gap-2">
              {q.header && (
                <span className="mt-px shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/60">
                  {q.header}
                </span>
              )}
              <p className="text-[13px] leading-snug font-medium text-white/95">{q.question}</p>
            </div>
            {q.multiSelect && <p className="text-[10px] text-white/40">Choose any that apply</p>}
            <div className="grid grid-cols-2 gap-1.5">
              {options(q).map((o) => {
                const on = picked[qi].includes(o.label)
                return (
                  <button
                    key={o.label}
                    onClick={() => pick(qi, o.label)}
                    aria-pressed={instant ? undefined : on}
                    className={`rounded-xl px-3 py-2 text-left transition-colors ${
                      on ? 'bg-white text-black' : 'bg-white/[0.07] text-white hover:bg-white/[0.14]'
                    }`}
                  >
                    <span className="flex items-center gap-2 text-xs font-semibold">
                      {q.multiSelect && <Tick on={on} />}
                      {o.label}
                    </span>
                    {o.description && (
                      <span className={`mt-0.5 block text-[11px] leading-snug ${on ? 'text-black/60' : 'text-white/50'}`}>
                        {o.description}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Countdown until={approval.expiresAt} />
        <button
          onClick={() => window.island.decide(approval.id, null)}
          title="To type a different answer"
          className="ml-auto rounded-full px-3 py-1.5 text-xs text-white/60 transition hover:bg-white/10"
        >
          Answer in terminal
        </button>
        {!instant && (
          <button
            onClick={() => send(picked)}
            disabled={!complete}
            className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-black transition hover:bg-white/85 disabled:bg-white/15 disabled:text-white/35"
          >
            Send
          </button>
        )}
      </div>
    </div>
  )
}

const isQuestion = (a) => a.tool === 'AskUserQuestion' && Array.isArray(a.input?.questions) && a.input.questions.length > 0

export function ApprovalCard(props) {
  return isQuestion(props.approval) ? <QuestionCard {...props} /> : <PermissionCard {...props} />
}

function PermissionCard({ approval, queued, active }) {
  const decide = (d) => {
    if (d) buddyReact(d)
    window.island.decide(approval.id, d)
  }
  return (
    <div className="space-y-2 rounded-2xl bg-white/[0.06] p-3 ring-1 ring-rose-500/40">
      <div className="flex items-center gap-2 text-xs">
        <Mascot mood="waiting" cell={2} active={active} />
        <span className="font-semibold">{approval.project}</span>
        <AgentTag agent={approval.agent} />
        <span className="text-white/50">wants to use</span>
        <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px]">{approval.tool}</span>
        {queued > 0 && <span className="ml-auto text-white/40">+{queued} more</span>}
      </div>
      <Details tool={approval.tool} input={approval.input} />
      <div className="flex items-center gap-2 pt-1">
        <Countdown until={approval.expiresAt} />
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
