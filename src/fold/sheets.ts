import type { OrigamiModel, Sheet, Vec2 } from './types';

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
