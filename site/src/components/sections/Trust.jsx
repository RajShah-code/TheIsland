import { site } from '../../content/site.js'
import Reveal from '../ui/Reveal.jsx'
import Section from '../ui/Section.jsx'

// Five cards: three on the first row, two wider ones on the second.
const spans = ['md:col-span-2', 'md:col-span-2', 'md:col-span-2', 'md:col-span-3', 'md:col-span-3']

export default function Trust() {
  const { trust } = site
  return (
    <Section id="privacy" eyebrow={trust.eyebrow} title={trust.title} intro={trust.intro}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
        {trust.items.map((item, i) => (
          <Reveal key={item.title} delay={(i % 3) * 0.06} className={`bezel ${spans[i]}`}>
            <div className="bezel-core h-full p-7 md:p-8">
              <h3 className="text-[1.125rem] font-semibold tracking-[-0.02em]">{item.title}</h3>
              <p className="mt-3 text-[0.9375rem] leading-relaxed text-pretty text-muted">{item.text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}
