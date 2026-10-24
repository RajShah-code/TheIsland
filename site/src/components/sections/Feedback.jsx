import { Bug, Lightbulb, LockSimple } from '@phosphor-icons/react'
import { site } from '../../content/site.js'
import Button from '../ui/Button.jsx'
import Reveal from '../ui/Reveal.jsx'
import Section from '../ui/Section.jsx'

const icons = [Bug, Lightbulb]

// Bugs and ideas go to GitHub issues (the repo's own templates); security problems go to a private report.
export default function Feedback() {
  const { feedback } = site
  return (
    <Section id="feedback" eyebrow={feedback.eyebrow} title={feedback.title} intro={feedback.intro}>
      <div className="grid gap-4 md:grid-cols-2">
        {feedback.items.map((item, i) => {
          const Icon = icons[i]
          return (
            <Reveal key={item.title} delay={i * 0.06} className="bezel">
              <div className="bezel-core flex h-full flex-col p-7 md:p-9">
                <span className="flex size-10 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-inset ring-line">
                  <Icon size={20} weight="light" />
                </span>
                <h3 className="text-title mt-6">{item.title}</h3>
                <p className="mt-3 max-w-[40ch] text-[0.9375rem] leading-relaxed text-pretty text-muted">{item.text}</p>
                <div className="mt-8 pt-2 md:mt-auto">
                  <Button href={item.href} variant={i === 0 ? 'primary' : 'secondary'} icon="external" target="_blank" rel="noreferrer">
                    {item.cta}
                  </Button>
                </div>
              </div>
            </Reveal>
          )
        })}
      </div>
      <Reveal className="mt-8 flex flex-col gap-3 rounded-2xl px-1 text-[0.9375rem] text-muted sm:flex-row sm:items-center">
        <LockSimple size={18} weight="light" className="shrink-0 text-subtle" aria-hidden="true" />
        <p className="text-pretty">{feedback.security.text}</p>
        <a
          href={feedback.security.href}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-fg underline decoration-line-strong underline-offset-4 transition-colors duration-200 hover:decoration-fg sm:ml-auto sm:shrink-0"
        >
          {feedback.security.cta}
        </a>
      </Reveal>
    </Section>
  )
}
