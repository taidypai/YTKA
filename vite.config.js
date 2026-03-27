import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

const patchGramjsBuffer = {
  name: 'patch-gramjs-buffer',
  transform(code, id) {
    if (id.includes('generationHelpers')) {
      return code.replace('!(data instanceof Buffer)', '!Buffer.isBuffer(data)')
    }
  },
}

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['crypto', 'buffer', 'stream', 'os', 'events', 'path', 'fs'],
      globals: { Buffer: true, global: true, process: true },
    }),
    patchGramjsBuffer,
  ],
  resolve: {
    dedupe: ['buffer'],
  },
  define: {
    'process.env': {},
    'process.version': '"v18.0.0"',
  },
})
