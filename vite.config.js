import { defineConfig } from 'vite';

export default defineConfig({
  base: '/battleship/',
  root: '.',
  build: {
    outDir: 'dist',
  },
  test: {
    include: ['test/**/*.test.js'],
  },
});
