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
      className={`grid place-items-center rounded-full text-white transition-colors hover:bg-white/12 disabled:opacity-30 ${
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

function Art({ src, size, round = 'rounded-xl' }) {
  return src ? (
    <img src={src} alt="" className={`shrink-0 object-cover ${round}`} style={{ width: size, height: size }} />
  ) : (
    <div className={`grid shrink-0 place-items-center bg-white/10 ${round}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" className="h-1/2 w-1/2 text-white/50" fill="currentColor">
        <path d="M9 18a3 3 0 1 1-2-2.83V5l12-2v11a3 3 0 1 1-2-2.83V6.2l-8 1.33z" />
      </svg>
    </div>
  )
}

// In the closed notch, only while something is playing.
function Compact() {
  const { media } = useIsland()
  if (!media.active || media.status !== 'Playing') return null
  return <Art src={media.art} size={20} round="rounded-md" />
}

function Panel() {
  const { media } = useIsland()
  const playing = media.status === 'Playing'
  return (
    <div className="flex h-full items-center gap-3.5">
      <Art src={media.art} size={84} />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[15px] leading-tight font-semibold">{media.title || 'Unknown'}</p>
        <p className="mt-0.5 truncate text-xs text-white/60">{media.artist}</p>
        <p className="truncate text-[10px] text-white/35">{appName(media.app)}</p>
        <div className="mt-1.5 -ml-1.5 flex items-center">
          <Button icon="prev" disabled={!media.canPrev} onClick={() => window.island.media('prev')} />
          <Button icon={playing ? 'pause' : 'play'} big onClick={() => window.island.media('toggle')} />
          <Button icon="next" disabled={!media.canNext} onClick={() => window.island.media('next')} />
        </div>
      </div>
    </div>
  )
}

export default {
  id: 'music',
  name: 'Music',
  width: 250,
  options: {},
  // Only takes a column while a player is open.
  visible: (state) => state.media.available && state.media.active,
  Compact,
  Panel
}
