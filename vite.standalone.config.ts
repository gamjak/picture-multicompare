import tailwindcss from '@tailwindcss/postcss';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

const projectRoot = fileURLToPath(new URL('./', import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL('./standalone', import.meta.url)),
  base: './',
  publicDir: false,
  resolve: {
    alias: {
      '@': projectRoot,
    },
  },
  css: {
    postcss: {
      plugins: [tailwindcss()],
    },
  },
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL('./standalone-dist', import.meta.url)),
    emptyOutDir: true,
  },
});
