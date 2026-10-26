import { site } from '../content/site.js'
import Policy from '../components/ui/Policy.jsx'
import Reveal from '../components/ui/Reveal.jsx'

// Contact details, then the ways to reach us on GitHub. Only the details filled in (site.contact) are shown.
export default function Contact() {
  const { contact } = site
  const details = [
    contact.email && { label: 'Email', value: contact.email, href: `mailto:${contact.email}` },
    contact.phone && { label: 'Phone', value: contact.phone, href: `tel:${contact.phone.replace(/\s/g, '')}` },
    contact.address && { label: 'Location', value: contact.address },
  ].filter(Boolean)
  return (
    <Policy policy={contact}>
      <Reveal className="rounded-[2rem] p-7 ring-1 ring-inset ring-line md:p-9">
        <p className="text-[0.9375rem] font-medium">{contact.operator}</p>
        {details.length > 0 && (
          <dl className="mt-6 space-y-4">
            {details.map((d) => (
              <div key={d.label} className="grid gap-1 sm:grid-cols-[7rem_minmax(0,1fr)]">
                <dt className="text-sm text-subtle">{d.label}</dt>
                <dd className="text-[0.9375rem] whitespace-pre-line text-muted">
                  {d.href ? (
                    <a href={d.href} className="text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg">
                      {d.value}
                    </a>
                  ) : (
                    d.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </Reveal>
    </Policy>
  )
}
