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
// `first` makes it the top of a page: its title is the page's h1, it clears the floating nav, and it
// plays its entrance right away instead of on scroll.
export default function Section({ id, eyebrow, title, intro, first = false, children, className = '' }) {
  const enter = first ? { onMount: true } : {}
  return (
    <section
      id={id}
      className={`relative px-5 sm:px-8 ${first ? 'pt-36 pb-24 md:pt-44 md:pb-32' : 'py-24 md:py-36'} ${className}`}
    >
      <div className="mx-auto max-w-6xl">
        {(eyebrow || title || intro) && (
          <header className="mb-14 max-w-3xl md:mb-20">
            {eyebrow && (
              <Reveal {...enter}>
                <Eyebrow className="mb-5">{eyebrow}</Eyebrow>
              </Reveal>
            )}
            {title && (
              <Reveal {...enter} delay={first ? 0.05 : 0} as={first ? 'h1' : 'h2'} className="text-headline text-balance">
                {title}
              </Reveal>
            )}
            {intro && (
              <Reveal {...enter} as="p" delay={first ? 0.1 : 0.08} className="text-lead mt-6 max-w-[60ch] text-pretty text-muted">
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
