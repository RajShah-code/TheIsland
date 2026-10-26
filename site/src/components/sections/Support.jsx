import { useState } from 'react'
import { ArrowUpRight, Bug, CreditCard, CurrencyInr, Heart, Lightbulb, ShareNetwork, Star } from '@phosphor-icons/react'
import { site } from '../../content/site.js'
import Button from '../ui/Button.jsx'
import Reveal from '../ui/Reveal.jsx'
import Section from '../ui/Section.jsx'

const icons = { star: Star, share: ShareNetwork, bug: Bug, idea: Lightbulb }

const row =
  'group flex w-full items-center gap-4 rounded-2xl px-4 py-4 text-left transition-colors duration-200 hover:bg-white/[0.04]'

// "Tell a friend": the system share sheet where there is one (phones), otherwise copy the link.
function ShareRow({ item, Icon }) {
  const [copied, setCopied] = useState(false)
  const share = async () => {
    // Share the home page, whichever page the button is on.
    const url = new URL('./', window.location.href).href
    try {
      if (navigator.share) {
        await navigator.share({ title: site.pages.index.title, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }
  return (
    <button type="button" onClick={share} className={row}>
      <RowBody item={item} Icon={Icon} />
      <span className="ml-auto shrink-0 text-sm text-subtle" aria-live="polite">
        {copied ? 'Link copied' : 'Share'}
      </span>
    </button>
  )
}

function RowBody({ item, Icon }) {
  return (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/[0.05] ring-1 ring-inset ring-line">
        <Icon size={18} weight="light" />
      </span>
      <span className="min-w-0">
        <span className="block text-[0.9375rem] font-medium tracking-[-0.01em]">{item.title}</span>
        <span className="mt-0.5 block text-sm leading-relaxed text-muted">{item.text}</span>
      </span>
    </>
  )
}

// UPI: opens the payment app on a phone; on a computer, the ID can be copied into any UPI app.
function UpiOption({ option }) {
  const [copied, setCopied] = useState(false)
  const pay = `upi://pay?pa=${encodeURIComponent(option.upi)}&pn=${encodeURIComponent(site.studio)}&cu=INR`
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(option.upi)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-white/[0.03] p-5 ring-1 ring-inset ring-line sm:flex-row sm:items-center">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-inset ring-line">
        <CurrencyInr size={18} weight="light" />
      </span>
      <span className="min-w-0">
        <span className="block font-medium">{option.title}</span>
        <span className="mt-0.5 block text-sm text-muted">
          {option.text} UPI ID: <span className="font-mono text-fg">{option.upi}</span>
        </span>
      </span>
      <span className="flex gap-2 sm:ml-auto">
        <Button href={pay} size="sm" className="sm:hidden">
          Open UPI app
        </Button>
        <Button size="sm" variant="secondary" onClick={copy}>
          {copied ? 'Copied' : 'Copy UPI ID'}
        </Button>
      </span>
    </div>
  )
}

// Ways to give without a GitHub account. Only the options with a link (or UPI ID) filled in are shown.
function OtherWays() {
  const { other } = site.support
  const options = other.options.filter((o) => o.href || o.upi)
  if (options.length === 0) return null
  return (
    <Reveal className="mt-4 rounded-[2rem] p-6 ring-1 ring-inset ring-line md:p-8">
      <h3 className="text-[1.125rem] font-semibold tracking-[-0.02em]">{other.title}</h3>
      <p className="mt-2 text-[0.9375rem] text-muted">{other.text}</p>
      <div className="mt-6 space-y-3">
        {options.map((option) =>
          option.upi ? (
            <UpiOption key={option.id} option={option} />
          ) : (
            <div
              key={option.id}
              className="flex flex-col gap-4 rounded-2xl bg-white/[0.03] p-5 ring-1 ring-inset ring-line sm:flex-row sm:items-center"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-inset ring-line">
                <CreditCard size={18} weight="light" />
              </span>
              <span className="min-w-0">
                <span className="block font-medium">{option.title}</span>
                <span className="mt-0.5 block text-sm text-muted">{option.text}</span>
              </span>
              <Button href={option.href} size="sm" variant="secondary" icon="external" target="_blank" rel="noreferrer" className="sm:ml-auto">
                Donate
              </Button>
            </div>
          ),
        )}
      </div>
    </Reveal>
  )
}

export default function Support({ first = false }) {
  const { support } = site
  const { sponsor } = support
  return (
    <Section id={support.id} eyebrow={support.eyebrow} title={support.title} intro={support.intro} first={first}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <Reveal className="bezel">
          <div className="bezel-core flex h-full flex-col p-7 md:p-9">
            <span className="flex size-11 items-center justify-center rounded-full bg-pink-400/10 text-pink-300 ring-1 ring-inset ring-pink-300/20">
              <Heart size={22} weight="fill" />
            </span>
            <h3 className="text-title mt-6">{sponsor.title}</h3>
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-pretty text-muted">{sponsor.text}</p>
            <div className="mt-8 md:mt-auto md:pt-8">
              <Button href={sponsor.href} icon="external" target="_blank" rel="noreferrer">
                {sponsor.cta}
              </Button>
              <p className="mt-4 text-sm text-subtle">{sponsor.note}</p>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.06} className="rounded-[2rem] p-3 ring-1 ring-inset ring-line md:p-4">
          <h3 className="px-4 pt-3 pb-2 text-eyebrow text-subtle">{support.freeTitle}</h3>
          <ul>
            {support.free.map((item) => {
              const Icon = icons[item.id]
              return (
                <li key={item.id}>
                  {item.href ? (
                    <a href={item.href} target="_blank" rel="noreferrer" className={row}>
                      <RowBody item={item} Icon={Icon} />
                      <ArrowUpRight
                        size={16}
                        className="ml-auto shrink-0 text-subtle transition-transform duration-300 ease-out-strong group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                        aria-hidden="true"
                      />
                    </a>
                  ) : (
                    <ShareRow item={item} Icon={Icon} />
                  )}
                </li>
              )
            })}
          </ul>
        </Reveal>
      </div>
      <OtherWays />
      <Reveal as="p" className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 px-2 text-sm text-subtle">
        <span>{support.legal.text}</span>
        {support.legal.links.map((link) => (
          <a key={link.label} href={link.href} className="text-muted transition-colors duration-200 hover:text-fg">
            {link.label}
          </a>
        ))}
      </Reveal>
    </Section>
  )
}
