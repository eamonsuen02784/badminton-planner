import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: '.',
  base: '/badminton-planner/',
  build: {
    outDir: 'dist',
    minify: 'terser',
  },
  test: {
    environment: 'node',
  },
});
