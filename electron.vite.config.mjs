import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    build: { externalizeDeps: true }
  },
  // Two preloads: the island's and the settings window's (each exposes only its own API).
  preload: {
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/preload/index.js'),
          settings: resolve('src/preload/settings.js')
        }
      }
    }
  },
  // Two pages: the island and the settings window, so settings code never loads in the island.
  renderer: {
    root: resolve('src/renderer'),
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
          settings: resolve('src/renderer/settings.html')
        }
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
