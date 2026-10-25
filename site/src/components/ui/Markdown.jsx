import { Fragment } from 'react'

// Just enough Markdown for release notes: paragraphs, "- " lists, **bold**, `code` and [links](url).
// Rendered as React elements, never as HTML, so nothing in the notes can inject markup.
function inline(text) {
  const parts = []
  const pattern = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\))/g
  let last = 0
  let match
  while ((match = pattern.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    if (match[2]) parts.push(<strong key={parts.length} className="font-semibold text-fg">{match[2]}</strong>)
    else if (match[3]) parts.push(<code key={parts.length} className="rounded bg-white/[0.07] px-1 py-0.5 font-mono text-[0.85em] break-all text-fg">{match[3]}</code>)
    else parts.push(<a key={parts.length} href={match[5]} target="_blank" rel="noreferrer" className="text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg">{match[4]}</a>)
    last = pattern.lastIndex
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

export default function Markdown({ text, className = '' }) {
  const blocks = String(text).replace(/\r\n/g, '\n').trim().split(/\n{2,}/)
  return (
    <div className={`space-y-3 ${className}`}>
      {blocks.map((block, i) => {
        const lines = block.split('\n').map((l) => l.trim())
        if (lines.every((l) => /^[-*] /.test(l))) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.slice(2))}</li>
              ))}
            </ul>
          )
        }
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {inline(l)}
              </Fragment>
            ))}
          </p>
        )
      })}
    </div>
  )
}
