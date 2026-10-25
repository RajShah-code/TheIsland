import { ArrowUpRight } from '@phosphor-icons/react'
import { site } from '../content/site.js'
import PageHeader from '../components/ui/PageHeader.jsx'
import Reveal from '../components/ui/Reveal.jsx'

// The privacy policy. Its text lives in content/site.js; keep it in step with what the app actually does.
export default function Privacy() {
  const { privacy } = site
  return (
    <>
      <PageHeader eyebrow={`Last updated ${privacy.updated}`} title={privacy.title} intro={privacy.intro} />
      <section className="px-5 pt-16 pb-24 sm:px-8 md:pb-32">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl space-y-12">
            {privacy.sections.map((section) => (
              <Reveal as="section" key={section.title} className="border-t border-line pt-8">
                <h2 className="text-[1.25rem] font-semibold tracking-[-0.025em]">{section.title}</h2>
                <ul className="mt-5 space-y-3">
                  {section.items.map((item) => (
                    <li key={item} className="flex gap-3 text-[0.9375rem] leading-relaxed text-pretty text-muted">
                      <span className="mt-[0.6em] size-1 shrink-0 rounded-full bg-subtle" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </Reveal>
            ))}
            <Reveal as="ul" className="flex flex-wrap gap-x-6 gap-y-3 border-t border-line pt-8 text-sm">
              {privacy.links.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="group inline-flex items-center gap-1 text-muted transition-colors duration-200 hover:text-fg"
                  >
                    {link.label}
                    <ArrowUpRight size={13} className="transition-transform duration-300 ease-out-strong group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </a>
                </li>
              ))}
            </Reveal>
          </div>
        </div>
      </section>
    </>
  )
}
