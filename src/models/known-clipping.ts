import { BREAK } from '../fold/breaks';
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
 * millimetre on a 15 cm sheet (from seven on 20 November 2026, the steps between listed below).
 */
export const GRAZE = 0.0035;
/**
 * The steps known to go deeper, by model and step (1-based), each a little over what it was measured at, looking
 * every hundredth of the way through (last on 27 November 2026, when the checks first looked step by step and that
 * closely: until then a model's entry covered all its steps, hiding the boat's first squash, the whale's tail and
 * the frog's legs behind other steps, and samples every tenth stepped over grazes peaking between them). Bent
 * steps are left to the bending checks: the viewer draws bent paper in its stacking order where layers meet.
 */
export const GRAZES: Record<string, Record<number, number>> = {
  // Its squash-and-petal folds, joined up all the way (see collisions.test.ts).
  lily: { 22: 0.007, 25: 0.006, 28: 0.011, 31: 0.008 },
  // Pulling up the neck: with rigid paper its body is a closed tube (PLAN.md, milestone 13).
  swan: { 13: 0.014 },
  // Turning the tail up, an outside reverse fold: its lower layers go over the top with the rest, and come down
  // through the body to their place beneath it. Opening the fins out in 3D: the lower fin turns up from inside the
  // body (docs/clipping-plan.md).
  whale: { 21: 0.0075, 22: 0.009 },
  // Opening the fins out in 3D, deepest as they start: the lower fin turns up from inside the body.
  dolphin: { 24: 0.01 },
  // Lifting the front legs against the other front quarter, turning out the back legs, and bending the legs
  // (docs/origami-me-plan.md).
  frog: { 44: 0.01, 45: 0.011, 46: 0.0095, 47: 0.01, 48: 0.01, 49: 0.0075, 50: 0.0055 },
  // Raising the walls: riding layers sit a little off the faces they ride on.
  'masu-shallow-lid': { 30: 0.008 },
  // Pressing it flat and joining the ends: rigid links set on a ring dip into each other where they cross.
  'rainbow-chain': { 13: 0.0285, 14: 0.024, 15: 0.0505 },
  // The first squash, tucking one end of the strip under the other: the back end reaches past the diagonal the
  // back triangle turns about, which runs through where the ends overlap (docs/clipping-plan.md, Progress). The
  // second squash, its twelve layers grazing as they turn (docs/bending-plan.md, step 7), and pulling it out into
  // a boat, for a moment as it starts.
  boat: { 8: 0.012, 13: 0.0105, 14: 0.004 },
  // Reverse folds, their points tucked in between the flap's halves (November 2026): the point turns as one and
  // settles in between, through about half the stack. Real paper bends a little to open the flap; rigid paper
  // can't without opening it right out (docs/next-tasks-plan.md). Played bent on the way (`bent`, see
  // fold/bend/reverse.ts), most don't; the crane's neck and the swallow's second wing, bent, still just over
  // between the old samples (0.0037; no mesh or number of frames tried took them under, 27 November 2026).
  horse: { 30: 0.008, 31: 0.008 }, // The tail and head, through the neck's stack (whatever the head's angle).
  crane: { 27: 0.004 },
  swallow: { 28: 0.004 },
  // Folding the top down: the white side triangles lie on the point it turns up through as it starts.
  heart: { 12: 0.013 },
  // Raising the neck, for a moment as it lands; turning the tail and head, and opening the flippers.
  seal: { 17: 0.007, 18: 0.005, 19: 0.004, 20: 0.005 },
  // The open sink, as it closes up, and opening it out (the crimp, 0.025 until 26 November 2026, now plays its
  // two reverse folds in turn).
  'folds-lesson': { 65: 0.0045, 66: 0.0045 },
  // Its pinwheel unit's squash, as the pinwheel's was. Bent on the way, as the pinwheel's now is, its five copies
  // (made by replaying the first unit's folding) came apart by half a sheet (26 November 2026).
  chrysanthemum: { 10: 0.007, 11: 0.007 },
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

/**
 * How far joined paper may be apart where a step comes to rest, as the viewer draws it, other than stacked layers'
 * gaps at a fold (see fold/breaks.ts): as far as `TEAR`. Until 27 November 2026 nothing looked, and the king bee's
 * body stood 6 mm clear of its wings once they opened, every plane's a little (see `between` in fold/shape.ts).
 */
export { BREAK };
/**
 * The models known to come further apart at rest, each a little over what it was measured at (on 27 November 2026),
 * and where. Each shows as paper floating off the paper it's folded from: to be fixed, not added to. `npm run
 * break-report` says where.
 */
export const BREAKS: Record<string, number> = {
  // Opening the wings: the body stands on its wings, as thick as the thicker, its layers either side of the hinge,
  // but the wings are many layers thick there (20 to 37), and their bottom layers are joined to the body's foot.
  'fast-glider': 0.0275,
  'navy-plane': 0.015,
  kestrel: 0.011,
  // Opening the fins and flippers: each turns up 60° with its foot as high as its flat stack's top was, above the
  // paper it's joined to (as the planes' bodies were, before 27 November 2026).
  dolphin: 0.018,
  seal: 0.0175,
  whale: 0.0142,
  // Curling the petals out and spreading the wings, each in rows turned by bends of their own: the rows stand off
  // their neighbours by different numbers of layers.
  dragon: 0.0202,
  lily: 0.0125,
  // Pressing it flat and joining the ends: rigid links set on a ring, where they hook into each other.
  'rainbow-chain': 0.011,
};

/**
 * The steps (1-based) known to have paper lying right on other paper, no gap between, as each comes to rest: the
 * paper underneath shows through the paper on top, its crease lines or its other side, from close up as from far
 * off (see viewer/depth.ts). Found 27 November 2026, when the check first looked; to be fixed, not added to. Paper
 * a layer's gap apart stays hidden from as far off as the camera goes.
 */
export const SHOWING: Record<string, number[]> = {
  // Popping up: the pleats pressed back to back, each a face's two halves.
  diamond: [7],
  strawberry: [12, 13],
  pyramid: [6],
  // Raising the walls: the corners, pinched into ears, lie on the walls.
  'masu-box': [20, 21, 22],
  'masu-lid': [20, 21, 22],
  'masu-shallow-lid': [30, 31, 32],
  'pot-plant': [28, 29, 30, 31, 32],
  'cute-whale': [24, 25, 26],
  // The wingtips turned up: the second wing's two layers at the tip stand back to back, lifted as if lying flat.
  'king-bee': [19, 20],
  // Pressing it flat: two links lying on one another.
  'rainbow-chain': [14],
};
