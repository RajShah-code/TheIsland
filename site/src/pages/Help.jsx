import { useId, useState } from 'react'
import { AnimatePresence, m } from 'motion/react'
import { Plus } from '@phosphor-icons/react'
import { site } from '../content/site.js'
import { easeOut } from '../lib/motion.js'
import PageHeader from '../components/ui/PageHeader.jsx'
import Reveal from '../components/ui/Reveal.jsx'
import Section from '../components/ui/Section.jsx'
import Faq from '../components/sections/Faq.jsx'
import Feedback from '../components/sections/Feedback.jsx'

// One guide: a title that opens to numbered steps, like the FAQ answers.
function Guide({ guide, open, onToggle }) {
  const id = useId()
  return (
    <div id={guide.id} className="scroll-mt-28 border-b border-line">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-6 py-6 text-left text-[1.0625rem] font-medium tracking-[-0.015em] transition-colors duration-200 hover:text-white"
        >
          {guide.title}
          <Plus
            size={18}
            weight="light"
            className={`shrink-0 text-muted transition-transform duration-300 ease-out-strong ${open ? 'rotate-45' : ''}`}
            aria-hidden="true"
          />
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open && (
          <m.div
            id={id}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: easeOut }}
            className="overflow-hidden"
          >
            <ol className="space-y-3 pb-4">
              {guide.steps.map((step, i) => (
                <li key={i} className="flex gap-4 text-[0.9375rem] leading-relaxed text-muted">
                  <span className="w-5 shrink-0 font-mono text-sm text-subtle">{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-pretty">{step}</span>
                </li>
              ))}
            </ol>
            {guide.note && <p className="max-w-[60ch] pb-6 pl-9 text-sm leading-relaxed text-subtle">{guide.note}</p>}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Guides() {
  const { help } = site
  // A link like help.html#claude-code opens that guide.
  const [open, setOpen] = useState(() => {
    const hash = window.location.hash.slice(1)
    return Math.max(0, help.guides.findIndex((g) => g.id === hash))
  })
  return (
    <Section id="guides" className="pt-0 md:pt-0">
      <div className="grid gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-16">
        <Reveal as="h2" className="text-headline">
          {help.guidesTitle}
        </Reveal>
        <Reveal className="border-t border-line">
          {help.guides.map((guide, i) => (
            <Guide key={guide.id} guide={guide} open={open === i} onToggle={() => setOpen(open === i ? -1 : i)} />
          ))}
        </Reveal>
      </div>
    </Section>
  )
}

export default function Help() {
  const { help } = site
  return (
    <>
      <PageHeader eyebrow={help.eyebrow} title={help.title} intro={help.intro} />
      <Faq />
      <Guides />
      <Feedback />
    </>
  )
}
