import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import pkg from '../package.json';
import { bundledPackages, collectLicences, lockedPackages } from './third-party-licences';

const root = join(import.meta.dirname, '..');

describe('open-source notices', () => {
  const notices = collectLicences(lockedPackages(root));

  it('list every library the app depends on, and nothing only for development', () => {
    const names = notices.packages.map((p) => p.name);
    for (const dep of Object.keys(pkg.dependencies)) expect(names, dep).toContain(dep);
    // The service worker's runtime comes from a development tool, but it ships.
    expect(names).toContain('workbox-precaching');
    for (const dev of ['vite', 'vitest', 'typescript', '@playwright/test', '@types/react']) expect(names, dev).not.toContain(dev);
  });

  it('give each one a licence and its full text', () => {
    for (const p of notices.packages) {
      expect(p.licence, p.name).not.toBe('See the package');
      expect(notices.texts[p.text]?.length, p.name).toBeGreaterThan(40);
    }
    const react = notices.packages.find((p) => p.name === 'react')!;
    expect(react.licence).toBe('MIT');
    expect(notices.texts[react.text]).toContain('Permission is hereby granted');
  });

  it('keep each licence text once', () => {
    expect(new Set(notices.texts).size).toBe(notices.texts.length);
  });

  it('find the packages a build bundled from its module ids', () => {
    const dirs = bundledPackages(root, [
      '/repo/node_modules/react/index.js',
      'C:\\repo\\node_modules\\@react-three\\fiber\\dist\\index.js?v=1',
      '\0/repo/node_modules/three/build/three.module.js',
      '/repo/node_modules/a/node_modules/b/lib.js',
      '/repo/src/main.tsx',
      'virtual:pwa-register',
    ]);
    expect(dirs).toEqual(
      expect.arrayContaining(['/repo/node_modules/react', 'C:/repo/node_modules/@react-three/fiber', '/repo/node_modules/three', '/repo/node_modules/a/node_modules/b']),
    );
    expect(dirs.some((d) => d.includes('src'))).toBe(false);
    expect(dirs.some((d) => d.endsWith('/workbox-core'))).toBe(true);
  });
});
