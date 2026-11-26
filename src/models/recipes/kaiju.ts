import { paper, Recipe, table } from '../../fold/recipe';
import type { Vec2, Vec3 } from '../../fold/types';

/** How much of the body's point turns out for the head, and how far below level the head points, in degrees. */
const HEAD = 0.24;
const HEAD_DOWN = 10;
/** Where an eye goes on the head, before it turns: across from the back, and down from where it turns. */
const EYE: Vec2 = [0.03, 0.06];
/** The back plates: each square's side, from the lowest up; they stand in a row up the back below the head. */
const PLATES = [0.1, 0.11, 0.085];
const PLATE_GAP = 0.006;
/** The arms: half the diagonal of their square, how high up the chest they sit, and how far below level they point. */
const ARM = 0.09;
const ARM_UP = 0.5;
const ARM_DOWN = 35;

/**
 * A kaiju, Gami's own generic monster, standing upright in 3D. The body is a big kite with its top corner folded
 * behind, so it stands on a straight edge, then folded in half: a tall column, straight up the back and its chest
 * sloping in to the top, where the point is turned out forwards with an outside reverse fold for the head. The tail
 * is a second kite folded in half, lying behind on the table and rising to the back. A row of three small squares,
 * each folded in half into a triangle, stands up the back for its plates.
 *
 * The body's sides stay closed: the head is wrapped round both, so opening them would tear it. Everything lies in
 * the body's middle plane, so the pieces meet edge to edge: the tail just behind the body's back, the plates
 * standing on it, and a small kite folded in half, as the unicorn's horn, jutting from the chest for its arms.
 */
