import {
  CalendarBlank,
  ChatCircleText,
  CornersOut,
  Gauge,
  MusicNotes,
  ShieldCheck,
  TreeStructure,
} from '@phosphor-icons/react'
import { site } from '../../content/site.js'
import Reveal from '../ui/Reveal.jsx'
import Section from '../ui/Section.jsx'

const icons = {
  approvals: ShieldCheck,
  questions: ChatCircleText,
  sessions: TreeStructure,
  music: MusicNotes,
  calendar: CalendarBlank,
  system: Gauge,
  fullscreen: CornersOut,
}

// Bento layout on large screens (6 columns): the lead card takes 4 columns and 2 rows, the next two
// stack beside it, three share a row, and the last runs the full width.
const spans = {
  approvals: 'lg:col-span-4 lg:row-span-2',
  questions: 'lg:col-span-2',
  sessions: 'lg:col-span-2',
  music: 'lg:col-span-2',
  calendar: 'lg:col-span-2',
  system: 'lg:col-span-2',
  fullscreen: 'sm:col-span-2 lg:col-span-6',
}

// What the island shows for each kind of request: the real thing, never a summary.
const examples = [
  { tool: 'Bash', detail: 'npm run build', note: 'the exact command' },
  { tool: 'Edit', detail: 'src/App.jsx', note: 'the lines removed and added' },
  { tool: 'Write', detail: 'docs/setup.md', note: 'the whole new file' },
  { tool: 'WebFetch', detail: 'docs.example.com/api', note: 'the address' },
]

function LeadVisual() {
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

function Card({ item, index }) {
  const Icon = icons[item.id]
  const wide = item.id === 'fullscreen'
  return (
    <Reveal delay={(index % 3) * 0.06} className={`bezel ${spans[item.id]}`}>
      <div className={`bezel-core flex h-full flex-col p-7 md:p-8 ${wide ? 'lg:flex-row lg:items-center lg:gap-10' : ''}`}>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-inset ring-line">
          <Icon size={20} weight="light" />
        </span>
        <div className={wide ? 'mt-6 lg:mt-0' : 'mt-6'}>
          <h3 className={item.lead ? 'text-title' : 'text-[1.125rem] font-semibold tracking-[-0.02em]'}>{item.title}</h3>
          <p className={`mt-3 text-pretty text-muted ${item.lead ? 'text-lead max-w-[52ch]' : 'text-[0.9375rem] leading-relaxed'}`}>
            {item.text}
          </p>
        </div>
        {item.lead && <LeadVisual />}
      </div>
    </Reveal>
  )
}

export default function Features() {
  const { features } = site
  return (
    <Section id="features" eyebrow={features.eyebrow} title={features.title}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {features.items.map((item, i) => (
          <Card key={item.id} item={item} index={i} />
        ))}
      </div>
    </Section>
  )
}
