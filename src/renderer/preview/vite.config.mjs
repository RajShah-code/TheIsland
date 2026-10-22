import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
export default { root: resolve(import.meta.dirname, '..'), plugins: [react(), tailwindcss()], server: { port: 5199, strictPort: true } }
