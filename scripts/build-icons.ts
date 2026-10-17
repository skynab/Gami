/**
 * Draws the app icons (public/*.png) for the web app manifest and iOS home screen. The icon is simple
 * shapes, so it's drawn directly with 4× supersampling and written as PNG with node's zlib; no image
 * libraries needed. Run with `npm run icons` after changing the design (and match public/favicon.svg).
 */
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const INDIGO = [0x4f, 0x46, 0xe5];
const WHITE = [0xff, 0xff, 0xff];

/** Colour at a point of the 32 × 32 design, as [r, g, b, a] (0–255, 0–1). Matches public/favicon.svg. */
function design(x: number, y: number, rounded: boolean, scale: number): [number, number, number, number] {
  // Shrink the folded-corner mark towards the centre for maskable icons, which get cropped to a circle.
  const mx = 16 + (x - 16) * scale;
  const my = 16 + (y - 16) * scale;
  const inSquare = mx >= 8 && mx <= 24 && my >= 8 && my <= 24;
  const upper = inSquare && my <= mx; // the triangle 8,8 → 24,8 → 24,24
  const lower = inSquare && my > mx; // the faint triangle below the diagonal
  let bg: [number, number, number, number] = [...INDIGO, 1] as [number, number, number, number];
  if (rounded && !insideRounded(x, y, 7)) bg = [0, 0, 0, 0];
  if (bg[3] === 0) return bg;
  if (upper) return [...WHITE, 1] as [number, number, number, number];
  if (lower) return INDIGO.map((c, i) => Math.round(c + (WHITE[i] - c) * 0.45)).concat(1) as [number, number, number, number];
  return bg;
}

function insideRounded(x: number, y: number, r: number): boolean {
  const cx = Math.min(Math.max(x, r), 32 - r);
  const cy = Math.min(Math.max(y, r), 32 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function render(size: number, rounded: boolean, scale = 1): Buffer {
  const ss = 4;
  const rows: Buffer[] = [];
  for (let py = 0; py < size; py++) {
    const row = Buffer.alloc(1 + size * 4);
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const [cr, cg, cb, ca] = design(((px + (sx + 0.5) / ss) / size) * 32, ((py + (sy + 0.5) / ss) / size) * 32, rounded, scale);
          r += cr * ca;
          g += cg * ca;
          b += cb * ca;
          a += ca;
        }
      }
      const o = 1 + px * 4;
      row[o] = a ? Math.round(r / a) : 0;
      row[o + 1] = a ? Math.round(g / a) : 0;
      row[o + 2] = a ? Math.round(b / a) : 0;
      row[o + 3] = Math.round((a / (ss * ss)) * 255);
    }
    rows.push(row);
  }
  return png(size, Buffer.concat(rows));
}

function png(size: number, raw: Buffer): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function crc32(buf: Buffer): number {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

const out = new URL('../public/', import.meta.url);
writeFileSync(new URL('icon-192.png', out), render(192, true));
writeFileSync(new URL('icon-512.png', out), render(512, true));
// Maskable and iOS icons fill the square; the platform crops them. The mark shrinks into the safe zone.
writeFileSync(new URL('icon-maskable-512.png', out), render(512, false, 1.45));
writeFileSync(new URL('apple-touch-icon.png', out), render(180, false, 1.2));
console.log('icons written');
