// Claude Code's buddy: a small pixel creature, drawn as SVG rects, that reacts to the session state.
// No CSS animations (see CLAUDE.md): frames advance on a JS timer, a few per second, and only while
// something moves. Idle costs one blink every few seconds.
import { useEffect, useRef, useState } from 'react'

const ORANGE = '#d97757'
const ALERT = '#fb7185'
const SOFT = 'rgba(255,255,255,0.6)'
const SPARK = '#fcd34d'
// Sprite space in cells: body x 0..10, y 0..7, legs below, room around for hops and extras.
const VIEW = { x: -5, y: -6, w: 21, h: 17 }

// Reactions are shared by every buddy on screen, so one that mounts mid-reaction (the approval card
// closes and the panel or pill takes over) carries on with it.
const REACTIONS = {
  celebrate: { ms: 1800, step: 110 },
  alert: { ms: 700, step: 110 },
  allow: { ms: 700, step: 110 },
  deny: { ms: 1300, step: 110 }
}
let reaction = { kind: null, at: 0 }
let lastMood = null
const listeners = new Set()

export function buddyReact(kind) {
  reaction = { kind, at: Date.now() }
  listeners.forEach((f) => f())
}

function noteMood(mood) {
  if (mood === lastMood) return
  const prev = lastMood
  lastMood = mood
  if (prev === null) return
  if (mood === 'done') buddyReact('celebrate')
  else if (mood === 'waiting') buddyReact('alert')
}

function currentReaction() {
  const r = REACTIONS[reaction.kind]
  if (!r) return null
  const age = Date.now() - reaction.at
  if (age >= r.ms) return null
  return { kind: reaction.kind, tick: Math.floor(age / r.step), next: Math.min(r.step, r.ms - age) }
}

// Ticks per mood; idle and done only blink. Every changed frame repaints the whole overlay in software
// (about 15% of a core at this rate), so "working" only moves for a short burst after each hook event.
const MOOD_TICK = { working: 220, waiting: 300, stale: 1200 }
const BURST_MS = 1600

function toolKind(tool) {
  if (!tool) return 'think'
  if (/^(Read|Grep|Glob|LS|WebFetch|WebSearch|NotebookRead)$/.test(tool)) return 'read'
  if (/^(Edit|MultiEdit|Write|NotebookEdit)$/.test(tool)) return 'edit'
  if (/^(Bash|BashOutput|PowerShell)$/.test(tool)) return 'shell'
  return 'think'
}

function pose({ mood, tool, tick, blink, react, look, still }) {
  const p = { dx: 0, dy: 0, eyes: 'open', lx: 0, ly: 0, armL: 'down', armR: 'down', legs: null, extra: null }
  if (react) {
    const t = react.tick
    if (react.kind === 'celebrate') {
      p.dy = [0, -1, -2, -3, -2, -1, 0, 0, -1, -2, -1, 0][t] ?? 0
      p.eyes = 'happy'
      p.armL = p.armR = p.dy < 0 ? 'up' : 'mid'
      p.extra = t % 4 < 2 ? 'spark1' : 'spark2'
    } else if (react.kind === 'alert') {
      p.dy = [0, -2, -3, -2, 0][t] ?? 0
      p.eyes = 'wide'
      p.extra = '!'
    } else if (react.kind === 'allow') {
      p.dy = [0, 1, 0, 1][t] ?? 0
      p.eyes = 'happy'
    } else if (react.kind === 'deny') {
      p.dx = [-1, 1, -1][t] ?? 0
      p.eyes = 'sad'
      p.armL = p.armR = 'low'
    }
    return p
  }
  const kind = mood === 'working' && !still ? toolKind(tool) : null
  if (kind === 'read') {
    p.eyes = 'squint'
    p.lx = [-1, 0, 1, 0][tick % 4]
  } else if (kind === 'edit') {
    p.ly = 1
    p.armL = tick % 2 ? 'mid' : 'down'
    p.armR = tick % 2 ? 'down' : 'mid'
  } else if (kind === 'shell') {
    p.dy = tick % 2 ? -1 : 0
    p.legs = tick % 2
  } else if (kind === 'think') {
    p.legs = tick % 2
    p.lx = [0, 0, 0, 1, 1, 0, 0, -1, -1, 0][tick % 10]
  } else if (mood === 'waiting') {
    p.eyes = 'wide'
    p.extra = '!'
    const c = tick % 10
    if (c < 4) p.armR = c % 2 ? 'mid' : 'up'
  } else if (mood === 'stale') {
    p.eyes = 'closed'
    p.dy = 1
    p.extra = tick % 2 ? 'z2' : 'z1'
  } else if (blink) {
    p.eyes = 'closed'
  }
  if (look && (kind === 'think' || still || mood === 'idle' || mood === 'done') && p.eyes === 'open') {
    p.lx = look.lx
    p.ly = look.ly
  }
  return p
}

