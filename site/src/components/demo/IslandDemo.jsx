import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, m, useInView, useReducedMotion } from 'motion/react'
import { Check, Pause, Play, SkipBack, SkipForward } from '@phosphor-icons/react'
import { easeOut, springIsland, springUI } from '../../lib/motion.js'

// A working replica of the island on a small desktop. It plays each scene by itself while it is on
// screen; clicking a scene or a button in the island switches to manual and lets you try it.

const SCENES = [
  { id: 'permission', label: 'Permission' },
  { id: 'question', label: 'Question' },
  { id: 'music', label: 'Music' },
  { id: 'sessions', label: 'Sessions' },
]

// How long each phase lasts while it plays by itself (ms). `null` waits for the visitor.
const AUTO = {
  permission: { idle: 1500, open: 3400, pressing: 380, answered: 1900 },
  question: { idle: 1300, open: 3400, pressing: 380, answered: 1900 },
  music: { idle: 1700, open: 3800 },
  sessions: { idle: 1300, open: 4200 },
}
const MANUAL = {
  permission: { idle: 900, open: null, pressing: 380, answered: 2200 },
  question: { idle: 900, open: null, pressing: 380, answered: 2200 },
  music: { idle: 700, open: null },
  sessions: { idle: 700, open: null },
}

function nextPhase(scene, phase) {
  const order = AUTO[scene].pressing ? ['idle', 'open', 'pressing', 'answered'] : ['idle', 'open']
  const i = order.indexOf(phase)
  return i < order.length - 1 ? order[i + 1] : null
}

function Dot({ tone }) {
  const color = { working: 'bg-working', waiting: 'bg-waiting', done: 'bg-done' }[tone]
  return <span className={`inline-block size-2 shrink-0 rounded-full ${color}`} aria-hidden="true" />
}

function Art({ className = 'size-5' }) {
  return (
    <span
      className={`block shrink-0 rounded-[5px] bg-[radial-gradient(circle_at_30%_25%,#f0abfc,transparent_55%),radial-gradient(circle_at_75%_80%,#60a5fa,transparent_60%),#1e1b4b] ${className}`}
      aria-hidden="true"
    />
  )
}

function Bars() {
  return (
    <span className="flex h-3 items-end gap-[2px]" aria-hidden="true">
      {[0.55, 1, 0.7].map((h, i) => (
        <span key={i} className="w-[2.5px] rounded-full bg-white/70" style={{ height: `${h * 100}%` }} />
      ))}
    </span>
  )
}

// ---- The closed pill ----

function Pill({ scene, phase, answer }) {
  let content
  if (phase === 'answered') {
    const text = { allow: 'Allowed', deny: 'Denied', terminal: 'In the terminal' }[answer] || `Answered: ${answer}`
    content = (
      <>
        <span className="flex size-4 items-center justify-center rounded-full bg-done/20 text-done">
          <Check size={10} weight="bold" />
        </span>
        <span className="text-white/85">{text}</span>
      </>
    )
  } else if (scene === 'music') {
    content = (
      <>
        <Art className="size-[18px]" />
        <span className="text-white/85">Night Drive</span>
        <Bars />
      </>
    )
  } else {
    const detail = { permission: 'Bash', question: 'Thinking', sessions: '2 agents' }[scene]
    content = (
      <>
        <Dot tone="working" />
        <span className="text-white/85">my-app</span>
        <span className="text-white/45">{detail}</span>
      </>
    )
  }
  return <div className="flex h-8 items-center gap-2 px-4 text-[12px] whitespace-nowrap">{content}</div>
}

// ---- The open island ----

