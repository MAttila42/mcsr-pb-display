import path, { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import extractorSvelte from '@unocss/extractor-svelte'
import UnoCSS from 'unocss/vite'
import { defineConfig } from 'vite'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
      },
    },
  },
  plugins: [
    svelte(),
    UnoCSS({
      extractors: [extractorSvelte()],
    }),
  ],
  resolve: {
    alias: {
      '$lib': path.resolve('./src/lib'),
      '@backend': path.resolve('../backend/src'),
    },
  },
})
