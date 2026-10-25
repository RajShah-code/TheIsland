import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { site } from './src/content/site.js'

// Fills the %SITE_*% placeholders in index.html from src/content/site.js, so the page title and link
// previews come from the same content file (restart the dev server after changing SEO fields).
// BASE sets the path the site is served from, e.g. BASE=/TheIsland/ for GitHub Pages.
function siteMeta() {
  const escape = (value) =>
    String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const values = {
    TITLE: site.seo.title,
    DESCRIPTION: site.seo.description,
    URL: site.url,
    OG_IMAGE: new URL(site.seo.ogImage, site.url).href,
  }

  return {
    name: 'site-meta',
    transformIndexHtml: (html) =>
      html.replace(/%SITE_(\w+)%/g, (match, key) => (key in values ? escape(values[key]) : match)),
  }
}

export default defineConfig({
  base: process.env.BASE || '/',
  plugins: [react(), tailwindcss(), siteMeta()],
  // Two pages: the site and the privacy policy.
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        privacy: resolve(import.meta.dirname, 'privacy.html'),
      },
    },
  },
  server: { port: 5180, strictPort: true },
})