export function kaiju() {
  // Half the diagonal of each square: the body and the tail.
  const k = Math.SQRT1_2;
  const t = 0.4;
  // Folded into kites, the squares show their backs.
  const hide = { front: '#8fae94', back: '#3d5c4c' };
  // The tail's top shows its front once it's a kite, so it's dark on both sides.
  const tailColours = { front: '#4a6b5b', back: '#3d5c4c' };
  const bone = { front: '#ece4ca', back: '#d4c8a2' };
  const r = new Recipe({
    id: 'kaiju',
    title: 'Kaiju',
    sheets: [
      { size: [1, 1], ...hide, origin: [0, 0], at: [0, 0] },
      { size: [t * Math.SQRT2, t * Math.SQRT2], ...tailColours, origin: [10, 0], at: [1.05, -0.2] },
      ...PLATES.map((s, i) => ({ size: [s, s] as Vec2, ...bone, origin: [20 + 10 * i, 0] as Vec2, at: [0.85 + 0.2 * i, 0.55] as Vec2 })),
      { size: [ARM * Math.SQRT2, ARM * Math.SQRT2], ...tailColours, origin: [50, 0], at: [1.55, -0.45] },
    ],
  });
  const body = ([u]: Vec2) => u < 5;
  const tail = ([u]: Vec2) => u > 5 && u < 15;
  const plates = PLATES.map((_, i) => ([u]: Vec2) => u > 15 + 10 * i && u < 25 + 10 * i);
  const arms = ([u]: Vec2) => u > 45;

  // The body, tail and arms: turned to diamonds, creased down the middle and folded into kites together.
  const kites = [body, tail, arms];
  r.together({ title: 'Start with three diamonds', text: 'Take the big square, light side up, the middle-sized one and the little dark one, and turn each so a corner points towards you.' }, (q) => {
    for (const only of kites) q.move({ title: '' }, only, { degrees: 45 });
  });
  const centres = [0, 10, 50].map((u) => r.where(paper(u, 0)));
  const halves = [k, t, ARM];
  r.together({ title: 'Fold the diamonds in half', text: 'Fold each diamond’s left corner over to its right corner.' }, (q) => {
    kites.forEach((only, i) => {
      const [x, z] = centres[i];
      q.onto(table(x - halves[i], z), table(x + halves[i], z), { title: '', only });
    });
  });
  r.unfold({ title: 'Unfold', text: 'Open them back up, leaving a crease down the middle of each.' });
  r.together({ title: 'Fold them into kites', text: 'Fold each diamond’s lower edges to its middle crease.' }, (q) => {
    kites.forEach((only, i) => {
      const [x, z] = centres[i];
      const d = halves[i];
      for (const s of [-1, 1]) q.edgeOnto([table(x, z + d), table(x + s * d, z)], [table(x, z + d), table(x, z - d)], { title: '', only });
    });
  });

  // The body: its top corner folded behind along the line between its side corners, so it stands on that edge, then
  // folded in half: its fold is the back, its long point the head.
  const [bx, bz] = centres[0];
  const base = bz + k * (1 - Math.SQRT2);
  r.along(table(bx - 1, base), table(bx + 1, base), table(bx, bz - k), {
    title: 'Fold the body’s top behind',
    text: 'Fold the big kite’s top corner behind, along a line between its side corners. This edge is what it stands on.',
    kind: 'mountain',
    only: body,
  });
  r.together({ title: 'Fold them in half', text: 'Fold the left half of the body, the tail and the arms behind, along their middle creases.' }, (q) => {
    kites.forEach((only, i) => {
      const [x, z] = centres[i];
      q.along(table(x, z - 2), table(x, z + 2), table(x - 0.1, z), { title: '', kind: 'mountain', only });
    });
  });

  // The head: the point turned out round the outside, along the line halving straight on (down the table, up once
  // it stands) and where the head points: forwards and, once it stands, a little down (a little up the table).
  const tipZ = bz + k;
  const root: Vec2 = [bx, tipZ - HEAD];
  const a = (HEAD_DOWN * Math.PI) / 180;
  const headTable: Vec2 = [Math.cos(a), -Math.sin(a)];
  r.collapse(
    {
      title: 'Outside-reverse-fold the head',
      text: 'Open the body’s point a little and wrap it round the outside, so it points the other way: forwards, and a little down once it stands. This is the head.',
      kind: 'reverse',
    },
    [{ through: [table(...root), table(root[0] + headTable[0], root[1] + 1 + headTable[1])], kind: 'outside', only: body }],
    r.sheetAt([bx + 0.05, base + 0.05], body),
  );

  // An eye on each side of the head: where a point of the point lands once it's turned, reflected in its line.
  const uLen = Math.hypot(headTable[0], 1 + headTable[1]);
  const u: Vec2 = [headTable[0] / uLen, (1 + headTable[1]) / uLen];
  const turned = ([x, z]: Vec2): Vec2 => {
    const [vx, vz] = [x - root[0], z - root[1]];
    const dot = vx * u[0] + vz * u[1];
    return [root[0] + 2 * dot * u[0] - vx, root[1] + 2 * dot * u[1] - vz];
  };
  const ring = ([x, z]: Vec2, radius: number): Vec2[] => Array.from({ length: 12 }, (_, i) => [x + radius * Math.cos((i * Math.PI) / 6), z + radius * Math.sin((i * Math.PI) / 6)]);
  const eye = turned([bx + EYE[0], root[1] + EYE[1]]);
  const eyePaper = r.sheetAt(eye, body);
  r.draw({ title: 'Draw an eye', text: 'Draw a fierce eye on the head.' }, [{ fill: ring(eye, 0.016) }]);
  r.move({ title: 'Turn the body over', text: 'Turn the body over, left to right.' }, body, { flip: true });
  r.draw({ title: 'Draw the other eye', text: 'And an eye on this side.' }, [{ fill: ring(r.where(eyePaper), 0.016) }]);
  r.move({ title: 'Turn it back', text: 'Turn the body back over.' }, body, { flip: true });

  // The plates: three small squares, as diamonds, folded in half top to bottom into triangles.
  r.together({ title: 'Start the plates', text: 'Take the three little squares, pale side up, and turn each so a corner points towards you.' }, (q) => {
    for (const only of plates) q.move({ title: '' }, only, { degrees: 45 });
  });
  const plateCentres = PLATES.map((_, i) => r.where(paper(20 + 10 * i, 0)));
  r.together({ title: 'Fold the plates in half', text: 'Fold each little diamond in half, top corner down to the bottom one, into a triangle.' }, (q) => {
    plates.forEach((only, i) => {
      const [x, z] = plateCentres[i];
      const s = PLATES[i] * Math.SQRT1_2;
      q.onto(table(x, z - s), table(x, z + s), { title: '', only });
    });
  });

  // Standing up: the body on its straight edge, the table's +z going up and x forwards (x × up is z).
  const world = ([x, z]: Vec2): Vec3 => [x - bx, z - base + 0.003, 0];
  // The tail: its kite's half, wide end T against the back, tilted so its side corner and its tip rest on the table:
  // its fold rises 22.5° to T. The table's z (down the fold) goes back and down, its x (out to the side corner)
  // forwards and down.
  const [tx, tz] = centres[1];
  const rise = Math.PI / 8;
  const tHigh = 2 * t * Math.sin(rise) + 0.003;
  // The plates: each one's fold up the back (the table's x going up), its point out behind (z going back).
  // The arms: their kite's half, wide end just in front of the chest, its fold (the table's z) pointing forwards and
  // down, its side corner (the table's x) below.
  const [ax, az] = centres[2];
  const armA = (ARM_DOWN * Math.PI) / 180;
  // Where the chest is, that high up: it slopes from the side corner at the bottom in to the point.
  const chestX = (Math.SQRT2 - 1) * (1 - ARM_UP);
  const plateRow = PLATES.reduce((sum, s) => sum + s * Math.SQRT2 + PLATE_GAP, 0);
  const lowest = tipZ - HEAD - 0.01 - plateRow;
  return r
    .assemble({ title: 'Stand it up', text: 'Stand the body up on its straight edge, its back upright and the head looking ahead.' }, [
      { only: body, pose: { from: table(bx, base), to: world([bx, base]), x: [1, 0, 0], up: [0, 0, -1] } },
    ])
    .assemble({ title: 'Put the tail on', text: 'Lay the tail behind, its fold on top, rising from the table to the back of the body.' }, [
      { only: tail, pose: { from: table(tx, tz - t), to: [-0.004, tHigh, 0], x: [Math.sin(rise), -Math.cos(rise), 0], up: [0, 0, 1] } },
    ])
    .assemble({ title: 'Put the arms on', text: 'Set the arms on the chest, halfway up, pointing forwards and down.' }, [
      { only: arms, pose: { from: table(ax, az - ARM), to: [chestX + 0.03, ARM_UP, 0], x: [-Math.sin(armA), -Math.cos(armA), 0], up: [0, 0, -1] } },
    ])
    .assemble({ title: 'Put the plates on', text: 'Stand the plates up the back, their folds against it and their points out behind, the biggest in the middle. Roar!' }, [
      ...PLATES.map((size, i) => {
        const below = PLATES.slice(0, i).reduce((sum, s) => sum + s * Math.SQRT2 + PLATE_GAP, 0);
        const w = world([bx, lowest + below + (size * Math.SQRT2) / 2]);
        return { only: plates[i], pose: { from: table(...plateCentres[i]), to: [w[0] - 0.003, w[1], 0] as Vec3, x: [0, 1, 0] as Vec3, up: [0, 0, -1] as Vec3 } };
      }),
    ])
    .build();
}
