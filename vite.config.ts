import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the same dist/ works at primalchase.com root
  // and under a GitHub Pages project path.
  base: './',
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1200
  },
  server: {
    port: 8777
  }
});
