import { m, useReducedMotion } from 'motion/react'
import { easeReveal } from '../../lib/motion.js'

// Fade-up with a slight blur-to-sharp as the element enters the viewport (same as the Archway site).
// `onMount` plays it immediately instead (used in the hero).
export default function Reveal({ as = 'div', delay = 0, y = 24, onMount = false, className, children, ...props }) {
  const reduce = useReducedMotion()
  const Component = m[as]

  const hidden = reduce ? { opacity: 0 } : { opacity: 0, transform: `translateY(${y}px)`, filter: 'blur(6px)' }
  const shown = reduce ? { opacity: 1 } : { opacity: 1, transform: 'translateY(0px)', filter: 'blur(0px)' }
  const trigger = onMount
    ? { animate: shown }
    : { whileInView: shown, viewport: { once: true, margin: '0px 0px -12% 0px' } }

  return (
    <Component
      initial={hidden}
      {...trigger}
      transition={{ duration: reduce ? 0.3 : 0.9, delay, ease: easeReveal }}
      className={className}
      {...props}
    >
      {children}
    </Component>
  )
}
