import {
  CalendarBlank,
  ChatCircleText,
  CornersOut,
  Gauge,
  MusicNotes,
  ShieldCheck,
  SlidersHorizontal,
  TreeStructure,
} from '@phosphor-icons/react'
import { site } from '../../content/site.js'
import Reveal from '../ui/Reveal.jsx'
import Section from '../ui/Section.jsx'

const icons = {
  music: MusicNotes,
  calendar: CalendarBlank,
  system: Gauge,
  fullscreen: CornersOut,
  arrange: SlidersHorizontal,
  approvals: ShieldCheck,
  questions: ChatCircleText,
  sessions: TreeStructure,
}

// Bento layout on large screens (6 columns): the lead card takes 4 columns and 2 rows with two cards
// stacked beside it; any further cards share the row below.
const spans = {
  music: 'lg:col-span-4 lg:row-span-2',
  calendar: 'lg:col-span-2',
  system: 'lg:col-span-2',
  fullscreen: 'lg:col-span-3',
  arrange: 'lg:col-span-3',
  approvals: 'lg:col-span-4 lg:row-span-2',
  questions: 'lg:col-span-2',
  sessions: 'lg:col-span-2',
}

// Music: a small now-playing bar and the kinds of players it works with.
const players = ['Spotify', 'YouTube in a browser', 'Apple Music', 'VLC', 'Any app in Windows’ media controls']

function MusicVisual() {
  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center gap-4 rounded-2xl bg-black p-3.5 ring-1 ring-white/[0.07]">
        <span
          className="size-12 shrink-0 rounded-xl bg-[radial-gradient(circle_at_30%_25%,#f0abfc,transparent_55%),radial-gradient(circle_at_75%_80%,#60a5fa,transparent_60%),#1e1b4b]"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold">Night Drive</p>
          <p className="truncate text-[12px] text-subtle">Lumen</p>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/15">
            <div className="h-full w-[38%] rounded-full bg-white/80" />
          </div>
        </div>
      </div>
      <ul className="flex flex-wrap gap-2" aria-label="Works with">
        {players.map((p) => (
          <li key={p} className="rounded-full bg-white/[0.05] px-3 py-1 text-[12px] text-muted ring-1 ring-inset ring-line">
            {p}
          </li>
        ))}
      </ul>
    </div>
  )
}

// Approvals: what the island shows for each kind of request, the real thing rather than a summary.
const examples = [
  { tool: 'Bash', detail: 'npm run build', note: 'the exact command' },
  { tool: 'Edit', detail: 'src/App.jsx', note: 'the lines removed and added' },
  { tool: 'Write', detail: 'docs/setup.md', note: 'the whole new file' },
  { tool: 'WebFetch', detail: 'docs.example.com/api', note: 'the address' },
]

function ApprovalsVisual() {
  return (
    <div className="mt-8 overflow-hidden rounded-2xl bg-black ring-1 ring-white/[0.07]">
      {examples.map((e, i) => (
        <div
          key={e.tool}
          className={`flex items-center gap-3 px-4 py-3 text-[13px] ${i > 0 ? 'border-t border-white/[0.06]' : ''}`}
        >
          <span className="w-[4.5rem] shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-center font-mono text-[11px]">{e.tool}</span>
          <span className="min-w-0 truncate font-mono text-[12px] text-white/85">{e.detail}</span>
          <span className="ml-auto hidden shrink-0 text-[12px] text-subtle sm:inline">{e.note}</span>
        </div>
      ))}
    </div>
  )
}

const visuals = { music: MusicVisual, approvals: ApprovalsVisual }

function Card({ item, index }) {
  const Icon = icons[item.id]
  const Visual = visuals[item.id]
  return (
    <Reveal delay={(index % 3) * 0.06} className={`bezel ${spans[item.id]}`}>
      <div className="bezel-core flex h-full flex-col p-7 md:p-8">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-inset ring-line">
          <Icon size={20} weight="light" />
        </span>
        <h3 className={`mt-6 ${item.lead ? 'text-title' : 'text-[1.125rem] font-semibold tracking-[-0.02em]'}`}>{item.title}</h3>
        <p className={`mt-3 text-pretty text-muted ${item.lead ? 'text-lead max-w-[52ch]' : 'text-[0.9375rem] leading-relaxed'}`}>
          {item.text}
        </p>
        {Visual && <Visual />}
      </div>
    </Reveal>
  )
}

function FeatureSection({ data }) {
  return (
    <Section id={data.id} eyebrow={data.eyebrow} title={data.title} intro={data.intro}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {data.items.map((item, i) => (
          <Card key={item.id} item={item} index={i} />
        ))}
      </div>
    </Section>
  )
}

export function Everyday() {
  return <FeatureSection data={site.everyday} />
}

export function Developers() {
  return <FeatureSection data={site.developers} />
}
