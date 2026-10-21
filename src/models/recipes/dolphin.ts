import { locate, paper, Recipe, table, type At } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';
import { fishBase } from './fish-base';

/**
 * The traditional dolphin, following the order of folds at origami.me/dolphin: a fish base with its flaps
 * turned to one end, that end pleated into a snout, a short cut splitting the other end into the tail's two
 * flukes, then folded in half, the flukes and a fin folded out and the other flap raised as the dorsal fin.
 */
export function dolphin() {
  const r = new Recipe({ id: 'dolphin', title: 'Dolphin', sheet: { size: [1, 1], front: '#f6f3ec', back: '#5b7f9e' } });
  const { h, sheet, onDiamond } = fishBase(r, 'Start white side up, with a corner pointing towards you.');
  r.rotate(-90, { title: 'Turn it', text: 'Turn it a quarter turn, so the two flaps point to the left.' }).turnOver('Turn it over.');
  // Lying flat now: the flap end (the sheet's corner (½, −½)) at (−h, 0) on the left, the tail end at (h, 0).
  const nose = sheet(0, -h);
  const tail = sheet(0, h);
  // The snout: the left point folded to the middle, then back out a quarter of the way to the new edge.
  const flat = r.current;
  r.onto(paper(...nose), table(0, 0), { title: 'Fold the point in', text: 'Fold the left point to the middle.' });
  const folded = r.current;
  const point = (c: Vec2) => Math.hypot(...([0, 1] as const).map((i) => locate(flat, c)[i] - locate(folded, c)[i])) > 1e-6;
  const edge = -h / 2;
  const pleat = edge - edge / 4;
  r.along(table(pleat, -1), table(pleat, 1), table(-0.1, 0), {
    title: 'Fold it back out',
    text: 'Fold the point back to the left, a quarter of the way from the edge to the middle, so a little of it sticks out.',
    only: point,
  });
  // The tail: a short cut along the middle from its point splits it into two flukes.
  r.cut(paper(...tail), table(h - 0.16, 0), {
    title: 'Cut the tail',
    text: 'With scissors, cut a short way along the middle crease from the right point. This makes the two flukes.',
  });
  r.along(table(-1, 0), table(1, 0), table(0.2, 0.1), { title: 'Fold in half', text: 'Fold the bottom half up onto the top half.' });
  // The flukes: each half of the cut tail turns about a 45° line inside the cut, one up and one down. Each
  // half's tip is found where it lies now, and the line runs back from a point 0.13 in from it.
  const half = (s: number) => (c: Vec2) => s * onDiamond(c)[0] > 0 && onDiamond(c)[1] > 0.3;
  const fluke = (s: number, up: boolean, step: { title: string; text: string }) => {
    const tip = r.where(paper(...sheet(s * 0.005, h - 0.01)));
    const back = Math.sign(r.where(paper(0, 0))[0] - tip[0]);
    const base: Vec2 = [tip[0] + back * 0.13, tip[1]];
    return r.along(table(...base), table(base[0] - back, base[1] + (up ? -1 : 1)), table(...tip), { ...step, only: half(s) });
  };
  fluke(1, true, { title: 'Fold up a fluke', text: 'Fold the top layer of the tail up on a slant, inside the cut.' });
  r.turnOver('Turn it over.');
  fluke(-1, false, { title: 'Fold down the other fluke', text: 'Fold the other half of the tail down on a slant, inside the cut.' });

  // The fins: the fish base's two flaps lie one on each side, joined to the body along their crease from P
  // (where the kite creases meet) to the sheet's edge. No flat fold swings one above the back without
  // origami.me's swivel fold, which tears with rigid paper here, so they're bent out from the sides instead.
  const k = h * (Math.SQRT2 - 1);
  const d = (h - k) / 2;
  r.shape({ title: 'Open the fins', text: 'Lift the two flaps out from the sides, for the fins. Your dolphin is done!' },
    [-1, 1].map((s) => ({
      through: [paper(...sheet(s * k, 0)), paper(...sheet(s * (k + d), -d))] as [At, At],
      moving: paper(...sheet(s * h, 0)),
      degrees: 60,
      only: (c: Vec2) => {
        const [x0, z] = onDiamond(c);
        const x = s * x0;
        return x > k - 1e-9 && z > -(x - k) - 1e-9;
      },
    })),
  );
  return r.build();
}
