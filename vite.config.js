import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  build: {outDir: 'bundle', target: 'es2022', rollupOptions: {
    external: ['/static/anna-apps/_sdk/latest/index.js']
  }}
});
