/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // The 3D viewer chunk (three.js + drei) is ~1 MB before gzip. It's lazy-loaded, so the gallery never pays for it.
  build: { chunkSizeWarningLimit: 1200 },
  test: {
    environment: 'node',
    exclude: ['e2e/**', 'node_modules/**'],
  },
});
