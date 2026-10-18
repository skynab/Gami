import { paper, Recipe, table } from '../../fold/recipe';

/**
 * Gami's own sword, from a 1 × 4 strip: narrowed to a quarter of its width with a point at the top, then
 * turned sideways by a 45° fold, doubled back across both sides for the crossguard, and turned down again
 * for the handle, with the end folded up for a pommel. Narrowing seals the front inside, so the finished
 * sword is all silver (the back); the gold front shows while folding, which keeps the early steps easy to follow.
 */
export function sword() {
  const r = new Recipe({ id: 'sword', title: 'Sword', sheet: { size: [1, 4], front: '#d9a93a', back: '#c3cad2' } });
  // Half the narrowed strip's width, and how far the guard reaches past the blade on each side.
  const w = 0.125;
  const reach = 0.22;
  // Where the guard's band ends below the blade.
  const gz = 0.05;

  r.crease(paper(-0.5, 0), paper(0.5, 0), {
    title: 'Fold in half lengthwise',
    text: 'Bring the left edge to the right edge, crease, and open it again.',
  })
    .onto(paper(-0.5, -2), table(0, -1.5), { title: 'Fold a corner to the middle', text: 'Fold the top left corner down to the centre crease.' })
    .onto(paper(0.5, -2), table(0, -1.5), { title: 'And the other', text: 'Fold the top right corner to match, making a point.' })
    .onto(paper(-0.5, 0), table(0, 0), { title: 'Fold an edge to the middle', text: 'Fold the left edge to the centre crease, all the way down.' })
    .onto(paper(0.5, 0), table(0, 0), { title: 'And the other', text: 'Fold the right edge to the centre crease.' })
    .onto(table(-0.25, 0), table(0, 0), { title: 'Narrower', text: 'Fold the left edge to the centre once more.' })
    .onto(table(0.25, 0), table(0, 0), { title: 'And the other', text: 'Fold the right edge to the centre. The point gets sharper.' })
    .turnOver('Turn the strip over, so the folds are underneath.');

  // The strip below the blade turns left, folds back right past the other side, then back to the middle.
  r.along(table(-w, gz), table(w, gz - 2 * w), table(0, gz + 0.5), {
    title: 'Turn the strip sideways',
    text: 'Fold the bottom of the strip up to the left at 45°, so it points sideways.',
  });
  r.along(table(-w - reach, -1), table(-w - reach, 1), table(-1, gz - w), {
    title: 'Fold it back',
    text: 'Fold the strip back to the right, a little way out from the blade.',
  });
  r.along(table(w + reach, -1), table(w + reach, 1), table(1, gz - w), {
    title: 'And back again',
    text: 'Fold it back to the left the same distance out on the other side. That’s the crossguard.',
  });
  // The handle: the last stretch of strip (the paper furthest along it, on top beside the blade), turned down
  // where it crosses the middle.
  const last = Math.max(...r.stackAt([w + reach / 2, gz - w]).map((p) => p[1]));
  r.along(table(-w, gz), table(w, gz - 2 * w), table(-w - reach / 2, gz - w), {
    title: 'Turn it down',
    text: 'Fold the end down at 45° where it crosses the blade. That’s the handle.',
    only: ([, v]) => v > last - 1e-6,
  });
  // The pommel: the end of the handle folded up.
  const end = Math.max(...r.current.vertices_coords.map((p) => p[2]));
  r.along(table(-1, end - 0.1), table(1, end - 0.1), table(0, end), {
    title: 'The pommel',
    text: 'Fold the end of the handle up a little. Your sword is ready.',
    only: ([, v]) => v > last - 1e-6,
  });
  return r.build();
}
