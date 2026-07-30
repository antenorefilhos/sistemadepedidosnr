import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3003,
    host: true,
    proxy: {
      '/auth': 'http://localhost:3005',
      '/picker': 'http://localhost:3005',
    },
  },
})
