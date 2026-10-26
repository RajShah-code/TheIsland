import { site } from '../content/site.js'
import Policy from '../components/ui/Policy.jsx'

// Terms, refunds and delivery: the policies a payment provider asks for. Their text lives in content/site.js.
export function Terms() {
  return <Policy policy={site.terms} />
}

export function Refunds() {
  return <Policy policy={site.refunds} />
}

export function Delivery() {
  return <Policy policy={site.delivery} />
}
