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
        popup: resolve(__dirname, './popup.html'),
        content: resolve(__dirname, './src/content.ts'),
        background: resolve(__dirname, './src/background.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        inlineDynamicImports: false,
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
