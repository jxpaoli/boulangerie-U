/// <reference types="vite/client" />
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

/**
 * Build « fichier unique » : inline JS + CSS dans un seul index.html, sans PWA,
 * routeur en hash — pour publier une démo cliquable (Artifact / ouverture directe).
 * `npm run build:single` → dist-single/index.html
 */
export default defineConfig({
  base: './',
  define: {
    'import.meta.env.VITE_ROUTER': JSON.stringify('hash'),
  },
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist-single',
    emptyOutDir: true,
  },
})
