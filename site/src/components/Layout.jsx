import { LazyMotion, MotionConfig } from 'motion/react'
import Nav from './sections/Nav.jsx'
import Footer from './sections/Footer.jsx'

const loadMotionFeatures = () => import('../lib/motionFeatures.js').then((module) => module.default)

// Every page: nav, the page's own sections, footer.
// LazyMotion keeps the animation bundle small (use `m.div`, not `motion.div`).
// reducedMotion="user" makes every animation respect prefers-reduced-motion.
export default function Layout({ children }) {
  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <MotionConfig reducedMotion="user">
        <Nav />
        <main>{children}</main>
        <Footer />
      </MotionConfig>
    </LazyMotion>
  )
}
