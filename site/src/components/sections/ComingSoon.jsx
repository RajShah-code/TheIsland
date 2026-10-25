import { CloudSun, GithubLogo, Timer } from '@phosphor-icons/react'
import { site } from '../../content/site.js'
import Button from '../ui/Button.jsx'
import Reveal from '../ui/Reveal.jsx'
import Section from '../ui/Section.jsx'

const icons = { weather: CloudSun, focus: Timer, github: GithubLogo }

// Planned widgets, quieter than the shipped ones: dashed cards with a "Planned" label.
export default function ComingSoon() {
  const { comingSoon } = site
  return (
    <Section eyebrow={comingSoon.eyebrow} title={comingSoon.title} intro={comingSoon.intro}>
      <div className="grid gap-4 md:grid-cols-3">
        {comingSoon.items.map((item, i) => {
          const Icon = icons[item.id]
          return (
            <Reveal key={item.id} delay={i * 0.06} className="rounded-[2rem] border border-dashed border-line-strong p-7 md:p-8">
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-full bg-white/[0.04] text-muted ring-1 ring-inset ring-line">
                  {Icon && <Icon size={20} weight="light" />}
                </span>
                <span className="text-eyebrow text-subtle">Planned</span>
              </div>
              <h3 className="mt-6 text-[1.125rem] font-semibold tracking-[-0.02em]">{item.title}</h3>
              <p className="mt-3 text-[0.9375rem] leading-relaxed text-pretty text-muted">{item.text}</p>
            </Reveal>
          )
        })}
      </div>
      <Reveal className="mt-10">
        <Button href={comingSoon.cta.href} variant="secondary" icon="external" target="_blank" rel="noreferrer">
          {comingSoon.cta.label}
        </Button>
      </Reveal>
    </Section>
  )
}
