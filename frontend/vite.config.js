import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ✅ FIXED: Removed `@tailwindcss/vite` — that plugin is for Tailwind v4 only.
// Your project uses Tailwind v3 (tailwindcss: ^3.4.3 in package.json).
// Tailwind v3 works via PostCSS, not a Vite plugin. The postcss.config.js
// file handles it automatically — no import or plugin needed here.

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:7800',
        changeOrigin: true,
      },
    },
  },
})