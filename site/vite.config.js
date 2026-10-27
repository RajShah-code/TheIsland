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
        URL: new URL((page.file || '').replace(/\.html$/, ''), site.url).href,
        OG_IMAGE: new URL(site.ogImage, site.url).href,
      }
      return html.replace(/%SITE_(\w+)%/g, (match, k) => (k in values ? escape(values[k]) : match))
    },
  }
}

// Serves /download as download.html, like GitHub Pages does, so the clean links work in dev and preview.
function cleanUrls() {
  const files = new Set(Object.values(site.pages).map((page) => page.file).filter(Boolean))
  const rewrite = (req, res, next) => {
    const [path, query = ''] = req.url.split('?')
    const base = process.env.BASE || '/'
    const name = path.startsWith(base) ? path.slice(base.length) : ''
    if (files.has(`${name}.html`)) req.url = `${base}${name}.html${query && '?' + query}`
    next()
  }
  return {
    name: 'clean-urls',
    configureServer: (server) => void server.middlewares.use(rewrite),
    configurePreviewServer: (server) => void server.middlewares.use(rewrite),
  }
}

// One HTML file per page; they differ only in <body data-page>.
const input = Object.fromEntries(
  Object.entries(site.pages).map(([key, page]) => [key, resolve(import.meta.dirname, page.file || 'index.html')]),
)

export default defineConfig({
  base: process.env.BASE || '/',
  plugins: [react(), tailwindcss(), siteMeta(), cleanUrls()],
  build: { rollupOptions: { input } },
  server: { port: 5180, strictPort: true },
})
