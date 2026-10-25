import Reveal from './Reveal.jsx'
import { Eyebrow } from './Section.jsx'

// The top of an inner page: eyebrow, the page's h1 and an intro, clear of the floating nav.
// Anything passed as children sits under the intro (for example the Download card).
export default function PageHeader({ eyebrow, title, intro, children }) {
  return (
    <section className="relative px-5 pt-36 sm:px-8 md:pt-44">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[60vh] bg-[radial-gradient(ellipse_60%_55%_at_50%_0%,rgb(255_255_255/0.06),transparent_70%)]"
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-6xl">
        <header className="max-w-3xl">
          {eyebrow && (
            <Reveal onMount y={12}>
              <Eyebrow className="mb-5">{eyebrow}</Eyebrow>
            </Reveal>
          )}
          <Reveal onMount delay={0.05} as="h1" className="text-headline text-balance">
            {title}
          </Reveal>
          {intro && (
            <Reveal onMount delay={0.1} as="p" className="text-lead mt-6 max-w-[60ch] text-pretty text-muted">
              {intro}
            </Reveal>
          )}
        </header>
        {children}
      </div>
    </section>
  )
}
