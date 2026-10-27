import { useState } from 'react'
import { ArrowUpRight, Check, ShieldWarning, WindowsLogo } from '@phosphor-icons/react'
import { site } from '../content/site.js'
import { useLatestRelease, useReleases } from '../lib/release.js'
import Button from '../components/ui/Button.jsx'
import Markdown from '../components/ui/Markdown.jsx'
import PageHeader from '../components/ui/PageHeader.jsx'
import Reveal from '../components/ui/Reveal.jsx'
import Section from '../components/ui/Section.jsx'
import Steps from '../components/sections/Steps.jsx'

const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : ''

function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-muted ring-1 ring-inset ring-line-strong transition-colors duration-200 hover:bg-white/[0.06] hover:text-fg"
    >
      {copied ? 'Copied' : label}
    </button>
  )
}

function DownloadCard() {
  const latest = useLatestRelease()
  const releases = useReleases()
  const newest = releases?.[0]
  const { download } = site
  const meta = [latest.version && `Version ${latest.version}`, newest && formatDate(newest.date)]
  return (
    <Reveal onMount delay={0.15} className="bezel mt-12 md:mt-16">
      <div className="bezel-core grid gap-10 p-7 md:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] md:p-10">
        <div>
          <span className="flex size-12 items-center justify-center rounded-2xl bg-white/[0.06] ring-1 ring-inset ring-line">
            <WindowsLogo size={24} weight="light" />
          </span>
          <h2 className="text-title mt-6">TheIsland for Windows 11</h2>
          <p className="mt-2 font-mono text-xs text-subtle">{meta.filter(Boolean).join('  ·  ') || 'Latest version'}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button href={site.store} icon="external" target="_blank" rel="noreferrer">
              Get it from Microsoft Store
            </Button>
          </div>
          <p className="mt-5 text-sm text-subtle">{download.store}</p>
        </div>
        <div className="md:border-l md:border-line md:pl-10">
          <h3 className="text-eyebrow text-subtle">Requirements</h3>
          <ul className="mt-5 space-y-3">
            {download.requirements.map((r) => (
              <li key={r} className="flex items-start gap-2.5 text-[0.9375rem]">
                <Check size={14} weight="bold" className="mt-1.5 shrink-0 text-subtle" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Reveal>
  )
}

// The GitHub installer for PCs without the Store: the download, what to expect from SmartScreen, and how
// to check the file is the real one.
function Installer() {
  const latest = useLatestRelease()
  const releases = useReleases()
  const newest = releases?.[0]
  const { installer, smartscreen } = site.download
  const file = newest ? `TheIsland-Setup-${newest.version}.exe` : 'TheIsland-Setup-<version>.exe'
  const command = `Get-FileHash "$env:USERPROFILE\\Downloads\\${file}"`
  return (
    <Section id="installer" className="pt-0 md:pt-0">
      <Reveal className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[2rem] p-7 ring-1 ring-inset ring-line md:col-span-2 md:p-8">
          <h2 className="text-[1.25rem] font-semibold tracking-[-0.025em]">{installer.title}</h2>
          <p className="mt-3 max-w-[60ch] text-[0.9375rem] leading-relaxed text-pretty text-muted">{installer.text}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button href={latest.url} variant="secondary" icon="download">
              {installer.button}
              {latest.sizeMB ? ` (${latest.sizeMB} MB)` : ''}
            </Button>
            <Button href={site.releases} variant="secondary" icon="external" target="_blank" rel="noreferrer">
              All files on GitHub
            </Button>
          </div>
        </div>
        <div className="rounded-[2rem] p-7 ring-1 ring-inset ring-line md:p-8">
          <ShieldWarning size={24} weight="light" className="text-muted" />
          <h2 className="mt-5 text-[1.25rem] font-semibold tracking-[-0.025em]">{smartscreen.title}</h2>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-pretty text-muted">{smartscreen.text}</p>
        </div>
        <div className="rounded-[2rem] p-7 ring-1 ring-inset ring-line md:p-8">
          <h2 className="text-[1.25rem] font-semibold tracking-[-0.025em]">Check the installer (optional)</h2>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted">
            In PowerShell, this prints the file’s SHA-256. It should match the one below.
          </p>
          <div className="mt-5 flex items-center gap-3 rounded-xl bg-black/50 px-4 py-3 ring-1 ring-inset ring-line">
            <code className="min-w-0 flex-1 font-mono text-[12px] break-all text-white/85">{command}</code>
            <CopyButton text={command} />
          </div>
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-black/50 px-4 py-3 ring-1 ring-inset ring-line">
            <code className="min-w-0 flex-1 font-mono text-[12px] break-all text-white/85">
              {newest?.sha256 || (releases ? 'See the release page on GitHub' : 'Loading...')}
            </code>
            {newest?.sha256 && <CopyButton text={newest.sha256} />}
          </div>
        </div>
      </Reveal>
    </Section>
  )
}

function Changelog() {
  const releases = useReleases()
  const { changelog } = site.download
  return (
    <Section id="changelog" eyebrow={changelog.eyebrow} title={changelog.title}>
      {!releases?.length ? (
        <p className="text-muted">{releases ? 'Release notes are on GitHub.' : changelog.empty}</p>
      ) : (
        <ol className="space-y-4">
          {releases.map((r, i) => (
            <Reveal as="li" key={r.version} delay={Math.min(i, 3) * 0.05} className="grid gap-4 border-t border-line pt-8 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-10">
              <div>
                <h3 className="text-[1.25rem] font-semibold tracking-[-0.025em]">Version {r.version}</h3>
                <p className="mt-1 text-sm text-subtle">{formatDate(r.date)}</p>
                {i === 0 && <span className="text-eyebrow mt-3 inline-block rounded-full bg-white/[0.06] px-2.5 py-1.5 text-muted">Latest</span>}
              </div>
              <div>
                <Markdown text={r.notes} className="text-[0.9375rem] leading-relaxed text-muted" />
                <a
                  href={r.page}
                  target="_blank"
                  rel="noreferrer"
                  className="group mt-5 inline-flex items-center gap-1 text-sm text-muted transition-colors duration-200 hover:text-fg"
                >
                  Files for {r.version}
                  {r.sizeMB ? ` (${r.sizeMB} MB)` : ''}
                  <ArrowUpRight size={13} className="transition-transform duration-300 ease-out-strong group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </a>
              </div>
            </Reveal>
          ))}
        </ol>
      )}
    </Section>
  )
}

export default function Download() {
  const { download } = site
  return (
    <>
      <PageHeader eyebrow={download.eyebrow} title={download.title} intro={download.intro}>
        <DownloadCard />
      </PageHeader>
      <Steps />
      <Installer />
      <Changelog />
    </>
  )
}
