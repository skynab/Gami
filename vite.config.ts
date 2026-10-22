/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // Installable and usable offline: the app, the 3D viewer and every built-in model are cached on first visit.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Gami: learn origami in 3D',
        short_name: 'Gami',
        description: 'Learn origami step by step in 3D. Rotate, zoom and watch every fold.',
        theme_color: '#4f46e5',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,fold}'],
        // The 3D viewer chunk is about 1 MB.
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
        // Deep links (/learn/crane) load the app shell when offline.
        navigateFallback: '/index.html',
      },
    }),
  ],
  // The 3D viewer chunk (three.js + drei) is ~1 MB before gzip. It's lazy-loaded, so the gallery never pays for it.
  build: { chunkSizeWarningLimit: 1200 },
  test: {
    environment: 'node',
    // Worktrees of other sessions live under .claude/worktrees, with their own copies of everything.
    exclude: ['e2e/**', 'node_modules/**', '.claude/**'],
  },
});
