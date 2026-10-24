import Reveal from './Reveal.jsx'

// Small mono uppercase label with a dot, above section titles.
export function Eyebrow({ children, className = '' }) {
  return (
    <p className={`text-eyebrow flex items-center gap-2.5 text-subtle ${className}`}>
      <span className="size-1 rounded-full bg-muted" aria-hidden="true" />
      {children}
    </p>
  )
}

// Shared section frame with an optional header (eyebrow, title, intro).
export default function Section({ id, eyebrow, title, intro, children, className = '' }) {
  return (
    <section id={id} className={`relative px-5 py-24 sm:px-8 md:py-36 ${className}`}>
      <div className="mx-auto max-w-6xl">
        {(eyebrow || title || intro) && (
          <header className="mb-14 max-w-3xl md:mb-20">
            {eyebrow && (
              <Reveal>
                <Eyebrow className="mb-5">{eyebrow}</Eyebrow>
              </Reveal>
            )}
            {title && (
              <Reveal as="h2" className="text-headline text-balance">
                {title}
              </Reveal>
            )}
            {intro && (
              <Reveal as="p" delay={0.08} className="text-lead mt-6 max-w-[60ch] text-pretty text-muted">
                {intro}
              </Reveal>
            )}
          </header>
        )}
        {children}
      </div>
    </section>
  )
}
