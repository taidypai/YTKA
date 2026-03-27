import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['crypto', 'buffer', 'stream', 'os', 'events', 'path', 'fs'],
      globals: { Buffer: true, global: true, process: true },
    }),
  ],
  define: {
    'process.env': {},
    'process.version': '"v18.0.0"',
  },
})
