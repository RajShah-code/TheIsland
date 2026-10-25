import { site } from '../../content/site.js'
import { pageHref } from '../../lib/pages.js'
import { ArchwayMark, IslandMark } from '../ui/Marks.jsx'

export default function Footer() {
  const { footer } = site
  const studio = (
    <span className="inline-flex items-center gap-1.5 font-medium text-fg">
      <ArchwayMark className="size-[0.95rem]" />
      {site.studio}
    </span>
  )
  return (
    <footer className="px-5 pt-10 pb-12 sm:px-8">
      <div className="mx-auto max-w-6xl border-t border-line pt-12">
        <div className="grid gap-10 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
          <div>
            <a href={pageHref('index')} className="flex w-fit items-center gap-2.5 font-semibold tracking-[-0.02em]">
              <IslandMark className="size-6" />
              {site.name}
            </a>
            <p className="mt-4 max-w-[30ch] text-sm leading-relaxed text-muted">
              A free dynamic island for Windows 11. A product by{' '}
              {site.studioUrl ? (
                <a href={site.studioUrl} className="transition-opacity duration-200 hover:opacity-80">
                  {studio}
                </a>
              ) : (
                studio
              )}
              .
            </p>
          </div>
          {footer.columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="text-eyebrow text-subtle">{column.title}</h2>
              <ul className="mt-4 space-y-2.5 text-sm">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      {...(link.external ? { target: '_blank', rel: 'noreferrer' } : {})}
                      className="text-muted transition-colors duration-200 hover:text-fg"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-2 text-sm text-subtle md:flex-row md:justify-between">
          <p>
            © {new Date().getFullYear()} {site.studio}. Free and open source under the MIT license.
          </p>
          <p className="max-w-[60ch]">{footer.disclaimer}</p>
        </div>
      </div>
    </footer>
  )
}
