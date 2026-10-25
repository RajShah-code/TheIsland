import { site } from '../../content/site.js'
import { useLatestRelease } from '../../lib/release.js'
import { pageHref } from '../../lib/pages.js'
import Button from '../ui/Button.jsx'
import Reveal from '../ui/Reveal.jsx'

// A closing call to action: download, or see how to support it.
export default function CtaBand() {
  const release = useLatestRelease()
  const { cta } = site.home
  return (
    <section className="px-5 py-24 sm:px-8 md:py-32">
      <Reveal className="bezel mx-auto max-w-6xl">
        <div className="bezel-core relative overflow-hidden px-7 py-14 text-center md:py-20">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(ellipse_50%_80%_at_50%_0%,rgb(255_255_255/0.08),transparent_70%)]"
            aria-hidden="true"
          />
          <h2 className="text-headline relative mx-auto max-w-[18ch] text-balance">{cta.title}</h2>
          <p className="text-lead relative mx-auto mt-5 max-w-[40ch] text-muted">{cta.text}</p>
          <div className="relative mt-10 flex flex-wrap justify-center gap-3">
            <Button href={release.url} icon="download">
              Download for Windows
            </Button>
            <Button href={pageHref('support')} variant="secondary" icon="right">
              Support us
            </Button>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
