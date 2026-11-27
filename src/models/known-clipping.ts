import { REST } from '../fold/collisions';

/**
 * How deep paper may pass through paper, and how far joined paper may come apart, in the built-in models, and the
 * models known to go further: checked by model-checks.ts, and by `npm run models` where a step comes to rest. Each
 * model listed shows as paper poking through paper, or parting, somewhere: to be fixed, not added to. `npm run
 * clip-report` says where.
 */
export { REST };

/**
 * How deep paper may pass through paper as a model plays (a sheet's width is 1, a layer 0.0007): five layers, half a
 * millimetre on a 15 cm sheet (from seven on 20 November 2026, the models between listed below).
 */
export const GRAZE = 0.0035;
/**
 * The models known to go deeper, each a little over what it was measured at (last on 11 November 2026), and where. Bent steps
 * are left to the bending checks: the viewer draws bent paper in its stacking order where layers meet.
 */
export const GRAZES: Record<string, number> = {
  lily: 0.009, // Its squash-and-petal folds, joined up all the way (see collisions.test.ts).
  swan: 0.014, // Pulling up the neck: with rigid paper its body is a closed tube (PLAN.md, milestone 13).
  whale: 0.009, // Opening the fins out in 3D: the lower fin turns up from inside the body (docs/clipping-plan.md).
  dolphin: 0.01, // Opening the fins out in 3D, deepest as they start: the lower fin turns up from inside the body.
  frog: 0.011, // Turning out a back leg, and lifting the front legs against the other front quarter (docs/origami-me-plan.md).
  'masu-shallow-lid': 0.0085, // Raising the walls: riding layers sit a little off the faces they ride on.
  'rainbow-chain': 0.034, // Joining the ends: rigid links set on a ring dip into each other where they cross.
  // The second squash, its twelve layers grazing as they turn (docs/bending-plan.md, step 7).
  boat: 0.0105,
  // Reverse folds, their points tucked in between the flap's halves (November 2026): the point turns as one and
  // settles in between, through about half the stack. Real paper bends a little to open the flap; rigid paper
  // can't without opening it right out (docs/next-tasks-plan.md). Played bent on the way (`bent`, see
  // fold/bend/reverse.ts), they don't: the crane's came off on 26 November 2026. (The seal's tail came off on
  // 11 November: see LANDS in animate.ts.)
  swallow: 0.0095, // The second wing, as the crane's neck and tail (0.0093, 24 November 2026; 0.0066 to 0.01 for other wing angles and heights).
  horse: 0.0085, // The tail and head, through the neck's stack (0.0075 and 0.0080, 25 November 2026; 0.008 whatever the head's angle).
  // The same, found bringing GRAZE down to five layers (20 November 2026).
  // Found looking near the ends of steps and at points tucked through (20 November 2026).
  heart: 0.0095, // Folding the top down: the white side triangles lie on the point it turns up through as it starts.
  seal: 0.007, // Raising the neck, for a moment as it lands.
  // Found looking closer at the ends of steps (20 November 2026), once the snaps there were fixed.
  'folds-lesson': 0.0045, // The open sink, as it closes up, and opening it out (0.0041; the crimp, 0.025 until 26 November 2026, now plays its two reverse folds in turn).
  // Its pinwheel unit's squash, as the pinwheel's was. Bent on the way, as the pinwheel's now is, its five copies
  // (made by replaying the first unit's folding) came apart by half a sheet (26 November 2026).
  chrysanthemum: 0.007,
};

/**
 * The models known to go deeper at rest, each a little over what it was measured at (on 15 November 2026), and
 * where. Each shows as the inside of one piece of paper poking out through another: to be fixed, not added to. The
 * kusudama, T-rex, squirrel and chrysanthemum, 4 to 10 mm through on a 15 cm sheet, came off it the same day; the
 * 3D fox and butterfly on 20 November, and the pirate hat the same day.
 */
export const RESTS: Record<string, number> = {
  'rainbow-chain': 0.017, // Pressing it flat and joining the ends: links dip into each other where they cross.
  'masu-shallow-lid': 0.0022, // Raising and locking the walls: at the inside corners, flaps run out to the corner's line, into the other wall's inner layers.
};

/**
 * How far joined paper may come apart as a model plays, beyond what's apart at a step's ends anyway (the gaps
 * between layers at a fold, paper riding on paper, a cut's two sides): about the thickness of a 14-layer stack,
 * 1.5 mm on a 15 cm sheet. The boat's small diamond once tore by twelve times that, unseen by the checks above.
 */
export const TEAR = 0.01;
/**
 * The models known to come further apart, each a little over what it was measured at, and where. None from
 * 11 November 2026, when the lily, seal, frog and fox were joined up all the way (docs/next-tasks-plan.md), until
 * the checks looked at the last fortieth of each step.
 */
export const TEARS: Record<string, number> = {
  // Found looking at the last fortieth of each step (20 November 2026), where the joins can let go of paper held
  // the way it started, so it jumps into place (docs/clipping-plan.md).
  chrysanthemum: 0.013, // Its pinwheel unit's squash, as the pinwheel's.
  'rainbow-chain': 0.043, // Joining the ends.
  lily: 0.018, // The petal folds, stood up first so they no longer snap down at the end: apart a little on the way.
};
