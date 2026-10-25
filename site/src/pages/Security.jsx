import { LockSimple } from '@phosphor-icons/react'
import { site } from '../content/site.js'
import Button from '../components/ui/Button.jsx'
import PageHeader from '../components/ui/PageHeader.jsx'
import Reveal from '../components/ui/Reveal.jsx'
import Section from '../components/ui/Section.jsx'
import Trust from '../components/sections/Trust.jsx'

export default function Security() {
  const { security } = site
  return (
    <>
      <PageHeader eyebrow={security.eyebrow} title={security.title} intro={security.intro}>
        <Reveal onMount delay={0.15} className="bezel mt-12 md:mt-16">
          <div className="bezel-core flex flex-col gap-6 p-7 md:flex-row md:items-center md:gap-10 md:p-9">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] ring-1 ring-inset ring-line">
              <LockSimple size={24} weight="light" />
            </span>
            <div className="min-w-0">
              <h2 className="text-title">{security.reportTitle}</h2>
              <p className="mt-3 max-w-[60ch] text-[0.9375rem] leading-relaxed text-pretty text-muted">{security.reportText}</p>
            </div>
            <div className="md:ml-auto">
              <Button href={security.report.href} icon="external" target="_blank" rel="noreferrer">
                {security.report.label}
              </Button>
            </div>
          </div>
        </Reveal>
      </PageHeader>
      <Trust />
      <Section className="pt-0 md:pt-0">
        <div className="grid gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-16">
          <Reveal as="h2" className="text-headline text-balance">
            {security.countsTitle}
          </Reveal>
          <Reveal as="ul" className="space-y-4 border-t border-line pt-8">
            {security.counts.map((item) => (
              <li key={item} className="flex gap-3 text-[0.9375rem] leading-relaxed text-pretty text-muted">
                <span className="mt-[0.6em] size-1 shrink-0 rounded-full bg-subtle" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </Reveal>
        </div>
      </Section>
    </>
  )
}
