/**
 * Patterned paper, an experiment (docs/paper-textures-plan.md): traditional Japanese motifs printed on the paper's
 * coloured side, as on chiyogami. Each is drawn in code onto a canvas as one tile that repeats without a seam, in
 * two colours worked out from the model's own (so each model keeps its look), with a little grain so it still reads
 * as paper. Nothing is stored as an image: they stay sharp, a few kilobytes in all, and ours to licence. The motifs
 * themselves are centuries old and free of anyone's rights.
 */

export const PATTERNS = ['asanoha', 'seigaiha', 'shippo', 'ichimatsu', 'kikko', 'same', 'sakura', 'washi'] as const;
export type Pattern = (typeof PATTERNS)[number];

export const isPattern = (id: unknown): id is Pattern => PATTERNS.includes(id as Pattern);

/** How many tiles across a sheet's width: on a 15 cm sheet, a tile is 3 cm wide. */
export const ACROSS = 5;

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number, paper: string, ink: string) => void;

/** Each motif: how tall its tile is for its width (the hexagonal ones repeat on a √3 grid), and how it's drawn. */
const MOTIFS: Record<Pattern, { aspect: number; draw: Draw }> = {
  // Hemp leaf: a grid of equilateral triangles, each split into three by lines from its middle to its corners.
  asanoha: {
    aspect: Math.sqrt(3),
    draw(ctx, w, h, _paper, ink) {
      const a = w / 2;
      const rowH = h / 4;
      const at = (i: number, j: number): [number, number] => [i * a + (((j % 2) + 2) % 2) * (a / 2), j * rowH];
      ctx.strokeStyle = ink;
      ctx.lineWidth = w / 110;
      ctx.lineCap = 'round';
      const triangle = (p: [number, number][]) => {
        const c = [(p[0][0] + p[1][0] + p[2][0]) / 3, (p[0][1] + p[1][1] + p[2][1]) / 3];
        ctx.beginPath();
        ctx.moveTo(...p[0]);
        ctx.lineTo(...p[1]);
        ctx.lineTo(...p[2]);
        ctx.closePath();
        for (const q of p) {
          ctx.moveTo(c[0], c[1]);
          ctx.lineTo(...q);
        }
        ctx.stroke();
      };
      for (let j = -1; j <= 4; j++) {
        const up = (((j % 2) + 2) % 2) === 1 ? 1 : 0;
        for (let i = -2; i <= 3; i++) {
          triangle([at(i, j), at(i + 1, j), at(i + up, j + 1)]);
          triangle([at(i + 1, j), at(i + up, j + 1), at(i + up + 1, j + 1)]);
        }
      }
    },
  },
  // Blue sea waves: rows of fanned scales, each of rings, every row overlapping the one behind it.
  seigaiha: {
    aspect: 1,
    draw(ctx, w, _h, paper, ink) {
      const r = w / 4;
      const rings = 4;
      for (let row = -2; row <= 9; row++) {
        const y = row * (r / 2);
        const shift = ((row % 2) + 2) % 2 ? r : 0;
        for (let x = -2 * r + shift; x <= w + 2 * r; x += 2 * r) {
          for (let k = 0; k < rings; k++) {
            ctx.beginPath();
            ctx.arc(x, y, r * (1 - k / rings) - (k ? 0 : w / 300), 0, Math.PI * 2);
            ctx.fillStyle = k % 2 ? paper : ink;
            ctx.fill();
          }
          // A small plain middle, as the waves have.
          ctx.beginPath();
          ctx.arc(x, y, r / (rings * 1.6), 0, Math.PI * 2);
          ctx.fillStyle = ink;
          ctx.fill();
        }
      }
    },
  },
  // Seven treasures: circles on two square grids, each passing through its neighbours' middles, linked like rings.
  shippo: {
    aspect: 1,
    draw(ctx, w, _h, _paper, ink) {
      const a = w / 2;
      const r = a / Math.SQRT2;
      ctx.strokeStyle = ink;
      ctx.lineWidth = w / 80;
      for (let i = -1; i <= 3; i++) {
        for (let j = -1; j <= 3; j++) {
          for (const [x, y] of [
            [i * a, j * a],
            [i * a + a / 2, j * a + a / 2],
          ]) {
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }
    },
  },
  // Checks, as on a kabuki actor's hakama.
  ichimatsu: {
    aspect: 1,
    draw(ctx, w, _h, _paper, ink) {
      ctx.fillStyle = ink;
      ctx.fillRect(0, 0, w / 2, w / 2);
      ctx.fillRect(w / 2, w / 2, w / 2, w / 2);
    },
  },
  // Tortoiseshell: hexagons, each drawn twice, one inside the other.
  kikko: {
    aspect: Math.sqrt(3) / 2,
    draw(ctx, w, h, _paper, ink) {
      // Pointy-topped hexagons: two across the tile, two rows down it.
      const R = w / (2 * Math.sqrt(3));
      const across = Math.sqrt(3) * R;
      ctx.strokeStyle = ink;
      ctx.lineWidth = w / 90;
      ctx.lineJoin = 'round';
      const hex = (cx: number, cy: number, s: number) => {
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const t = Math.PI / 6 + (k * Math.PI) / 3;
          const p: [number, number] = [cx + s * Math.cos(t), cy + s * Math.sin(t)];
          if (k) ctx.lineTo(...p);
          else ctx.moveTo(...p);
        }
        ctx.closePath();
        ctx.stroke();
      };
      for (let row = -1; row <= 3; row++) {
        const y = (row * h) / 2;
        const shift = ((row % 2) + 2) % 2 ? across / 2 : 0;
        for (let col = -1; col <= 3; col++) {
          const x = col * across + shift;
          hex(x, y, R * 0.92);
          hex(x, y, R * 0.68);
        }
      }
    },
  },
  // Shark skin: fine dots in overlapping fans, the samurai's komon, so small it reads as a texture from afar.
  same: {
    aspect: 1,
    draw(ctx, w, _h, paper, ink) {
      const r = w / 4;
      const dot = w / 140;
      for (let row = -2; row <= 9; row++) {
        const y = row * (r / 2);
        const shift = ((row % 2) + 2) % 2 ? r : 0;
        for (let x = -2 * r + shift; x <= w + 2 * r; x += 2 * r) {
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = paper;
          ctx.fill();
          ctx.fillStyle = ink;
          for (let k = 1; k <= 5; k++) {
            const ring = (r * k) / 5.4;
            const n = Math.max(1, Math.round((Math.PI * ring) / (dot * 3.2)));
            // The upper half only: the lower is hidden under the next row.
            for (let m = 0; m <= n; m++) {
              const t = Math.PI + (m / n) * Math.PI;
              ctx.beginPath();
              ctx.arc(x + ring * Math.cos(t), y + ring * Math.sin(t), dot, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }
    },
  },
  // Cherry blossoms, scattered: five notched petals round a small middle, some turned, some smaller.
  sakura: {
    aspect: 1,
    draw(ctx, w, _h, paper, ink) {
      const blossoms: [number, number, number, number][] = [
        [0.18, 0.22, 0.13, 0.2],
        [0.66, 0.12, 0.09, 1.1],
        [0.52, 0.55, 0.15, 0.6],
        [0.12, 0.74, 0.08, 1.7],
        [0.86, 0.68, 0.11, 0.9],
        [0.36, 0.92, 0.06, 0.3],
      ];
      for (const [bx, by, size, turn] of blossoms) {
        for (const dx of [-w, 0, w]) {
          for (const dy of [-w, 0, w]) {
            const cx = bx * w + dx;
            const cy = by * w + dy;
            const s = size * w;
            ctx.fillStyle = ink;
            for (let k = 0; k < 5; k++) {
              const t = turn + (k * 2 * Math.PI) / 5;
              ctx.save();
              ctx.translate(cx, cy);
              ctx.rotate(t);
              // A petal: rounded, with a notch at its tip.
              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.bezierCurveTo(-s * 0.55, -s * 0.25, -s * 0.5, -s * 0.95, -s * 0.12, -s);
              ctx.lineTo(0, -s * 0.84);
              ctx.lineTo(s * 0.12, -s);
              ctx.bezierCurveTo(s * 0.5, -s * 0.95, s * 0.55, -s * 0.25, 0, 0);
              ctx.fill();
              ctx.restore();
            }
            ctx.beginPath();
            ctx.arc(cx, cy, s * 0.16, 0, Math.PI * 2);
            ctx.fillStyle = paper;
            ctx.fill();
          }
        }
      }
    },
  },
  // Plain washi: no motif, just long fibres and flecks in the paper.
  washi: {
    aspect: 1,
    draw(ctx, w, _h, _paper, ink) {
      const random = seeded(7);
      ctx.strokeStyle = ink;
      ctx.lineCap = 'round';
      for (let n = 0; n < 70; n++) {
        const x = random() * w;
        const y = random() * w;
        const length = (0.08 + random() * 0.22) * w;
        const t = random() * Math.PI * 2;
        const bend = (random() - 0.5) * length * 0.8;
        ctx.globalAlpha = 0.25 + random() * 0.45;
        ctx.lineWidth = w / 400 + random() * (w / 260);
        for (const dx of [-w, 0, w]) {
          for (const dy of [-w, 0, w]) {
            const [x0, y0] = [x + dx, y + dy];
            const [x1, y1] = [x0 + Math.cos(t) * length, y0 + Math.sin(t) * length];
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.quadraticCurveTo((x0 + x1) / 2 - Math.sin(t) * bend, (y0 + y1) / 2 + Math.cos(t) * bend, x1, y1);
            ctx.stroke();
          }
        }
      }
      ctx.fillStyle = ink;
      for (let n = 0; n < 120; n++) {
        const [x, y, s] = [random() * w, random() * w, (0.5 + random() * 1.5) * (w / 400)];
        ctx.globalAlpha = 0.3 + random() * 0.4;
        for (const dx of [-w, 0, w]) {
          for (const dy of [-w, 0, w]) {
            ctx.beginPath();
            ctx.arc(x + dx, y + dy, s, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.globalAlpha = 1;
    },
  },
};

/** How tall a pattern's tile is for its width. */
export const aspectOf = (pattern: Pattern) => MOTIFS[pattern].aspect;

/** A pattern drawn on a canvas `width` px wide in the paper's colour, with grain. No three.js here: the gallery's menu draws swatches with it. */
export function patternCanvas(pattern: Pattern, colour: string, width = 512): HTMLCanvasElement {
  const { aspect, draw } = MOTIFS[pattern];
  const height = Math.round(width * aspect);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const paper = colour;
  const ink = inkFor(colour, pattern);
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, width, height);
  draw(ctx, width, height, paper, ink);
  // The grain: every pixel a little lighter or darker, the same each time. Per pixel, so it can't show a seam.
  const img = ctx.getImageData(0, 0, width, height);
  const random = seeded(11);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 0.93 + random() * 0.07;
    img.data[i] *= v;
    img.data[i + 1] *= v;
    img.data[i + 2] *= v;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/**
 * Which side of a sheet to print on: the coloured one, the one further from white. Null if both are near white
 * (nothing to print in), or if both are coloured about as much, which is picked by the back (most models are
 * folded white side up, coloured side down).
 */
export function printedSide(front: string, back: string): 'front' | 'back' | null {
  const [f, b] = [colourfulness(front), colourfulness(back)];
  if (Math.max(f, b) < 0.12) return null;
  return f > b + 0.05 ? 'front' : 'back';
}

/** How far a colour is from white, 0–1, by its darkness and its saturation together. */
function colourfulness(hex: string): number {
  const [r, g, b] = rgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return Math.max(1 - max, max - min) + (1 - (r + g + b) / 3) * 0.5;
}

/** The pattern's second colour: the paper's, lighter on dark paper and darker on light, a little less for washi. */
function inkFor(colour: string, pattern: Pattern): string {
  const [r, g, b] = rgb(colour);
  const light = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const amount = pattern === 'washi' ? 0.35 : light < 0.5 ? 0.32 : 0.24;
  const to = light < 0.5 ? 1 : 0;
  const mix = (c: number) => Math.round((c + (to - c) * amount) * 255);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  const n = parseInt(full.slice(0, 6), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** A random sequence, the same every time for the same seed (mulberry32). */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
