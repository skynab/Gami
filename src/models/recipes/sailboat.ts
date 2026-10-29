import { Recipe, table } from '../../fold/recipe';

/**
 * A sailboat, Gami's own: the bottom edge folded up for a coloured hull, the top left half folded behind for a
 * white sail (its point tucked up out of sight), and the hull's ends folded behind at a slant for the bow and stern.
 */
export function sailboat() {
  // The hull: the bottom edge folded up on the line z = keel, so it reaches up to z = deck.
  const keel = 0.35;
  const deck = 2 * keel - 0.5;
  // The sail's slanted edge, from the deck's left end (a hair above it, to miss the hull) to the top right corner.
  const boom = deck - 0.01;
  // How far in the bow and stern slant, along the keel.
  const bow = 0.12;
  const stern = 0.07;

  return new Recipe({ id: 'sailboat', title: 'Sailboat', sheet: { size: [1, 1], front: '#f6f3ec', back: '#d8463b' } })
    .along(table(-1, keel), table(1, keel), table(0, 0.45), {
      title: 'Fold up the hull',
      text: 'Start white side up. Fold the bottom edge up, about a sixth of the way, so the coloured side shows: the hull.',
    })
    .along(table(-0.5, boom), table(0.5, -0.5), table(-0.45, -0.45), {
      title: 'Fold the top left behind',
      text: 'Fold the top left half behind, on a line from the left end of the hull’s top edge to the top right corner. That leaves a white sail.',
      kind: 'mountain',
    })
    .along(table(-1, keel), table(1, keel), table(0.15, keel + 0.05), {
      title: 'Tuck the point behind',
      text: 'Behind, the half you folded pokes out below the hull. Fold its point up behind, level with the bottom of the hull.',
      kind: 'mountain',
      only: ([u, v]) => v < boom - (1 + boom) * (u + 0.5),
    })
    .along(table(-0.5, deck), table(-0.5 + bow, keel), table(-0.49, keel - 0.01), {
      title: 'Shape the bow',
      text: 'Fold the hull’s left end behind at a slant, for the bow.',
      kind: 'mountain',
    })
    .along(table(0.5, deck), table(0.5 - stern, keel), table(0.49, keel - 0.01), {
      title: 'Shape the stern',
      text: 'Fold the right end behind too, a little less. Ready to sail!',
      kind: 'mountain',
    })
    .build();
}
