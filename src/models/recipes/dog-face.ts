import { paper, Recipe, table } from '../../fold/recipe';

/** A dog's face, the traditional first model: a triangle with its corners folded down into floppy ears. */
export function dogFace() {
  // Turned to a diamond, the sheet's corners sit this far from the centre; folded top to bottom, it's a
  // triangle with its folded edge along z = 0 and its point at (0, r).
  const r = Math.SQRT1_2;
  // Where the right ear's tip hangs: below the corner, just outside the head's slanted side.
  const ear: [number, number] = [0.35, 0.5];
  return new Recipe({ id: 'dog-face', title: 'Dog face', sheet: { size: [1, 1], front: '#f6f3ec', back: '#a8703f' } })
    .rotate(45, { title: 'Turn it to a diamond', text: 'Start white side up, and turn the square so a corner points towards you.' })
    .onto(paper(0.5, -0.5), paper(-0.5, 0.5), { title: 'Fold in half', text: 'Bring the top corner down to the bottom corner, making a triangle.' })
    .crease(paper(-0.5, -0.5), paper(0.5, 0.5), { title: 'Crease the middle', text: 'Fold the left corner over to the right one, then unfold, leaving a crease down the middle.' })
    .onto(paper(-0.5, -0.5), table(-ear[0], ear[1]), {
      title: 'Fold down an ear',
      text: 'Fold the left corner down at a slant, so it hangs beside the face.',
    })
    .onto(paper(0.5, 0.5), table(...ear), {
      title: 'Fold down the other ear',
      text: 'Fold the right corner down to match.',
    })
    .along(table(-1, r - 0.14), table(1, r - 0.14), table(0, r), {
      title: 'Fold up the nose',
      text: 'Fold the top layer of the bottom point up a little, for the nose.',
      layers: 1,
    })
    .along(table(-1, r - 0.1), table(1, r - 0.1), table(0, r), {
      title: 'Fold the chin behind',
      text: 'Fold the point that’s left behind, just below the nose.',
      kind: 'mountain',
    })
    .along(table(-1, 0.07), table(1, 0.07), table(0, 0), {
      title: 'Fold the top behind',
      text: 'Fold the top edge behind a little, rounding off the head. Draw on eyes and a nose!',
      kind: 'mountain',
    })
    .build();
}
