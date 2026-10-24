import { LazyMotion, MotionConfig } from 'motion/react'
import Nav from './components/sections/Nav.jsx'
import Hero from './components/sections/Hero.jsx'
import Facts from './components/sections/Facts.jsx'
import Problem from './components/sections/Problem.jsx'
import Features from './components/sections/Features.jsx'
import Steps from './components/sections/Steps.jsx'
import Trust from './components/sections/Trust.jsx'
import Faq from './components/sections/Faq.jsx'
import Feedback from './components/sections/Feedback.jsx'
import Footer from './components/sections/Footer.jsx'

const loadMotionFeatures = () => import('./lib/motionFeatures.js').then((module) => module.default)

// LazyMotion keeps the animation bundle small (use `m.div`, not `motion.div`).
// reducedMotion="user" makes every animation respect prefers-reduced-motion.
export default function App() {
  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <MotionConfig reducedMotion="user">
        <Nav />
        <main>
          <Hero />
          <Facts />
          <Problem />
          <Features />
          <Steps />
          <Trust />
          <Faq />
          <Feedback />
        </main>
        <Footer />
      </MotionConfig>
    </LazyMotion>
  )
}
