import { ArrowRight, Check, Code, SunHorizon } from '@phosphor-icons/react'
import { site } from '../../content/site.js'
import Reveal from '../ui/Reveal.jsx'
import Section from '../ui/Section.jsx'

const icons = { everyday: SunHorizon, developers: Code }

function TextLink({ href, children }) {
  return (
    <a href={href} className="group inline-flex items-center gap-1.5 text-[0.9375rem] font-medium text-fg">
      {children}
      <ArrowRight size={15} className="transition-transform duration-300 ease-out-strong group-hover:translate-x-0.5" />
    </a>
  )
}

// "What it does": one card for everyday use, one for developers, each leading to the Features page.
export function Highlights() {
  const { highlights } = site.home
  return (
    <Section eyebrow={highlights.eyebrow} title={highlights.title}>
      <div className="grid gap-4 md:grid-cols-2">
        {highlights.items.map((item, i) => {
          const Icon = icons[item.id]
          return (
            <Reveal key={item.id} delay={i * 0.06} className="bezel">
              <div className="bezel-core flex h-full flex-col p-7 md:p-9">
                <span className="flex size-10 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-inset ring-line">
                  <Icon size={20} weight="light" />
                </span>
                <h3 className="text-title mt-6">{item.title}</h3>
                <p className="mt-3 max-w-[44ch] text-[0.9375rem] leading-relaxed text-pretty text-muted">{item.text}</p>
                <ul className="mt-6 space-y-2.5">
                  {item.points.map((point) => (
                    <li key={point} className="flex items-center gap-2.5 text-[0.9375rem]">
                      <Check size={14} weight="bold" className="shrink-0 text-subtle" />
                      {point}
                    </li>
                  ))}
                </ul>
                <div className="mt-8 md:mt-auto md:pt-8">
                  <TextLink href={item.link.href}>{item.link.label}</TextLink>
                </div>
              </div>
            </Reveal>
          )
        })}
      </div>
    </Section>
  )
}

// A short privacy summary on the home page, leading to the Privacy and Security pages.
export function PrivacyTeaser() {
  const { privacy } = site.home
  return (
    <Section eyebrow={privacy.eyebrow} title={privacy.title}>
      <div className="grid gap-x-8 gap-y-8 border-t border-line pt-10 sm:grid-cols-3">
        {privacy.points.map((point, i) => (
          <Reveal key={point.title} delay={i * 0.06}>
            <h3 className="text-[1.0625rem] font-semibold tracking-[-0.02em]">{point.title}</h3>
            <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">{point.text}</p>
          </Reveal>
        ))}
      </div>
      <Reveal className="mt-10 flex flex-wrap gap-x-8 gap-y-3">
        {privacy.links.map((link) => (
          <TextLink key={link.href} href={link.href}>
            {link.label}
          </TextLink>
        ))}
      </Reveal>
    </Section>
  )
}
