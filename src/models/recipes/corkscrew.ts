import { paper, Recipe, table, type At } from '../../fold/recipe';
import { foldWings } from './paper-plane';

/**
 * The corkscrew, Gami's own stunt plane: the classic dart's nose folds on a wider sheet, so the edges reach
 * nearly to the back and leave a long needle nose with swept wings; a notch reverse-folded into the tail, and
 * the wingtips bent opposite ways so it rolls as it flies. After the look of Fold'N Fly's Spin Plane, folded
 * differently. From a sheet of US letter paper, held upright (8.5 : 11).
 */
export function corkscrew() {
  // US letter is 8.5 : 11; 0.77 : 1 is near enough, and exact in a .fold file.
  const w = 0.77;
  const h = 1;
  const [l, r, top] = [-w / 2, w / 2, -h / 2];
  // A top corner folded to the centre line lands this far down from the top edge.
  const corner = top + w / 2;
  // The slanted edge from the first folds, swung onto the centre line, reaches this far down.
  const edge = top + Math.hypot(w / 2, w / 2);
  // The notch in the tail, and how far the wingtips bend.
  const notch = 0.07;
  const tipBend = 25;

  const plane = new Recipe({
    id: 'corkscrew',
    title: 'Corkscrew',
    sheet: { size: [w, h], front: '#f6f3ec', back: '#6a4c93' },
  })
    .crease(paper(l, 0), paper(r, 0), {
      title: 'Fold in half lengthwise',
      text: 'Bring the left edge over to the right edge and crease down the middle.',
    })
    .onto(paper(l, top), table(0, corner), {
      title: 'Fold the top-left corner to the middle',
      text: 'Line the top edge up with the centre crease.',
    })
    .onto(paper(r, top), table(0, corner), {
      title: 'Fold the top-right corner to the middle',
      text: 'The two corners meet on the centre crease, making a point at the top.',
    })
    .onto(paper(l, corner), table(0, edge), {
      title: 'Fold the left edge to the middle',
      text: 'Bring the slanted left edge in to the centre crease. On this wider paper the fold runs nearly to the bottom.',
    })
    .onto(paper(r, corner), table(0, edge), {
      title: 'Fold the right edge to the middle',
      text: 'Match the left side, for a long, thin point.',
    });
  const right = plane.lying(([x]) => x > 0);
  plane
    .along(table(0, -1), table(0, 1), table(-0.1, 0), {
      title: 'Fold in half behind',
      text: 'Mountain-fold along the centre crease, so the folds stay on the outside.',
      kind: 'mountain',
    })
    .rotate(90, { title: 'Turn it on its side', text: 'Point the nose to the left, with the long folded edge at the bottom.' });

  // The notch: the back corner of the keel, turned up inside the body.
  const keel = Math.max(...plane.current.vertices_coords.map((p) => p[2]));
  const back = Math.max(...plane.current.vertices_coords.map((p) => p[0]));
  const cut: [At, At] = [table(back - notch, keel), table(back, keel - notch)];
  plane
    .along(...cut, table(back - 0.01, keel - 0.005), {
      title: 'Crease the tail',
      text: 'Fold the bottom corner at the back up along a slanting line, through all the layers, and crease it well.',
    })
    .unfold({ title: 'Unfold', text: 'Fold it back down.' })
    .collapse(
      {
        title: 'Reverse-fold the tail',
        text: 'Open the layers a little and push the corner up between them along the crease. Seen from above, the tail now has a notch.',
        kind: 'reverse',
      },
      [{ through: cut, kind: 'inside' }],
      paper(0.2, 0.1),
    );

  // The wingtips: with both wings down, their outer corners reach past the keel. A strip of each, parallel to
  // the body, bends the same way here, which in flight is up on one wing and down on the other.
  let tips: { line: number; tip: number } | undefined;
  return foldWings(
    plane,
    0.02,
    'Fold the top layers down along a line from the nose to the back edge, a little further up at the back, for swept wings.',
    right,
    (c) => !right(c),
    {
      tail: 0.12,
      beforeOpen(p) {
        const tip = Math.max(...p.current.vertices_coords.map((q) => q[2]));
        tips = { line: tip - 0.05, tip };
      },
      afterOpen(p, wings) {
        if (!tips) return;
        const { line, tip } = tips;
        p.shape({ title: 'Bend the wingtips', text: 'Bend the tip of one wing up and the other down, a little, along lines parallel to the body. They make it roll.' }, [
          { through: [table(-1, line), table(1, line)], moving: table(0.1, tip - 0.01), degrees: tipBend, only: wings.firstWing },
          { through: [table(-1, line), table(1, line)], moving: table(0.1, tip - 0.01), degrees: tipBend, only: wings.secondWing },
        ]);
      },
      flyText: 'Turn the plane over, so it stands on its keel with its wings on top. Throw it gently: it corkscrews as it flies.',
    },
  );
}
