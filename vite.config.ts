import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { localSync } from './sync/viteSync.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), localSync()],
  build: { manifest: true },
})
