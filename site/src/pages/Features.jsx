import { site } from '../content/site.js'
import PageHeader from '../components/ui/PageHeader.jsx'
import { Developers, Everyday } from '../components/sections/Features.jsx'
import ComingSoon from '../components/sections/ComingSoon.jsx'
import CtaBand from '../components/sections/CtaBand.jsx'

export default function Features() {
  const { featuresPage } = site
  return (
    <>
      <PageHeader eyebrow={featuresPage.eyebrow} title={featuresPage.title} intro={featuresPage.intro} />
      <Everyday />
      <Developers />
      <ComingSoon />
      <CtaBand />
    </>
  )
}
