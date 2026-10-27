import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Layout from './components/Layout.jsx'
import { currentPage } from './lib/pages.js'
import Home from './pages/Home.jsx'
import Features from './pages/Features.jsx'
import Download from './pages/Download.jsx'
import Help from './pages/Help.jsx'
import SupportPage from './pages/SupportPage.jsx'
import Privacy from './pages/Privacy.jsx'
import Security from './pages/Security.jsx'
import License from './pages/License.jsx'
import { Terms, Refunds, Delivery } from './pages/Legal.jsx'
import Contact from './pages/Contact.jsx'
import Feedback from './pages/Feedback.jsx'
import './index.css'

// Each HTML file names its page in <body data-page>; this renders that page inside the shared layout.
const pages = {
  index: Home,
  features: Features,
  download: Download,
  help: Help,
  support: SupportPage,
  privacy: Privacy,
  security: Security,
  license: License,
  terms: Terms,
  refunds: Refunds,
  delivery: Delivery,
  contact: Contact,
  feedback: Feedback,
}

const Page = pages[currentPage] || Home

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Layout>
      <Page />
    </Layout>
  </StrictMode>,
)
