import { useEffect, useState } from 'react'
import { site } from '../content/site.js'

// The latest GitHub release, so the Download button always points at the newest installer without
// editing the site. Until it loads (or if GitHub can't be reached) the button opens the releases page.
const api = site.repo.replace('https://github.com/', 'https://api.github.com/repos/') + '/releases/latest'
const cacheKey = 'theisland-release'

const fallback = { version: null, url: site.releases, sizeMB: null, direct: false }

function read() {
  try {
    const hit = JSON.parse(sessionStorage.getItem(cacheKey))
    return hit && hit.url ? hit : null
  } catch {
    return null
  }
}

export function useLatestRelease() {
  const [release, setRelease] = useState(() => read() || fallback)

  useEffect(() => {
    if (release.direct) return
    let cancelled = false
    fetch(api, { headers: { Accept: 'application/vnd.github+json' } })
      .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
      .then((data) => {
        const asset = (data.assets || []).find((a) => /^TheIsland-Setup-.*\.exe$/.test(a.name))
        if (!asset || cancelled) return
        const next = {
          version: String(data.tag_name || '').replace(/^v/, ''),
          url: asset.browser_download_url,
          sizeMB: Math.round(asset.size / 1024 / 1024),
          direct: true,
        }
        setRelease(next)
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(next))
        } catch {}
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [release.direct])

  return release
}
