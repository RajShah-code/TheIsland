import { site } from '../../content/site.js'
import Reveal from '../ui/Reveal.jsx'
import { Eyebrow } from '../ui/Section.jsx'

// Two columns: the problem in one line on the left, the explanation on the right.
export default function Problem() {
  const { problem } = site
  return (
    <section className="px-5 py-24 sm:px-8 md:py-36">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-16">
        <div>
          <Reveal>
            <Eyebrow className="mb-5">{problem.eyebrow}</Eyebrow>
          </Reveal>
          <Reveal as="h2" className="text-headline text-balance">
            {problem.title}
          </Reveal>
        </div>
        <div className="space-y-6 md:pt-11">
          {problem.body.map((text, i) => (
            <Reveal key={i} as="p" delay={0.06 * i} className="text-lead text-pretty text-muted">
              {text}
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
