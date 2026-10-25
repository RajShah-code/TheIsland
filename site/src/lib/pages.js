import { site } from '../content/site.js'

// The page this HTML file is (from <body data-page>), and links between pages. Links are relative, so the
// site works both at rajshah-code.github.io/TheIsland/ and on a custom domain.
export const currentPage = document.body.dataset.page || 'index'

export function pageHref(key) {
  return site.pages[key]?.file || './'
}
