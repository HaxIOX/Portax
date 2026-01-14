import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Custom domain (e.g. portax.haxio.de) serves from the root, so keep base at '/'.
export default defineConfig({
  plugins: [react()],
  base: '/',
})
