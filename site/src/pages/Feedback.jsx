import { useState } from 'react'
import { ArrowUpRight, CheckCircle } from '@phosphor-icons/react'
import { site } from '../content/site.js'
import Button from '../components/ui/Button.jsx'
import PageHeader from '../components/ui/PageHeader.jsx'
import Reveal from '../components/ui/Reveal.jsx'

// The feedback form. The app opens it as feedback?kind=bug&v=0.1.1&os=10.0.26300&store=1, so the kind is
// picked and the version line is filled in. It posts to Web3Forms, which emails the owner; with no access
// key yet it opens an email with the same text instead.
const params = new URLSearchParams(location.search)
const clean = (v, max = 40) => (v || '').replace(/[^\w.\- ]/g, '').slice(0, max)
const app = {
  version: clean(params.get('v')),
  os: clean(params.get('os')),
  store: params.get('store') === '1',
}
const appLine = app.version
  ? `TheIsland ${app.version}${app.store ? ' (Microsoft Store)' : ''}${app.os ? `, Windows ${app.os}` : ''}`
  : ''

const field =
  'w-full rounded-2xl bg-white/[0.04] px-4 py-3 text-[0.9375rem] text-fg ring-1 ring-inset ring-line transition-shadow duration-200 placeholder:text-subtle hover:ring-line-strong focus:ring-line-strong focus:outline-none'

export default function Feedback() {
  const page = site.feedbackPage
  const [kind, setKind] = useState(page.kinds.some((k) => k.value === params.get('kind')) ? params.get('kind') : 'bug')
  const [form, setForm] = useState({ title: '', message: '', email: '', botcheck: false })
  const [status, setStatus] = useState('idle') // idle | sending | sent | failed
  const current = page.kinds.find((k) => k.value === kind)
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  async function submit(e) {
    e.preventDefault()
    if (form.botcheck) return
    const subject = `[${current.label}] ${form.title.trim()}`
    const message = [form.message.trim(), appLine && `\n${appLine}`].filter(Boolean).join('\n')
    if (!page.accessKey) {
      location.href = `mailto:${page.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`
      return
    }
    setStatus('sending')
    try {
      const res = await fetch(page.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: page.accessKey,
          subject: `TheIsland feedback: ${subject}`,
          from_name: 'TheIsland feedback',
          kind: current.label,
          title: form.title.trim(),
          message,
          email: form.email.trim() || undefined,
          app: appLine || undefined,
          botcheck: false,
        }),
      })
      const body = await res.json().catch(() => ({}))
      setStatus(res.ok && body.success ? 'sent' : 'failed')
    } catch {
      setStatus('failed')
    }
  }

  return (
    <>
      <PageHeader eyebrow={page.eyebrow} title={page.title} intro={page.intro} />
      <section className="px-5 pt-14 pb-24 sm:px-8 md:pb-32">
        <div className="mx-auto max-w-6xl">
          <Reveal className="bezel max-w-3xl">
            <div className="bezel-core p-6 md:p-9">
              {status === 'sent' ? (
                <div role="status" className="py-6">
                  <CheckCircle size={32} weight="light" className="text-done" aria-hidden="true" />
                  <h2 className="text-title mt-5">{page.sent.title}</h2>
                  <p className="mt-3 text-[0.9375rem] text-muted">{page.sent.text}</p>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-6">
                  <fieldset>
                    <legend className="mb-3 text-sm text-subtle">What is it?</legend>
                    <div className="inline-flex rounded-full bg-white/[0.04] p-1 ring-1 ring-inset ring-line">
                      {page.kinds.map((k) => (
                        <label
                          key={k.value}
                          className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-line-strong ${
                            kind === k.value ? 'bg-paper text-ink' : 'text-muted hover:text-fg'
                          }`}
                        >
                          <input
                            type="radio"
                            name="kind"
                            value={k.value}
                            checked={kind === k.value}
                            onChange={() => setKind(k.value)}
                            className="sr-only"
                          />
                          {k.label}
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <label className="block">
                    <span className="mb-2 block text-sm text-subtle">Title</span>
                    <input required maxLength={120} value={form.title} onChange={set('title')} className={field} placeholder="In a few words" />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm text-subtle">Details</span>
                    <textarea
                      required
                      rows={7}
                      maxLength={5000}
                      value={form.message}
                      onChange={set('message')}
                      className={`${field} resize-y`}
                      placeholder={current.placeholder}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm text-subtle">Email (optional, for a reply)</span>
                    <input type="email" maxLength={200} value={form.email} onChange={set('email')} className={field} placeholder="you@example.com" />
                  </label>

                  {/* Bots fill every field; people never see this one. */}
                  <input type="checkbox" name="botcheck" checked={form.botcheck} onChange={set('botcheck')} className="hidden" tabIndex={-1} autoComplete="off" />

                  {appLine && (
                    <p className="text-sm text-subtle">
                      Sent with: <span className="text-muted">{appLine}</span>
                    </p>
                  )}

                  <div className="flex flex-col gap-4 pt-2 sm:flex-row sm:items-center">
                    <Button type="submit" disabled={status === 'sending'}>
                      {status === 'sending' ? 'Sending...' : page.accessKey ? 'Send' : 'Send by email'}
                    </Button>
                    <p className="text-sm text-pretty text-subtle">{page.accessKey ? page.note : page.noteEmail}</p>
                  </div>
                  {status === 'failed' && (
                    <p role="alert" className="text-sm text-waiting">
                      {page.failed}{' '}
                      <a href={`mailto:${page.email}`} className="underline underline-offset-4">
                        {page.email}
                      </a>
                    </p>
                  )}
                </form>
              )}
            </div>
          </Reveal>
          <Reveal className="mt-8 flex max-w-3xl flex-wrap items-center gap-x-3 gap-y-2 px-1 text-[0.9375rem] text-muted">
            <p>{page.github.text}</p>
            <a
              href={page.github.href}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-1 font-medium text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg"
            >
              {page.github.label}
              <ArrowUpRight size={13} className="transition-transform duration-300 ease-out-strong group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </Reveal>
        </div>
      </section>
    </>
  )
}
