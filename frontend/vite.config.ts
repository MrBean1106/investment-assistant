import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        // Local dev proxy target port. Override per-run with VITE_API_PORT
        // (e.g. VITE_API_PORT=8011 npm run dev) without editing this file.
        target: `http://localhost:${process.env.VITE_API_PORT || 8001}`,
        changeOrigin: true,
      },
    },
  },
})
