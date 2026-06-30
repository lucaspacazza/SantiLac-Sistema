import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/fabrica/',
  plugins: [react()],
  publicDir: 'public',
  server: {
    proxy: {
      '/api/fabrica': 'http://127.0.0.1:8001',
    },
  },
})
