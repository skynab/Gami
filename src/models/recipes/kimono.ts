import { Recipe, table } from '../../fold/recipe';

/** The white collar: its width at the top of each side, and how far down it comes to a point. */
export const COLLAR = 0.06;
export const COLLAR_DOWN = 0.22;

/**
 * A kimono, Gami's own way of folding one (Gilad's database lists traditional kimonos, but this follows neither them
 * nor origami.me's), from one square: the sides folded to the middle for the coloured body, their edges at the top
 * turned back on a slant for a white collar, and their bottom corners folded out and carried up behind, as a
 * dollar-bill shirt's sleeves are, so the sleeves show the coloured side at the shoulders.
 */
export function kimono() {
  const r = new Recipe({ id: 'kimono', title: 'Kimono', sheet: { size: [1, 1], front: '#f4efe4', back: '#b8344a' } }).crease(table(-0.5, 0), table(0.5, 0), {
    title: 'Crease down the middle',
    text: 'Start with the plain side up. Fold the left edge to the right edge, and unfold.',
  });
  const flap = (s: number) => r.lying((p) => s * p[0] > 0.25);
  const flaps = [flap(-1), flap(1)];
  r.together({ title: 'Fold the sides in', text: 'Fold the left and right edges to the middle crease.' }, (q) => {
    for (const s of [-1, 1]) q.edgeOnto([table(s * 0.5, -0.5), table(s * 0.5, 0.5)], [table(0, -0.5), table(0, 0.5)], { title: '' });
  });
  const top = -0.5;
  const collarEnd = top + COLLAR_DOWN;
  r.together(
    { title: 'Fold the collar', text: 'Fold each edge at the middle back out on a slant, a little way at the top and narrowing to nothing lower down: the white collar.' },
    (q) => {
      for (const s of [-1, 1])
        q.along(table(0, collarEnd), table(s * COLLAR, top), table(s * 0.001, top + 0.01), { title: '', only: flaps[(s + 1) / 2] });
    },
  );
  // The sleeves: each flap's bottom inner corner folded out along a line from halfway up the middle to the flap's
  // bottom outer corner, so it sticks out past the side; carried up behind, it shows the coloured side at the shoulder.
  r.together(
    { title: 'Fold the sleeves out', text: 'Fold each bottom corner at the middle out to the side, on a line from halfway up the middle to the bottom outer corner.' },
    (q) => {
      for (const s of [-1, 1]) q.along(table(0, 0), table(s * 0.25, 0.5), table(s * 0.001, 0.49), { title: '', only: flaps[(s + 1) / 2] });
    },
  );
  r.along(table(-1, 0), table(1, 0), table(0, 0.49), {
    title: 'Fold the bottom up behind',
    text: 'Fold the bottom half up behind, so the sleeves come up at the shoulders. Your kimono is done.',
    kind: 'mountain',
  });
  return r.build();
}
