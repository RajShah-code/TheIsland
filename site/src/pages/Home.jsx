import Hero from '../components/sections/Hero.jsx'
import Facts from '../components/sections/Facts.jsx'
import Why from '../components/sections/Why.jsx'
import { Highlights, PrivacyTeaser } from '../components/sections/HomeTeasers.jsx'
import CtaBand from '../components/sections/CtaBand.jsx'

// The landing page: the island in action, why it exists, and a way to every other page.
export default function Home() {
  return (
    <>
      <Hero />
      <Facts />
      <Why />
      <Highlights />
      <PrivacyTeaser />
      <CtaBand />
    </>
  )
}
