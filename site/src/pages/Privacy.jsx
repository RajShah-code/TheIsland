import { site } from '../content/site.js'
import Policy from '../components/ui/Policy.jsx'

// The privacy policy. Its text lives in content/site.js; keep it in step with what the app actually does.
export default function Privacy() {
  return <Policy policy={site.privacy} />
}
