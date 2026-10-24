import { ArrowDown, ArrowRight, ArrowUpRight, DownloadSimple } from '@phosphor-icons/react'

const icons = { right: ArrowRight, down: ArrowDown, external: ArrowUpRight, download: DownloadSimple }

const variants = {
  primary: 'bg-paper text-ink hover:bg-white',
  secondary: 'text-fg ring-1 ring-inset ring-line-strong hover:bg-white/[0.06]',
}

const iconWells = {
  primary: 'bg-ink/[0.08]',
  secondary: 'bg-white/[0.08]',
}

const nudge = {
  right: 'group-hover:translate-x-0.5',
  down: 'group-hover:translate-y-0.5',
  download: 'group-hover:translate-y-0.5',
  external: 'group-hover:translate-x-0.5 group-hover:-translate-y-0.5',
}

// Pill button (same as the Archway site). Renders an <a> when given href, otherwise a <button>.
// `icon` adds a trailing icon in its own circular well.
export default function Button({ href, variant = 'primary', icon, size = 'md', className = '', children, ...props }) {
  const Icon = icons[icon]
  const sizing = size === 'sm' ? 'h-9 text-[0.8125rem]' : 'h-12 text-[0.9375rem]'
  const padding = Icon ? (size === 'sm' ? 'pl-4 pr-1' : 'pl-5 pr-1.5') : size === 'sm' ? 'px-4' : 'px-6'

  const classes = `group inline-flex shrink-0 select-none items-center gap-3 whitespace-nowrap rounded-full font-medium tracking-[-0.01em] transition-[transform,background-color] duration-200 ease-out-strong active:scale-[0.97] disabled:pointer-events-none disabled:opacity-60 ${sizing} ${padding} ${variants[variant]} ${className}`

  const content = (
    <>
      <span>{children}</span>
      {Icon && (
        <span
          className={`flex items-center justify-center rounded-full transition-transform duration-300 ease-out-strong ${size === 'sm' ? 'size-7' : 'size-9'} ${iconWells[variant]} ${nudge[icon]}`}
          aria-hidden="true"
        >
          <Icon size={size === 'sm' ? 14 : 16} weight="bold" />
        </span>
      )}
    </>
  )

  if (href) {
    return (
      <a href={href} className={classes} {...props}>
        {content}
      </a>
    )
  }

  return (
    <button type="button" className={classes} {...props}>
      {content}
    </button>
  )
}
