import { defineConfig } from 'vite'

export default defineConfig({
  root: './',
  base: './',
  server: {
    port: 3000,
    open: true
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  }
})
