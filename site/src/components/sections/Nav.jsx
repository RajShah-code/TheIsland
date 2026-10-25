import { useEffect, useState } from 'react'
import { AnimatePresence, m, useMotionValueEvent, useReducedMotion, useScroll } from 'motion/react'
import { site } from '../../content/site.js'
import { currentPage, pageHref } from '../../lib/pages.js'
import { easeOut } from '../../lib/motion.js'
import { IslandMark } from '../ui/Marks.jsx'
import Button from '../ui/Button.jsx'

// Floating glass pill, same behaviour as the Archway site's nav. Links go to pages; the current page
// gets the highlight.
export default function Nav() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { scrollY } = useScroll()
  const reduce = useReducedMotion()

  useMotionValueEvent(scrollY, 'change', (value) => {
    const next = value > 24
    if (next !== scrolled) setScrolled(next)
  })

  // Lock page scroll and allow Escape while the mobile menu is open.
  useEffect(() => {
    if (!open) return
    const onKey = (event) => event.key === 'Escape' && setOpen(false)
    document.documentElement.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.documentElement.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex justify-center px-4 pt-3 sm:pt-4">
        <m.nav
          aria-label="Main"
          initial={reduce ? { opacity: 0 } : { opacity: 0, transform: 'translateY(-12px)' }}
          animate={{ opacity: 1, transform: 'translateY(0px)' }}
          transition={{ duration: 0.8, delay: 0.1, ease: easeOut }}
          className={`flex h-14 w-full max-w-[52rem] items-center justify-between rounded-full pr-2 pl-4 transition-[background-color,box-shadow] duration-500 ease-out-strong ${
            scrolled || open ? 'glass' : 'bg-transparent'
          }`}
        >
          <a href={pageHref('index')} className="flex items-center gap-2.5 font-semibold tracking-[-0.02em]">
            <IslandMark className="size-6" />
            {site.name}
            <span className="hidden text-sm font-normal tracking-[-0.01em] text-subtle lg:inline">by {site.studio}</span>
          </a>

          <ul className="hidden items-center md:flex">
            {site.nav.map((item) => {
              const active = currentPage === item.page
              return (
                <li key={item.page}>
                  <a
                    href={pageHref(item.page)}
                    aria-current={active ? 'page' : undefined}
                    className={`relative block rounded-full px-3.5 py-2 text-sm transition-colors duration-200 ${
                      active ? 'bg-white/[0.07] text-fg' : 'text-muted hover:text-fg'
                    }`}
                  >
                    {item.label}
                  </a>
                </li>
              )
            })}
          </ul>

          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              {/* The Download page, not the file: it has the version, requirements and install notes. */}
              <Button href={pageHref('download')} size="sm" aria-current={currentPage === 'download' ? 'page' : undefined}>
                Download
              </Button>
            </div>
            <button
              type="button"
              className="relative flex size-10 items-center justify-center rounded-full transition-[transform,background-color] duration-200 ease-out-strong hover:bg-white/[0.06] active:scale-[0.94] md:hidden"
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? 'Close menu' : 'Open menu'}
              onClick={() => setOpen((value) => !value)}
            >
              <span
                className={`absolute h-[1.5px] w-[18px] rounded-full bg-fg transition-transform duration-300 ease-out-strong ${
                  open ? 'rotate-45' : '-translate-y-[4px]'
                }`}
              />
              <span
                className={`absolute h-[1.5px] w-[18px] rounded-full bg-fg transition-transform duration-300 ease-out-strong ${
                  open ? '-rotate-45' : 'translate-y-[4px]'
                }`}
              />
            </button>
          </div>
        </m.nav>
      </header>

      <AnimatePresence>
        {open && (
          <m.div
            id="mobile-nav"
            className="fixed inset-0 z-30 flex flex-col bg-canvas/85 px-6 pt-28 pb-10 backdrop-blur-2xl md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.2, ease: easeOut } }}
            transition={{ duration: 0.3, ease: easeOut }}
          >
            <ul className="space-y-1">
              {[{ label: 'Home', page: 'index' }, ...site.nav].map((item, index) => (
                <li key={item.page} className="overflow-hidden">
                  <m.a
                    href={pageHref(item.page)}
                    aria-current={currentPage === item.page ? 'page' : undefined}
                    className={`block py-2 text-[2.5rem] font-semibold tracking-[-0.04em] ${
                      currentPage === item.page ? 'text-fg' : 'text-muted'
                    }`}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, transform: 'translateY(100%)' }}
                    animate={{ opacity: 1, transform: 'translateY(0%)' }}
                    transition={{ duration: 0.6, delay: 0.05 + index * 0.05, ease: easeOut }}
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </m.a>
                </li>
              ))}
            </ul>
            <m.div
              className="mt-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.35, ease: easeOut }}
            >
              <Button href={pageHref('download')} icon="download" className="w-full justify-between" onClick={() => setOpen(false)}>
                Download
              </Button>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </>
  )
}
