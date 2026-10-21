import { formatDay, formatTime } from '../../format'
import { useMinute } from '../../store'

function Compact() {
  const now = useMinute()
  return <span className="text-[13px] font-semibold tabular-nums">{formatTime(now)}</span>
}

function Panel() {
  const now = useMinute()
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-2xl font-semibold tabular-nums">{formatTime(now)}</span>
      <span className="text-xs text-white/50">{formatDay(now)}</span>
    </div>
  )
}

export default {
  id: 'clock',
  name: 'Clock',
  // Declared now so the future settings UI can render them; not used yet.
  options: { format: { type: 'select', values: ['12h'], default: '12h' } },
  Compact,
  Panel
}