function Countdown() {
  const [left, setLeft] = useState(119)
  useEffect(() => {
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <span className="text-[10px] text-white/35 tabular-nums">
      Terminal in {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
    </span>
  )
}

function CardHeader({ children }) {
  return <div className="flex items-center gap-2 text-[12px]">{children}</div>
}

function PermissionCard({ pressing, onAnswer }) {
  return (
    <div className="space-y-2.5">
      <CardHeader>
        <Dot tone="waiting" />
        <span className="font-semibold">my-app</span>
        <span className="text-white/50">wants to use</span>
        <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px]">Bash</span>
      </CardHeader>
      <pre className="rounded-lg bg-white/[0.07] px-2.5 py-2 font-mono text-[11px] text-white/90">npm run build</pre>
      <p className="text-[11px] text-white/50">Build the production bundle</p>
      <div className="flex items-center gap-1.5 pt-0.5">
        <span className="hidden @sm:inline">
          <Countdown />
        </span>
        <button
          type="button"
          onClick={() => onAnswer('terminal')}
          className="ml-auto rounded-full px-2 py-1.5 text-[11px] whitespace-nowrap text-white/60 transition-colors duration-150 hover:bg-white/10 @sm:px-2.5"
        >
          Answer in terminal
        </button>
        <button
          type="button"
          onClick={() => onAnswer('deny')}
          className="rounded-full bg-waiting/20 px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap text-rose-200 transition-colors duration-150 hover:bg-waiting/35"
        >
          Deny
        </button>
        <m.button
          type="button"
          onClick={() => onAnswer('allow')}
          animate={{ scale: pressing === 'allow' ? 0.94 : 1 }}
          transition={springUI}
          className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap text-black @sm:px-3.5 transition-colors duration-150 hover:bg-white/85"
        >
          Allow once
        </m.button>
      </div>
    </div>
  )
}

const OPTIONS = [
  { label: 'pnpm', description: 'Fast, and saves disk space' },
  { label: 'npm', description: 'Comes with Node.js' },
]

function QuestionCard({ pressing, onAnswer }) {
  return (
    <div className="space-y-2.5">
      <CardHeader>
        <Dot tone="waiting" />
        <span className="font-semibold">my-app</span>
        <span className="text-white/50">asks you</span>
      </CardHeader>
      <div className="flex items-start gap-2">
        <span className="mt-px shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/60">
          Setup
        </span>
        <p className="text-[13px] leading-snug font-medium">Which package manager should I use?</p>
      </div>
      <div className="grid grid-cols-1 gap-1.5 @sm:grid-cols-2">
        {OPTIONS.map((o) => {
          const on = pressing === o.label
          return (
            <m.button
              type="button"
              key={o.label}
              onClick={() => onAnswer(o.label)}
              animate={{ scale: on ? 0.97 : 1 }}
              transition={springUI}
              className={`rounded-xl px-3 py-2 text-left transition-colors duration-150 ${
                on ? 'bg-white text-black' : 'bg-white/[0.07] hover:bg-white/[0.14]'
              }`}
            >
              <span className="block text-[12px] font-semibold">{o.label}</span>
              <span className={`mt-0.5 block text-[11px] ${on ? 'text-black/60' : 'text-white/50'}`}>{o.description}</span>
            </m.button>
          )
        })}
      </div>
      <div className="flex items-center">
        <span className="hidden @sm:inline">
          <Countdown />
        </span>
        <button
          type="button"
          onClick={() => onAnswer('terminal')}
          className="ml-auto rounded-full px-2 py-1.5 text-[11px] whitespace-nowrap text-white/60 transition-colors duration-150 hover:bg-white/10 @sm:px-2.5"
        >
          Answer in terminal
        </button>
      </div>
    </div>
  )
}

function MusicCard() {
  const [playing, setPlaying] = useState(true)
  const PlayIcon = playing ? Pause : Play
  return (
    <div className="flex items-center gap-3.5">
      <Art className="size-14 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold">Night Drive</p>
        <p className="truncate text-[12px] text-white/50">Lumen</p>
        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/15">
          <div className="h-full w-[38%] rounded-full bg-white/80" />
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button type="button" aria-label="Previous" className="grid size-8 place-items-center rounded-full text-white/70 hover:bg-white/10">
          <SkipBack size={15} weight="fill" />
        </button>
        <button
          type="button"
          aria-label={playing ? 'Pause' : 'Play'}
          onClick={() => setPlaying((p) => !p)}
          className="grid size-9 place-items-center rounded-full bg-white text-black transition-transform duration-150 active:scale-95"
        >
          <PlayIcon size={15} weight="fill" />
        </button>
        <button type="button" aria-label="Next" className="grid size-8 place-items-center rounded-full text-white/70 hover:bg-white/10">
          <SkipForward size={15} weight="fill" />
        </button>
      </div>
    </div>
  )
}

function SessionsCard() {
  const row = 'flex items-center gap-2 text-[11px]'
  return (
    <div className="space-y-2">
      <div className={`${row} text-[12px]`}>
        <Dot tone="working" />
        <span className="font-medium">my-app</span>
        <span className="text-white/45">Working</span>
        <span className="truncate font-mono text-[11px] text-white/40">Edit: App.jsx</span>
      </div>
      <div className="space-y-1 pl-4">
        <div className={row}>
          <span className="flex w-2 justify-center">
            <span className="size-1.5 rounded-full bg-working" />
          </span>
          <span className="truncate text-white/80">Explore the code base</span>
          <span className="hidden text-white/40 @sm:inline">Explore</span>
          <span className="ml-auto text-white/35 tabular-nums">1m 12s</span>
        </div>
        <div className={`${row} opacity-60`}>
          <span className="flex w-2 justify-center text-done">
            <Check size={9} weight="bold" />
          </span>
          <span className="truncate text-white/80">Write the tests</span>
          <span className="hidden text-white/40 @sm:inline">general</span>
          <span className="ml-auto text-white/35 tabular-nums">48s</span>
        </div>
      </div>
      <div className={`${row} text-[12px]`}>
        <Dot tone="done" />
        <span className="font-medium">docs-site</span>
        <span className="text-white/45">Done</span>
      </div>
    </div>
  )
}

// ---- The faux desktop behind it ----

function terminalLines(scene, phase, answer) {
  const asked = phase === 'open' || phase === 'pressing'
  if (scene === 'permission') {
    return [
      { t: '> build the app for release', c: 'text-white/70' },
      { t: '● Bash(npm run build)', c: 'text-white/85' },
      phase === 'answered'
        ? answer === 'allow'
          ? { t: '  ✓ Built in 2.1s', c: 'text-done' }
          : answer === 'deny'
            ? { t: '  Denied. Claude will try another way.', c: 'text-rose-300' }
            : { t: '  Do you want to proceed? 1. Yes  2. No', c: 'text-white/70' }
        : { t: asked ? '  Waiting for your answer...' : '  Running...', c: 'text-white/45' },
    ]
  }
  if (scene === 'question') {
    return [
      { t: '> set up the project', c: 'text-white/70' },
      { t: '● Asking which package manager to use', c: 'text-white/85' },
      phase === 'answered' && answer !== 'terminal'
        ? { t: `  Using ${answer}`, c: 'text-done' }
        : { t: '  Waiting for your answer...', c: 'text-white/45' },
    ]
  }
  if (scene === 'music') {
    return [
      { t: '> refactor the settings page', c: 'text-white/70' },
      { t: '● Edit(src/settings/Page.jsx)', c: 'text-white/85' },
      { t: '  Updated 3 sections', c: 'text-white/45' },
    ]
  }
  return [
    { t: '> add tests for the parser', c: 'text-white/70' },
    { t: '● Agent(Explore the code base)', c: 'text-white/85' },
    { t: '● Agent(Write the tests)  done', c: 'text-white/45' },
  ]
}

function Terminal({ scene, phase, answer }) {
  return (
    <div className="absolute right-4 bottom-4 left-4 overflow-hidden rounded-xl bg-[#151515]/95 ring-1 ring-white/[0.08] @2xl:right-auto @2xl:w-[calc(60%-2rem)]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
        <span className="font-mono text-[10px] text-white/40">Terminal: my-app</span>
        <span className="flex items-center gap-2.5 text-white/30" aria-hidden="true">
          <span className="h-px w-2 bg-current" />
          <span className="size-2 rounded-[2px] ring-1 ring-current" />
          <span className="text-[10px] leading-none">✕</span>
        </span>
      </div>
      <div className="space-y-1 px-3 py-2.5 font-mono text-[10.5px] leading-relaxed @md:text-[11px]">
        {terminalLines(scene, phase, answer).map((line, i) => (
          <p key={i} className={`truncate ${line.c}`}>
            {line.t}
          </p>
        ))}
      </div>
    </div>
  )
}

const CODE = [
  ['import', ' { useState } ', 'from', " 'react'"],
  [],
  ['export default function', ' Settings() {'],
  ['  const', ' [theme, setTheme] = useState(', "'dark'", ')'],
  ['  return', ' ('],
  ['    <Page title=', '"Settings"', '>'],
  ['      <Toggle value={theme} />'],
  ['    </Page>'],
  ['  )'],
  ['}'],
]

// A dim editor on the right, so the desktop reads as somebody's real workspace.
function Editor() {
  return (
    <div className="absolute top-[22%] right-4 bottom-4 hidden w-[calc(40%-1.75rem)] overflow-hidden rounded-xl bg-[#131313]/90 ring-1 ring-white/[0.06] @2xl:block">
      <div className="flex items-center gap-2 border-b border-white/[0.05] px-3 py-2">
        <span className="rounded-md bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] text-white/45">Settings.jsx</span>
      </div>
      <div className="space-y-[3px] px-3 py-3 font-mono text-[10.5px] leading-relaxed text-white/30">
        {CODE.map((parts, i) => (
          <p key={i} className="flex gap-3 whitespace-pre">
            <span className="w-3 text-right text-white/15">{i + 1}</span>
            <span>
              {parts.map((p, j) => (
                <span key={j} className={j % 2 === 0 && parts.length > 1 ? 'text-sky-300/45' : ''}>
                  {p}
                </span>
              ))}
            </span>
          </p>
        ))}
      </div>
    </div>
  )
}

// ---- The demo ----

export default function IslandDemo() {
  const reduce = useReducedMotion()
  const ref = useRef(null)
  const inView = useInView(ref, { margin: '-10% 0px -10% 0px' })
  const [scene, setScene] = useState('permission')
  const [phase, setPhase] = useState('idle')
  const [answer, setAnswer] = useState(null)
  const [manual, setManual] = useState(false)
  // Reduced motion: no autoplay, the visitor drives it.
  const auto = !manual && !reduce

  useEffect(() => {
    const times = (auto ? AUTO : MANUAL)[scene]
    const wait = times[phase]
    if (wait == null || (auto && !inView)) return
    const t = setTimeout(() => {
      const next = nextPhase(scene, phase)
      if (next === 'pressing') {
        // Playing by itself: "click" Allow or the first option.
        setAnswer(scene === 'question' ? OPTIONS[0].label : 'allow')
        setPhase('pressing')
      } else if (next) {
        setPhase(next)
      } else if (auto) {
        const i = SCENES.findIndex((s) => s.id === scene)
        setScene(SCENES[(i + 1) % SCENES.length].id)
        setAnswer(null)
        setPhase('idle')
      } else {
        // Manual: start the same scene again so it can be tried once more.
        setAnswer(null)
        setPhase('idle')
      }
    }, wait)
    return () => clearTimeout(t)
  }, [scene, phase, auto, inView])

  const pick = (id) => {
    setManual(true)
    setScene(id)
    setAnswer(null)
    setPhase('open')
  }
  const onAnswer = (value) => {
    setManual(true)
    setAnswer(value)
    setPhase(value === 'terminal' ? 'answered' : 'pressing')
  }

  const open = phase === 'open' || phase === 'pressing'
  const pressing = phase === 'pressing' ? answer : null
  const width = scene === 'music' ? 'w-[min(25rem,calc(100cqw-2rem))]' : 'w-[min(30rem,calc(100cqw-2rem))]'

  return (
    <div ref={ref}>
      <div className="bezel">
        <div className="bezel-core overflow-hidden">
          <div className="@container relative aspect-[4/5] overflow-hidden rounded-[calc(2rem-0.375rem)] bg-[#0d0d0d] sm:aspect-[16/11] lg:aspect-[2/1]">
            {/* Wallpaper: a soft light from the top, like the page above it */}
            <div
              className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_0%,rgb(255_255_255/0.08),transparent_70%),radial-gradient(ellipse_50%_40%_at_85%_100%,rgb(96_165_250/0.08),transparent_70%)]"
              aria-hidden="true"
            />
            <Editor />
            <Terminal scene={scene} phase={phase} answer={answer} />

            <div className="absolute inset-x-0 top-0 flex justify-center">
              <m.div
                layout
                transition={springIsland}
                style={{ borderBottomLeftRadius: open ? 26 : 16, borderBottomRightRadius: open ? 26 : 16 }}
                className="overflow-hidden bg-black text-white shadow-[0_18px_40px_-18px_rgb(0_0_0/0.9),0_0_0_1px_rgb(255_255_255/0.06)]"
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  <m.div
                    key={open ? `open-${scene}` : `pill-${scene}-${phase}-${answer}`}
                    layout="position"
                    initial={{ opacity: 0, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, filter: 'blur(0px)', transition: { duration: 0.3, delay: 0.08, ease: easeOut } }}
                    exit={{ opacity: 0, filter: 'blur(4px)', transition: { duration: 0.12, ease: easeOut } }}
                  >
                    {open ? (
                      <div className={`${width} p-4 pt-3.5`}>
                        {scene === 'permission' && <PermissionCard pressing={pressing} onAnswer={onAnswer} />}
                        {scene === 'question' && <QuestionCard pressing={pressing} onAnswer={onAnswer} />}
                        {scene === 'music' && <MusicCard />}
                        {scene === 'sessions' && <SessionsCard />}
                      </div>
                    ) : (
                      <Pill scene={scene} phase={phase} answer={answer} />
                    )}
                  </m.div>
                </AnimatePresence>
              </m.div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <div className="flex rounded-full bg-white/[0.04] p-1 ring-1 ring-inset ring-line" role="group" aria-label="Demo scene">
          {SCENES.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={scene === s.id}
              onClick={() => pick(s.id)}
              className={`relative rounded-full px-3.5 py-1.5 text-[13px] transition-colors duration-200 ${
                scene === s.id ? 'text-fg' : 'text-muted hover:text-fg'
              }`}
            >
              {scene === s.id && (
                <m.span layoutId="demo-scene" transition={springUI} className="absolute inset-0 rounded-full bg-white/[0.09]" />
              )}
              <span className="relative">{s.label}</span>
            </button>
          ))}
        </div>
        <p className="text-sm text-subtle">{manual || reduce ? 'Click Allow or pick an answer in the island.' : 'Playing by itself. Pick a scene to try it.'}</p>
      </div>
    </div>
  )
}
