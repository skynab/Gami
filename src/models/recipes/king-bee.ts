import { locate, paper, Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';
import { finishPlane } from './paper-plane';
import { moved } from './waterbomb-base';

/**
 * The king bee, a stubby acrobatic plane: a water bomb base at the top of the sheet, its front flaps folded
 * into a kite, the point folded behind to the bottom, and the kite's tips turned up to stick out in front like a
 * bee's feelers. From a sheet of US letter paper, held upright (8.5 : 11).
 */
export function kingBee() {
  // US letter is 8.5 : 11; 0.77 : 1 is near enough, and exact in a .fold file.
  const w = 0.77;
  const h = 1;
  const [l, r, top, bottom] = [-w / 2, w / 2, -h / 2, h / 2];
  // The square at the top of the sheet: its middle, where the diagonals cross, and its bottom edge.
  const mid = top + w / 2;
  const base = top + w;
  // The kite's sides: from the point, halfway between the triangle's edge and the centre line.
  const kite = (w / 2) * Math.tan(Math.PI / 8);

  const plane = new Recipe({
    id: 'king-bee',
    title: 'King bee',
    sheet: { size: [w, h], front: '#f6f3ec', back: '#f2c230' },
  })
    .crease(paper(l, top), table(r, base), {
      title: 'Fold the top-left corner across',
      text: 'Bring the top-left corner down to the right edge, so the top edge lies along it.',
    })
    .crease(paper(r, top), table(l, base), {
      title: 'Fold the top-right corner across',
      text: 'The same the other way: the top edge along the left edge. The creases cross in an X.',
    })
    .crease(paper(0, top), table(0, base), {
      title: 'Fold the top down',
      text: 'Fold the top edge down so it lines up with the ends of the X. The fold runs through the middle of the X.',
    })
    .collapse(
      {
        title: 'Collapse the top into a triangle',
        text: 'Push the sides of the top square in along the middle fold, so the top folds down into a triangle on the sheet.',
      },
      [
        { through: [table(l, top), table(r, base)], kind: 'valley' },
        { through: [table(r, top), table(l, base)], kind: 'valley' },
        { through: [table(l, mid), table(r, mid)], kind: 'mountain' },
      ],
      paper(0, bottom - 0.1),
    );

  // The kite: each front flap's outer edge folded to the centre line. The flaps are kept for turning up later.
  const flap: Record<number, (c: [number, number]) => boolean> = {};
  for (const s of [1, -1]) {
    flap[s] = moved(plane, () =>
      plane.along(table(0, mid), table(s * kite, base), table(s * (w / 2 - 0.05), base - 0.03), {
        title: s > 0 ? 'Fold the right edge to the middle' : 'Fold the left edge to the middle',
        text:
          s > 0
            ? 'Fold the top flap only: bring the triangle’s right edge in to the centre line. Its corner pokes out below.'
            : 'And the left edge, top flap only. The two flaps make a kite.',
        layers: 2,
      }),
    );
  }

  // The point folds behind to the bottom edge.
  const back = (mid + bottom) / 2;
  const behind = moved(plane, () =>
    plane.along(table(-1, back), table(1, back), table(0, mid + 0.02), {
      title: 'Fold the point behind',
      text: 'Fold the whole top back, so the point meets the bottom edge on the other side. (On A4 paper, stop a little short of the edge.)',
      kind: 'mountain',
    }),
  );

  // The kite's tips, hanging below the triangle's old bottom edge, fold up to stick out past the top. Only the
  // part of each flap still in front: the rest went behind with the point.
  for (const s of [1, -1]) {
    plane.along(table(-1, base), table(1, base), table(s * 0.02, base + 0.02), {
      title: s > 0 ? 'Fold the right tip up' : 'Fold the left tip up',
      text: s > 0 ? 'Fold the kite’s right tip up, so its point sticks out past the top edge.' : 'And the left tip, beside it.',
      only: (c) => flap[s](c) && !behind(c),
    });
  }

  // The extras for tricks: slits cut in the back of the wings, the strip between them bent up as an aileron, and
  // the wingtips turned up. On its side with both wings down, the back edge is at x = 0 and the wings, one on
  // the other, reach down to their tips past the keel.
  const slit = 0.05;
  let extras: { tipLine: number; tip: number; aileron: (c: Vec2) => boolean; a: number; b: number } | undefined;
  return finishPlane(plane, 0.06, 'Fold the top layers down along a line close to the bottom, for broad, square wings.', {
    beforeOpen(p, wings) {
      const tip = Math.max(...p.current.vertices_coords.map((q) => q[2]));
      const span = tip - wings.keel;
      // Two slits across the back of the wings, a third and two thirds of the way out from the keel.
      const [a, b] = [wings.keel + span / 3, wings.keel + (2 * span) / 3];
      // The paper between the slits' lines, all along the wing: the bend at the slits' ends turns only its end.
      const before = p.current;
      const aileron = (c: Vec2) => {
        const z = locate(before, c)[1];
        return z > a && z < b;
      };
      p.cut(table(-0.01, a), table(slit, a), {
        title: 'Cut a slit in the wings',
        text: 'If you like, for tricks: with scissors, cut a short slit in from the back edge, through both wings at once.',
      }).cut(table(-0.01, b), table(slit, b), {
        title: 'Cut another slit',
        text: 'Cut a second slit the same length, further out. The strip between the slits is an aileron.',
      });
      extras = { tipLine: tip - 0.06, tip, aileron, a, b };
    },
    afterOpen(p, wings) {
      if (!extras) return;
      const { tipLine, tip, aileron, a, b } = extras;
      // The wing underneath stays on the table and the other turns right over, so the same turn up in flight is a
      // turn down for one and up for the other here, before the plane is turned over.
      p.shape({ title: 'Fold up the wingtips', text: 'If you like, fold the tip of each wing straight up, on a line parallel to the body.' }, [
        { through: [table(-1, tipLine), table(1, tipLine)], moving: table(0.1, tip - 0.01), degrees: -90, only: wings.firstWing },
        { through: [table(-1, tipLine), table(1, tipLine)], moving: table(0.1, tip - 0.01), degrees: 90, only: wings.secondWing },
      ]).shape({ title: 'Bend up the ailerons', text: 'Bend the strip between each wing’s slits up a little.' }, [
        { through: [table(slit, a), table(slit, b)], moving: table(0, (a + b) / 2), degrees: -30, only: (c) => wings.firstWing(c) && aileron(c) },
        { through: [table(slit, a), table(slit, b)], moving: table(0, (a + b) / 2), degrees: 30, only: (c) => wings.secondWing(c) && aileron(c) },
      ]);
    },
  });
}
