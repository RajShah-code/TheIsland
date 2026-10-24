import { useEffect, useState } from 'react'

// Returns the id of the section currently crossing the middle of the viewport.
export function useActiveSection(ids) {
  const [active, setActive] = useState('')

  useEffect(() => {
    const elements = ids.map((id) => document.getElementById(id)).filter(Boolean)
    if (!elements.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.find((entry) => entry.isIntersecting)
        if (hit) setActive(hit.target.id)
      },
      { rootMargin: '-45% 0px -50% 0px' },
    )

    elements.forEach((element) => observer.observe(element))
    const top = document.getElementById('top')
    const clearAtTop = new IntersectionObserver(([entry]) => entry.isIntersecting && setActive(''), {
      rootMargin: '0px 0px -60% 0px',
    })
    if (top) clearAtTop.observe(top)

    return () => {
      observer.disconnect()
      clearAtTop.disconnect()
    }
  }, [ids])

  return active
}
