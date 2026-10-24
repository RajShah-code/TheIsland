import { useId, useState } from 'react'
import { AnimatePresence, m } from 'motion/react'
import { Plus } from '@phosphor-icons/react'
import { site } from '../../content/site.js'
import { easeOut } from '../../lib/motion.js'
import Reveal from '../ui/Reveal.jsx'
import { Eyebrow } from '../ui/Section.jsx'

function Item({ q, a, open, onToggle }) {
  const id = useId()
  return (
    <div className="border-b border-line">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-6 py-6 text-left text-[1.0625rem] font-medium tracking-[-0.015em] transition-colors duration-200 hover:text-white"
        >
          {q}
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
            <p className="max-w-[60ch] pb-6 text-[0.9375rem] leading-relaxed text-pretty text-muted">{a}</p>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function Faq() {
  const { faq } = site
  const [open, setOpen] = useState(0)
  return (
    <section id="faq" className="px-5 py-24 sm:px-8 md:py-36">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-16">
        <div>
          <Reveal>
            <Eyebrow className="mb-5">{faq.eyebrow}</Eyebrow>
          </Reveal>
          <Reveal as="h2" className="text-headline text-balance">
            {faq.title}
          </Reveal>
        </div>
        <Reveal className="border-t border-line">
          {faq.items.map((item, i) => (
            <Item key={item.q} {...item} open={open === i} onToggle={() => setOpen(open === i ? -1 : i)} />
          ))}
        </Reveal>
      </div>
    </section>
  )
}
