import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
    'process.env': {},
    'process.version': '"v18.0.0"',
  },
  resolve: {
    alias: {
      buffer: 'buffer',
      events: 'events',
    },
  },
  optimizeDeps: {
    include: ['buffer', 'events'],
  },
})