import { site } from '../../content/site.js'
import Reveal from '../ui/Reveal.jsx'
import Section from '../ui/Section.jsx'

// Setup is a real sequence, so the steps are numbered.
export default function Steps() {
  const { steps } = site
  return (
    <Section eyebrow={steps.eyebrow} title={steps.title}>
      <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
        {steps.items.map((step, i) => (
          <Reveal as="li" key={step.title} delay={i * 0.08} className="border-t border-line-strong pt-6">
            <span className="font-mono text-sm text-subtle">{String(i + 1).padStart(2, '0')}</span>
            <h3 className="mt-5 text-[1.25rem] font-semibold tracking-[-0.025em]">{step.title}</h3>
            <p className="mt-3 max-w-[34ch] text-[0.9375rem] leading-relaxed text-pretty text-muted">{step.text}</p>
          </Reveal>
        ))}
      </ol>
    </Section>
  )
}
