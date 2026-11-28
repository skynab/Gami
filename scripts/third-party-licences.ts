/**
 * The open-source notices Orikata ships with: every library in the build, its licence and the licence's full text, as
 * the MIT, Apache and BSD licences ask. The Vite plugin works out which packages the build really bundled (from
 * Rollup's module graph), so the list can't fall behind the code, and writes it into the build as
 * `third-party-licences.json`. Under `npm run dev` it serves the same from package-lock.json instead, a little
 * longer as it can't see the bundle. The Licences page reads it from there.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

export const LICENCES_FILE = 'third-party-licences.json';

export interface ThirdParty {
  name: string;
  version: string;
  /** The SPDX name from the package, e.g. `MIT`. */
  licence: string;
  /** Who holds the copyright, as the package names its author, where the licence file doesn't say. */
  author?: string;
  homepage?: string;
  /** Index into `texts`: the same licence text is kept once however many packages share it. */
  text: number;
}

export interface Notices {
  packages: ThirdParty[];
  texts: string[];
}

interface LockEntry {
  name?: string;
  dev?: boolean;
  devOptional?: boolean;
  optional?: boolean;
  peer?: boolean;
  link?: boolean;
}

/**
 * The Workbox runtime, which vite-plugin-pwa bundles into the service worker in a build of its own that Rollup's
 * graph here doesn't include.
 */
const SERVICE_WORKER = ['workbox-core', 'workbox-precaching', 'workbox-routing', 'workbox-strategies', 'workbox-window'];

/** Packages for the app outside a build: everything package-lock.json doesn't mark as for development only. */
export function lockedPackages(root: string): string[] {
  const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8')) as { packages: Record<string, LockEntry> };
  return Object.entries(lock.packages)
    .filter(([path, e]) => path && !e.link && !e.dev && !e.devOptional && !e.optional && !e.peer)
    .map(([path]) => join(root, path))
    .concat(SERVICE_WORKER.map((name) => join(root, 'node_modules', name)));
}

/** The folders of the packages a build bundled, from the files in its module graph. */
export function bundledPackages(root: string, moduleIds: Iterable<string>): string[] {
  const dirs = new Set<string>();
  for (const id of moduleIds) {
    const path = id.replace(/\\/g, '/').replace(/^\0/, '').split('?')[0];
    const at = path.lastIndexOf('/node_modules/');
    if (at < 0) continue;
    const rest = path.slice(at + '/node_modules/'.length).split('/');
    const name = rest[0].startsWith('@') ? `${rest[0]}/${rest[1]}` : rest[0];
    dirs.add(`${path.slice(0, at)}/node_modules/${name}`);
  }
  for (const name of SERVICE_WORKER) dirs.add(join(root, 'node_modules', name).replace(/\\/g, '/'));
  return [...dirs];
}

const LICENCE_FILE = /^(licen[cs]e|copying|notice)(\.|-|$)/i;

function licenceText(dir: string): string | undefined {
  if (!existsSync(dir)) return undefined;
  const files = readdirSync(dir)
    .filter((f) => LICENCE_FILE.test(f))
    .sort();
  if (!files.length) return undefined;
  return files
    .map((f) => readFileSync(join(dir, f), 'utf8').replace(/\r\n?/g, '\n').trim())
    .join('\n\n');
}

/** The licence a package's file is, for the few packages that don't name it. */
function knownLicence(text: string): string | undefined {
  if (/^\W*(the )?mit license/i.test(text) || /permission is hereby granted, free of charge/i.test(text)) return 'MIT';
  if (/apache license\s+version 2\.0/i.test(text)) return 'Apache-2.0';
  if (/^\W*(the )?isc license/i.test(text)) return 'ISC';
  return undefined;
}

function authorOf(pkg: { author?: string | { name?: string } }): string | undefined {
  const author = typeof pkg.author === 'string' ? pkg.author : pkg.author?.name;
  // "Jane Doe <jane@example.com> (https://…)": the name is enough.
  return author?.replace(/\s*[<(].*$/, '').trim() || undefined;
}

function homepageOf(pkg: { homepage?: string; repository?: string | { url?: string } }): string | undefined {
  const repo = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
  const url = pkg.homepage ?? repo?.replace(/^git\+/, '').replace(/\.git$/, '').replace(/^git:\/\//, 'https://');
  return url?.startsWith('https://') ? url : undefined;
}

/** The notices for the packages in these folders. */
export function collectLicences(dirs: Iterable<string>): Notices {
  const texts: string[] = [];
  const seen = new Set<string>();
  const packages: ThirdParty[] = [];
  for (const dir of dirs) {
    if (!existsSync(join(dir, 'package.json'))) continue;
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    const name: string = pkg.name;
    // Type packages hold no code, and Orikata isn't a library of its own.
    if (!name || name.startsWith('@types/') || seen.has(`${name}@${pkg.version}`)) continue;
    seen.add(`${name}@${pkg.version}`);
    const file = licenceText(dir);
    const licence: string = (typeof pkg.license === 'string' ? pkg.license : pkg.license?.type) ?? (file && knownLicence(file)) ?? 'See the package';
    const author = authorOf(pkg);
    const text =
      file ??
      `${name} is licensed under ${licence}${author ? `, copyright ${author}` : ''}. The package includes no licence file; see its home page for the full terms.`;
    let index = texts.indexOf(text);
    if (index < 0) index = texts.push(text) - 1;
    packages.push({ name, version: pkg.version ?? '', licence, author, homepage: homepageOf(pkg), text: index });
  }
  packages.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version, undefined, { numeric: true }));
  return { packages, texts };
}

/** Writes the notices into the build, and serves them under `npm run dev`. */
export function thirdPartyLicences(): Plugin {
  let root = process.cwd();
  return {
    name: 'orikata-third-party-licences',
    configResolved(config) {
      root = config.root;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.split('?')[0].endsWith(`/${LICENCES_FILE}`)) return next();
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(collectLicences(lockedPackages(root))));
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: LICENCES_FILE, source: JSON.stringify(collectLicences(bundledPackages(root, this.getModuleIds()))) });
    },
  };
}
