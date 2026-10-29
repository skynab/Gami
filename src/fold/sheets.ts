import type { FoldFrame, OrigamiModel, Sheet, Vec2, Vec3 } from './types';

/** Which of a model's sheets a face belongs to, from its corners in sheet coordinates. */
export function sheetOf(sheets: Sheet[], paper: Vec2[]): number {
  if (sheets.length === 1) return 0;
  const u = paper.reduce((s, p) => s + p[0], 0) / paper.length;
  const v = paper.reduce((s, p) => s + p[1], 0) / paper.length;
  const i = sheets.findIndex(({ size, origin = [0, 0] }) => Math.abs(u - origin[0]) <= size[0] / 2 + 1e-9 && Math.abs(v - origin[1]) <= size[1] / 2 + 1e-9);
  return Math.max(0, i);
}

/** The colour a face shows from above. */
export function faceColour(model: Pick<OrigamiModel, 'sheets'>, paper: Vec2[], frontUp: boolean): string {
  const sheet = model.sheets[sheetOf(model.sheets, paper)];
  return frontUp ? sheet.front : sheet.back;
}

/**
 * The unfolded sheets lying flat on the table, front up: each centred at `at` (by default, at its own origin
 * in sheet coordinates). Sheets put down where others lie make a pile, each on top of the ones before it.
 */
export function startFrame(sheets: (Sheet & { at?: Vec2 })[]): FoldFrame {
  const vertices_paper: Vec2[] = [];
  const vertices_coords: Vec3[] = [];
  const faces_vertices: number[][] = [];
  const faces_layer: number[] = [];
  const spans: [number, number, number, number][] = [];
  for (const s of sheets) {
    const [w, h] = s.size;
    const [ax, az] = s.at ?? s.origin ?? [0, 0];
    const span: [number, number, number, number] = [ax - w / 2, ax + w / 2, az - h / 2, az + h / 2];
    const below = spans.flatMap((o, i) => (o[0] < span[1] && span[0] < o[1] && o[2] < span[3] && span[2] < o[3] ? [faces_layer[i]] : []));
    faces_layer.push(below.length ? Math.max(...below) + 1 : 0);
    spans.push(span);
  }
  for (const s of sheets) {
    const [w, h] = s.size;
    const [ou, ov] = s.origin ?? [0, 0];
    const [ax, az] = s.at ?? [ou, ov];
    const base = vertices_paper.length;
    for (const [du, dv] of [[-w / 2, h / 2], [w / 2, h / 2], [w / 2, -h / 2], [-w / 2, -h / 2]]) {
      vertices_paper.push([ou + du, ov + dv]);
      vertices_coords.push([ax + du, 0, az + dv]);
    }
    faces_vertices.push([base, base + 1, base + 2, base + 3]);
  }
  return { vertices_paper, vertices_coords, faces_vertices, ...(faces_layer.some(Boolean) && { faces_layer }) };
}

/**
 * Sheets for a model made in the Studio: each gets its own patch of sheet coordinates, and they start in a
 * row on the table, a little apart, centred.
 */
export function layOut(sheets: Sheet[], gap = 0.25): { sheets: Sheet[]; start: FoldFrame } {
  // A single sheet keeps the plain coordinates older drafts and files use.
  if (sheets.length === 1) {
    const { origin: _, ...sheet } = sheets[0];
    return { sheets: [sheet], start: startFrame([sheet]) };
  }
  const placed = sheets.map((s, i) => ({ ...s, origin: [10 * i, 0] as Vec2 }));
  let x = -(placed.reduce((sum, s) => sum + s.size[0], 0) + gap * (placed.length - 1)) / 2;
  const onTable = placed.map((s) => {
    const at: Vec2 = [x + s.size[0] / 2, 0];
    x += s.size[0] + gap;
    return { ...s, at };
  });
  return { sheets: placed, start: startFrame(onTable) };
}
