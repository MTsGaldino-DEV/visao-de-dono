// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/visao-de-dono/',   // ← Importante: nome do repositório em minúsculo
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
