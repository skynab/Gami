import { paper, Recipe, table } from '../../fold/recipe';

/** The fortune teller (cootie catcher): two rounds of folding the corners to the centre. */
export function fortuneTeller() {
  const centre = table(0, 0);
  const corner = (u: number, v: number, title: string, text?: string) => (r: Recipe) => r.onto(paper(u, v), centre, { title, text });

  let r = new Recipe({ id: 'fortune-teller', title: 'Fortune teller', card: 'finished', sheet: { size: [1, 1], front: '#f6f3ec', back: '#e0a526' } })
    .crease(paper(-0.5, -0.5), paper(0.5, 0.5), { title: 'Fold in half diagonally', text: 'White side up. Bring one corner to the opposite corner.' })
    .crease(paper(0.5, -0.5), paper(-0.5, 0.5), { title: 'Fold the other diagonal', text: 'The two creases cross at the centre.' });

  for (const step of [
    corner(-0.5, -0.5, 'Fold a corner to the centre', 'Bring the top-left corner to where the creases cross.'),
    corner(0.5, -0.5, 'Fold the next corner in'),
    corner(0.5, 0.5, 'And the next'),
    corner(-0.5, 0.5, 'And the last one', 'You now have a smaller square.'),
  ]) r = step(r);

  r = r.turnOver('Flip it over, so the folded flaps are underneath.');

  // The corners of the smaller square are the middles of the sheet's edges.
  for (const step of [
    corner(0, -0.5, 'Fold the corners in again', 'Bring each corner of the new square to the centre.'),
    corner(0.5, 0, 'Next corner'),
    corner(0, 0.5, 'Next corner'),
    corner(-0.5, 0, 'Last corner', 'Write numbers on the small triangles, and fortunes under them.'),
  ]) r = step(r);

  return r
    // The finished square runs from −¼ to ¼ each way.
    .crease(table(-0.25, 0), table(0.25, 0), { title: 'Fold in half', text: 'Crease firmly through all the layers.' })
    .crease(table(0, -0.25), table(0, 0.25), { title: 'Fold in half the other way', text: 'Crease this way too.' })
    .turnOver('Turn it over, so the four square pockets are on top.')
    .popUp(
      { title: 'Pop it open', text: 'Push the pockets up and together with your fingers and thumbs, and it’s ready to play.' },
      centre,
      popped(Math.PI / 3),
      // Rising steadily from flat, so the paper opens as one rather than each piece swinging its own way.
      [1, 2, 3, 4, 5].map((k) => popped((Math.PI / 3) * (k / 6))),
    )
    .build();
}

/**
 * The fortune teller opened for play: from the centre, creases along the pockets' diagonals rise to the four
 * points by `steep`, and the creases between pockets rise less, just enough that no paper stretches.
 */
function popped(steep: number) {
  // Neighbouring creases are 45° apart on the paper, and must stay so: a·cos(e) + b·sin(e) = cos 45°.
  const a = Math.cos(steep) * Math.SQRT1_2;
  const b = Math.sin(steep);
  const gentle = Math.atan2(b, a) - Math.acos(Math.SQRT1_2 / Math.hypot(a, b));
  return Array.from({ length: 8 }, (_, k) => ({ azimuth: (k * Math.PI) / 4, elevation: k % 2 ? steep : gentle }));
}
