import { ArrowUpRight } from '@phosphor-icons/react'
import PageHeader from './PageHeader.jsx'
import Reveal from './Reveal.jsx'

// A policy page (privacy, terms, refunds, delivery): a dated header, titled sections of points, then links.
// Its text lives in content/site.js. Links to other sites open in a new tab; links within the site don't.
export default function Policy({ policy, children }) {
  return (
    <>
      <PageHeader eyebrow={`Last updated ${policy.updated}`} title={policy.title} intro={policy.intro} />
      <section className="px-5 pt-16 pb-24 sm:px-8 md:pb-32">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl space-y-12">
            {children}
            {policy.sections.map((section) => (
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
            {policy.links?.length > 0 && (
              <Reveal as="ul" className="flex flex-wrap gap-x-6 gap-y-3 border-t border-line pt-8 text-sm">
                {policy.links.map((link) => {
                  const external = /^https?:/.test(link.href)
                  return (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
                        className="group inline-flex items-center gap-1 text-muted transition-colors duration-200 hover:text-fg"
                      >
                        {link.label}
                        {external && (
                          <ArrowUpRight size={13} className="transition-transform duration-300 ease-out-strong group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        )}
                      </a>
                    </li>
                  )
                })}
              </Reveal>
            )}
          </div>
        </div>
      </section>
    </>
  )
}
