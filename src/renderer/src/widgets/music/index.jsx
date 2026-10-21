import { useIsland } from '../../store'

const Icon = {
  play: <path d="M8 5.5v13l11-6.5z" />,
  pause: <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />,
  next: <path d="M6 6l8.5 6L6 18zM15.5 6H18v12h-2.5z" />,
  prev: <path d="M18 6l-8.5 6L18 18zM6 6h2.5v12H6z" />
}

function Button({ icon, onClick, disabled, big }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`grid place-items-center rounded-full text-white transition hover:bg-white/15 disabled:opacity-30 ${
        big ? 'h-9 w-9' : 'h-8 w-8'
      }`}
    >
      <svg viewBox="0 0 24 24" className={big ? 'h-5 w-5' : 'h-4 w-4'} fill="currentColor">
        {Icon[icon]}
      </svg>
    </button>
  )
}

function appName(id) {
  if (!id) return ''
  const base = id.split('!').pop().replace(/\.exe$/i, '')
  return base.length > 24 ? '' : base
}

function Art({ src, size }) {
  return src ? (
    <img src={src} alt="" className="shrink-0 rounded-md object-cover" style={{ width: size, height: size }} />
  ) : (
    <div className="grid shrink-0 place-items-center rounded-md bg-white/10" style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" className="h-1/2 w-1/2 text-white/50" fill="currentColor">
        <path d="M9 18a3 3 0 1 1-2-2.83V5l12-2v11a3 3 0 1 1-2-2.83V6.2l-8 1.33z" />
      </svg>
    </div>
  )
}

// Shown in the collapsed pill only while something is playing.
function Compact() {
  const { media } = useIsland()
  if (!media.active || media.status !== 'Playing') return null
  return <Art src={media.art} size={20} />
}

function Panel() {
  const { media } = useIsland()
  if (!media.available) {
    return <p className="text-xs text-white/50">Music helper not built. Run npm run build:helper.</p>
  }
  if (!media.active) return <p className="text-xs text-white/50">Nothing playing</p>
  const playing = media.status === 'Playing'
  return (
    <div className="flex items-center gap-3">
      <Art src={media.art} size={52} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{media.title || 'Unknown'}</p>
        <p className="truncate text-xs text-white/60">{media.artist}</p>
        <p className="truncate text-[10px] uppercase tracking-wide text-white/35">{appName(media.app)}</p>
      </div>
      <div className="flex items-center">
        <Button icon="prev" disabled={!media.canPrev} onClick={() => window.island.media('prev')} />
        <Button icon={playing ? 'pause' : 'play'} big onClick={() => window.island.media('toggle')} />
        <Button icon="next" disabled={!media.canNext} onClick={() => window.island.media('next')} />
      </div>
    </div>
  )
}

export default { id: 'music', name: 'Music', options: {}, Compact, Panel }
