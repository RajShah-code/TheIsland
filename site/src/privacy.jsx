import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LazyMotion, MotionConfig } from 'motion/react'
import { ArrowLeft, ArrowUpRight } from '@phosphor-icons/react'
import { site } from './content/site.js'
import { IslandMark } from './components/ui/Marks.jsx'
import Reveal from './components/ui/Reveal.jsx'
import { Eyebrow } from './components/ui/Section.jsx'
import Footer from './components/sections/Footer.jsx'
import './index.css'

const loadMotionFeatures = () => import('./lib/motionFeatures.js').then((module) => module.default)

// The privacy policy, a second page of the site (privacy.html). Its text lives in content/site.js.
function Privacy() {
  const { privacy } = site
  return (
    <>
      <header id="top" className="px-5 pt-6 sm:px-8">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <a href="./" className="flex items-center gap-2.5 font-semibold tracking-[-0.02em]">
            <IslandMark className="size-6" />
            {site.name}
          </a>
          <a
            href="./"
            className="group flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-muted transition-colors duration-200 hover:text-fg"
          >
            <ArrowLeft size={14} className="transition-transform duration-300 ease-out-strong group-hover:-translate-x-0.5" />
            Back to TheIsland
          </a>
        </div>
      </header>

      <main className="px-5 pt-20 pb-24 sm:px-8 md:pt-28">
        <article className="mx-auto max-w-3xl">
          <Reveal onMount>
            <Eyebrow className="mb-5">Last updated {privacy.updated}</Eyebrow>
          </Reveal>
          <Reveal onMount delay={0.05} as="h1" className="text-headline">
            {privacy.title}
          </Reveal>
          <Reveal onMount delay={0.1} as="p" className="text-lead mt-6 text-pretty text-muted">
            {privacy.intro}
          </Reveal>

          <div className="mt-16 space-y-12">
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
          </div>

          <Reveal as="ul" className="mt-14 flex flex-wrap gap-x-6 gap-y-3 border-t border-line pt-8 text-sm">
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
        </article>
      </main>

      <Footer />
    </>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LazyMotion features={loadMotionFeatures} strict>
      <MotionConfig reducedMotion="user">
        <Privacy />
      </MotionConfig>
    </LazyMotion>
  </StrictMode>,
)
