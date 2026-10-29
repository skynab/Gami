import { Recipe, table } from '../../fold/recipe';
import type { Vec2 } from '../../fold/types';

/**
 * A knife, Gami's own, from half a square: its long edges folded to the middle twice into a strip, one end's
 * corner folded behind into a slanted tip, and the other end rolled over twice for the handle, coloured in.
 */
export function knife() {
  // The half square lies sideways, its edges at x = ±½ and z = ±¼. Folded to the middle twice it's a strip
  // `w` either side of z = 0; the handle is rolled up from the left end in two turns of `roll`.
  const w = 1 / 16;
  const roll = 0.15;
  const r = new Recipe({ id: 'knife', title: 'Knife', sheet: { size: [1, 0.5], front: '#8d96a0', back: '#c3cad2' } });
  r.together({ title: 'Fold the edges to the middle', text: 'Start dark side up. Fold the top and bottom edges to the middle.' }, (q) => {
    for (const s of [-1, 1]) q.along(table(-1, s / 8), table(1, s / 8), table(0, s * 0.2), { title: '' });
  });
  r.together({ title: 'And again', text: 'Fold the new top and bottom edges to the middle again, making a narrow strip.' }, (q) => {
    for (const s of [-1, 1]) q.along(table(-1, s * w), table(1, s * w), table(0, s * 0.1), { title: '' });
  });
  r.turnOver('Turn the strip over, so the folds are underneath.')
    .along(table(0.5, -w), table(0.5 - 2 * w, w), table(0.49, w - 0.01), {
      title: 'Shape the tip',
      text: 'Fold the bottom right corner behind, so the end lies along the top edge and the top runs out to a point.',
      kind: 'mountain',
    })
    .along(table(-0.5 + roll, -1), table(-0.5 + roll, 1), table(-0.49, 0), {
      title: 'Roll the handle',
      text: 'Fold the left end over onto the strip…',
    })
    .along(table(-0.5 + 2 * roll, -1), table(-0.5 + 2 * roll, 1), table(-0.5 + roll + 0.01, 0), {
      title: 'Roll it again',
      text: '…and over once more. That’s the handle.',
    });
  // The handle, coloured in: the top of the roll, from its fold to the end, in two halves, one each side of the
  // middle, where the strip's edges meet.
  const [a, b] = [-0.5 + 2 * roll + 0.005, -0.5 + 3 * roll - 0.005];
  const half = (s: number): Vec2[] => [
    [a, s * 0.002],
    [b, s * 0.002],
    [b, s * (w - 0.005)],
    [a, s * (w - 0.005)],
  ];
  return r
    .draw({ title: 'Colour the handle', text: 'Colour in the handle with a black pen. Your knife is ready.' }, [{ fill: half(-1) }, { fill: half(1) }])
    .build();
}
