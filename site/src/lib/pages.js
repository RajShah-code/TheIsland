import { site } from '../content/site.js'

// The page this HTML file is (from <body data-page>), and links between pages. Links are relative, so the
// site works both at rajshah-code.github.io/TheIsland/ and on a custom domain.
export const currentPage = document.body.dataset.page || 'index'

// Clean URLs (download, not download.html): GitHub Pages serves foo.html at /foo, and so does the dev server.
export function pageHref(key) {
  return site.pages[key]?.file?.replace(/\.html$/, '') || './'
}
