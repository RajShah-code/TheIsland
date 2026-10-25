import { basename, resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { site } from './src/content/site.js'

// Fills the %SITE_*% placeholders in each page's HTML from that page's entry in `site.pages`
// (src/content/site.js), so titles and link previews come from the content file
// (restart the dev server after changing them).
// BASE sets the path the site is served from, e.g. BASE=/TheIsland/ for GitHub Pages.
function siteMeta() {
  const escape = (value) =>
    String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  return {
    name: 'site-meta',
    transformIndexHtml: (html, ctx) => {
      const key = basename(ctx.filename, '.html')
      const page = site.pages[key] || site.pages.index
      const values = {
        TITLE: page.title,
        DESCRIPTION: page.description,
        URL: new URL(page.file, site.url).href,
        OG_IMAGE: new URL(site.ogImage, site.url).href,
      }
      return html.replace(/%SITE_(\w+)%/g, (match, k) => (k in values ? escape(values[k]) : match))
    },
  }
}

// One HTML file per page; they differ only in <body data-page>.
const input = Object.fromEntries(
  Object.entries(site.pages).map(([key, page]) => [key, resolve(import.meta.dirname, page.file || 'index.html')]),
)

export default defineConfig({
  base: process.env.BASE || '/',
  plugins: [react(), tailwindcss(), siteMeta()],
  build: { rollupOptions: { input } },
  server: { port: 5180, strictPort: true },
})
