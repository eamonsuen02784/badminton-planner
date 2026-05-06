import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: '.',
  base: '/badminton-planner/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: 'index-vite.html',
    },
  },
  test: {
    environment: 'node',
  },
});
