import { site } from '../../content/site.js'
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
      <div className="mx-auto max-w-6xl border-t border-line pt-10">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
            <a href="#top" className="flex w-fit items-center gap-2.5 font-semibold tracking-[-0.02em]">
              <IslandMark className="size-6" />
              {site.name}
            </a>
            <p className="text-sm text-subtle">
              A product by{' '}
              {site.studioUrl ? (
                <a href={site.studioUrl} className="transition-opacity duration-200 hover:opacity-80">
                  {studio}
                </a>
              ) : (
                studio
              )}
            </p>
          </div>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {footer.links.map((link) => (
              <li key={link.label}>
                <a href={link.href} target="_blank" rel="noreferrer" className="text-muted transition-colors duration-200 hover:text-fg">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-10 flex flex-col gap-2 text-sm text-subtle md:flex-row md:justify-between">
          <p>
            © {new Date().getFullYear()} {site.studio}. Free and open source under the MIT license.
          </p>
          <p className="max-w-[60ch]">{footer.disclaimer}</p>
        </div>
      </div>
    </footer>
  )
}
