import { site } from '../content/site.js'
import PageHeader from '../components/ui/PageHeader.jsx'
import Reveal from '../components/ui/Reveal.jsx'

// The MIT license: a plain-language summary, then the exact text (the same as LICENSE in the repository).
export default function License() {
  const { license } = site
  return (
    <>
      <PageHeader eyebrow={license.eyebrow} title={license.title} intro={license.intro}>
        <div className="mt-12 grid gap-4 md:mt-16 md:grid-cols-3">
          {license.summary.map((group, i) => (
            <Reveal key={group.title} onMount delay={0.15 + i * 0.05} className="rounded-[2rem] p-7 ring-1 ring-inset ring-line">
              <h2 className="text-eyebrow text-subtle">{group.title}</h2>
              <ul className="mt-5 space-y-2.5">
                {group.items.map((item) => (
                  <li key={item} className="text-[0.9375rem]">
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </PageHeader>
      <section className="px-5 py-24 sm:px-8 md:py-32">
        <div className="mx-auto max-w-6xl">
          <Reveal as="h2" className="text-title">
            {license.fullTitle}
          </Reveal>
          <Reveal className="bezel mt-8">
            <pre className="bezel-core overflow-x-auto p-7 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-white/80 md:p-9">
              {license.text}
            </pre>
          </Reveal>
          <Reveal as="p" className="mt-8 max-w-[60ch] text-[0.9375rem] leading-relaxed text-muted">
            {license.thirdParty}
          </Reveal>
        </div>
      </section>
    </>
  )
}
