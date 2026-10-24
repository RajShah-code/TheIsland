import { Fragment } from 'react'
import { m, useReducedMotion } from 'motion/react'
import { site } from '../../content/site.js'
import { useLatestRelease } from '../../lib/release.js'
import { easeOut } from '../../lib/motion.js'
import Button from '../ui/Button.jsx'
import Reveal from '../ui/Reveal.jsx'
import { Eyebrow } from '../ui/Section.jsx'
import IslandDemo from '../demo/IslandDemo.jsx'

// Headline words rise out of a mask, one after another (as on the Archway site).
function MaskedHeadline({ text }) {
  const reduce = useReducedMotion()
  const words = text.split(' ')

  return (
    <h1 className="text-display max-w-[15ch] text-balance">
      {/* The space goes between the masks: inside an inline-block a trailing space is dropped. */}
      {words.map((word, index) => (
        <Fragment key={`${word}-${index}`}>
          <span className="inline-block overflow-hidden pb-[0.08em] align-bottom">
            <m.span
              className="inline-block"
              initial={reduce ? { opacity: 0 } : { transform: 'translateY(105%)' }}
              animate={reduce ? { opacity: 1 } : { transform: 'translateY(0%)' }}
              transition={{ duration: 1, delay: 0.2 + index * 0.06, ease: easeOut }}
            >
              {word}
            </m.span>
          </span>
          {index < words.length - 1 && ' '}
        </Fragment>
      ))}
    </h1>
  )
}

export default function Hero() {
  const { hero } = site
  const release = useLatestRelease()
  const headlineEnd = 0.2 + hero.tagline.split(' ').length * 0.06
  const meta = [release.version && `Version ${release.version}`, release.sizeMB && `${release.sizeMB} MB`, 'Windows 11, 64-bit', 'Free and open source']

  return (
    <section id="top" className="relative overflow-hidden px-5 pt-32 pb-24 sm:px-8 md:pt-40 md:pb-36">
      {/* Soft overhead light */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[70vh] bg-[radial-gradient(ellipse_60%_55%_at_50%_0%,rgb(255_255_255/0.07),transparent_70%)]"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-6xl">
        <Reveal onMount delay={0.1} y={12}>
          <Eyebrow className="mb-7">{hero.eyebrow}</Eyebrow>
        </Reveal>

        <MaskedHeadline text={hero.tagline} />

        <Reveal onMount delay={headlineEnd} as="p" className="text-lead mt-8 max-w-[36rem] text-pretty text-muted">
          {hero.statement}
        </Reveal>

        <Reveal onMount delay={headlineEnd + 0.1} className="mt-11 flex flex-wrap gap-3">
          <Button href={release.url} icon="download">
            Download for Windows
          </Button>
          <Button href={hero.secondary.href} variant="secondary" icon="external" target="_blank" rel="noreferrer">
            {hero.secondary.label}
          </Button>
        </Reveal>

        <Reveal onMount delay={headlineEnd + 0.16} as="p" className="mt-5 font-mono text-xs text-subtle">
          {meta.filter(Boolean).join('  ·  ')}
        </Reveal>

        <Reveal onMount delay={headlineEnd + 0.25} y={40} className="mt-16 md:mt-24">
          <IslandDemo />
        </Reveal>
      </div>
    </section>
  )
}
