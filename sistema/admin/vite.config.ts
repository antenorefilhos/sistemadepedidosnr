import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'))

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Testes das regras puras do formulario de banner (src/utils/*.test.ts).
  // Ambiente 'node': nao ha componente montado aqui, jsdom seria peso morto.
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
  server: {
    port: 3002,
    host: true,
  },
  build: {
    chunkSizeWarningLimit: 550,
    rollupOptions: {
      output: {
        manualChunks: {
          apexcharts: ['apexcharts'],
          reactApexcharts: ['react-apexcharts'],
        },
      },
    },
  },
})
