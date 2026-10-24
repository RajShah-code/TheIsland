import { site } from '../../content/site.js'
import Reveal from '../ui/Reveal.jsx'

// Four short facts under the hero, as on the EduSync site.
export default function Facts() {
  return (
    <section className="px-5 sm:px-8">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-x-8 gap-y-8 border-t border-line pt-10 sm:grid-cols-2 lg:grid-cols-4">
        {site.facts.map((fact, i) => (
          <Reveal key={fact.title} delay={i * 0.06}>
            <h3 className="text-[1.0625rem] font-semibold tracking-[-0.02em]">{fact.title}</h3>
            <p className="mt-2 max-w-[28ch] text-[0.9375rem] leading-relaxed text-muted">{fact.text}</p>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