// [x, y, w, h] in cells.
function eyeRects(kind, cx, ly) {
  const y = 3 + ly
  switch (kind) {
    case 'wide':
      return [[cx, y - 1, 1, 3]]
    case 'closed':
      return [[cx - 1, 4, 3, 1]]
    case 'squint':
      return [[cx, y + 1, 1, 1]]
    case 'happy':
      return [[cx - 1, 4, 1, 1], [cx, 3, 1, 1], [cx + 1, 4, 1, 1]]
    case 'sad':
      return [[cx - 1, 5, 3, 1]]
    default:
      return [[cx, y, 1, 2]]
  }
}

const ARM_ROWS = { down: 4, mid: 3, low: 5, up: 1 }
function armRects(state, x, tipX) {
  const r = [[x, ARM_ROWS[state], 1, 2]]
  if (state === 'up') r.push([tipX, 0, 1, 2])
  return r
}

const LEGS = [1, 3, 7, 9]
function legRects(legs) {
  return LEGS.map((x, i) => [x, 8, 1, legs !== null && i % 2 === legs ? 1 : 2])
}

const EXTRAS = {
  '!': [ALERT, [[-3, -3, 1, 3], [-3, 1, 1, 1]]],
  z1: [SOFT, [[12, -4, 3, 1], [13, -3, 1, 1], [12, -2, 3, 1]]],
  z2: [SOFT, [[13, -5, 3, 1], [14, -4, 1, 1], [13, -3, 3, 1]]],
  spark1: [SPARK, [[13, -4, 1, 3], [12, -3, 3, 1], [-3, -1, 1, 3], [-4, 0, 3, 1]]],
  spark2: [SPARK, [[14, -5, 1, 1], [-2, -3, 1, 1], [13, 1, 1, 1], [-4, 2, 1, 1]]]
}

const rects = (list, fill, key) =>
  list.map(([x, y, w, h], i) => <rect key={key + i} x={x} y={y} width={w} height={h} fill={fill} />)

// beat: any value that changes on each hook event (the session's updatedAt); restarts the burst.
export function Buddy({ mood = 'idle', tool = null, beat = null, cell = 2, active = true, follow = false }) {
  const [frame, setFrame] = useState(0)
  const [blink, setBlink] = useState(false)
  const [look, setLook] = useState(null)
  const tick = useRef(0)
  const burstAt = useRef(Date.now())
  const ref = useRef(null)
  const react = active ? currentReaction() : null
  const reactKey = react ? react.kind + react.tick : ''
  const still = mood === 'working' && Date.now() - burstAt.current >= BURST_MS
  const ms = still ? 0 : MOOD_TICK[mood]

  useEffect(() => {
    if (active) noteMood(mood)
  }, [mood, active])

  useEffect(() => {
    burstAt.current = Date.now()
    setFrame((n) => n + 1)
  }, [beat, tool, mood])

  useEffect(() => {
    if (!active) return
    const f = () => setFrame((n) => n + 1)
    listeners.add(f)
    return () => listeners.delete(f)
  }, [active])

  // One timer at a time: the next reaction frame, the next mood frame, or the next blink.
  useEffect(() => {
    if (!active) return
    let t
    if (react) t = setTimeout(() => setFrame((n) => n + 1), react.next)
    else if (ms)
      t = setTimeout(() => {
        tick.current++
        setFrame((n) => n + 1)
      }, ms)
    else if (blink) t = setTimeout(() => setBlink(false), 140)
    else t = setTimeout(() => setBlink(true), 3000 + Math.random() * 3000)
    return () => clearTimeout(t)
  }, [active, mood, frame, blink, reactKey, ms])

  // While the island is open the eyes follow the pointer.
  useEffect(() => {
    if (!active || !follow) {
      setLook(null)
      return
    }
    const onMove = (e) => {
      const r = ref.current?.getBoundingClientRect()
      if (!r) return
      const dx = e.clientX - (r.left + r.width / 2)
      const dy = e.clientY - (r.top + r.height / 2)
      const lx = Math.abs(dx) < 30 ? 0 : Math.sign(dx)
      const ly = Math.abs(dy) < 20 ? 0 : Math.sign(dy)
      setLook((l) => (l && l.lx === lx && l.ly === ly ? l : { lx, ly }))
    }
    document.addEventListener('mousemove', onMove)
    return () => document.removeEventListener('mousemove', onMove)
  }, [active, follow])

  const p = active ? pose({ mood, tool, tick: tick.current, blink, react, look, still }) : pose({ mood: 'idle' })
  const extra = p.extra && EXTRAS[p.extra]
  return (
    <svg
      ref={ref}
      width={VIEW.w * cell}
      height={VIEW.h * cell}
      viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
      shapeRendering="crispEdges"
      className="shrink-0"
      aria-hidden="true"
    >
      <g transform={`translate(${p.dx} ${p.dy})`}>
        {rects([[0, 0, 11, 8], ...armRects(p.armL, -1, -2), ...armRects(p.armR, 11, 12), ...legRects(p.legs)], ORANGE, 'b')}
        {rects([...eyeRects(p.eyes, 3 + p.lx, p.ly), ...eyeRects(p.eyes, 7 + p.lx, p.ly)], '#000', 'e')}
        {extra && rects(extra[1], extra[0], 'x')}
      </g>
    </svg>
  )
}
