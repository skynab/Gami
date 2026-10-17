import { paper, Recipe, table } from '../../fold/recipe';

/** The fortune teller (cootie catcher): two rounds of folding the corners to the centre. */
export function fortuneTeller() {
  const centre = table(0, 0);
  const corner = (u: number, v: number, title: string, text?: string) => (r: Recipe) => r.onto(paper(u, v), centre, { title, text });

  let r = new Recipe({ id: 'fortune-teller', title: 'Fortune teller', sheet: { size: [1, 1], front: '#e0a526', back: '#f6f3ec' } })
    .crease(paper(-0.5, -0.5), paper(0.5, 0.5), { title: 'Fold in half diagonally', text: 'Bring one corner to the opposite corner.' })
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
    .crease(table(0, -0.25), table(0, 0.25), {
      title: 'Fold in half the other way',
      text: 'Turn it over, push the four corner pockets up with your fingers and thumbs, and it’s ready to play.',
    })
    .build();
}
