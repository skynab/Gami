/**
 * Gallery listing for the built-in models. Step data lives in public/models/<id>.fold, generated from
 * src/models/recipes. Models without `steps` are listed as coming soon.
 */

import type { Category, Difficulty, Tool } from '../fold/types';
export type { Category, Difficulty, Tool } from '../fold/types';

export type Level = 'easy' | 'medium' | 'hard';

export interface ModelInfo {
  id: string;
  title: string;
  blurb: string;
  difficulty: Difficulty;
  category: Category;
  /** Number of steps, once the model's instructions exist. */
  steps?: number;
  minutes: number;
  /** Number of sheets of paper. The ninja star uses two. */
  sheets: number;
  /**
   * When it starts from a rectangle rather than a square: its long side over its short side (√2 for A4). Shown on
   * the card, so nobody reaches for a square.
   */
  paper?: number;
  /** Tools beyond paper, shown on the card so nobody starts one without them: scissors for a cut, a pen for drawing. */
  needs?: Tool[];
  /** The day it shipped, as YYYY-MM-DD: the same day as its row in PROVENANCE.md. */
  added?: string;
}

/**
 * Models shipped on or after this day are New: they get a star on their card and the gallery's New chip. A fixed
 * day rather than "the last month", which would mark the whole first month's gallery New; move it on to retire a
 * batch's stars.
 */
export const NEW_SINCE = '2026-10-28';

export function isNew(model: Pick<ModelInfo, 'steps' | 'added'>): boolean {
  return !!model.steps && !!model.added && model.added >= NEW_SINCE;
}

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'lesson', label: 'Lessons' },
  { id: 'animal', label: 'Animals' },
  { id: 'object', label: 'Objects' },
  { id: 'toy', label: 'Toys' },
  { id: 'plane', label: 'Planes' },
  { id: 'modular', label: 'Modular' },
  { id: 'flower', label: 'Flowers' },
];

export const LEVELS: { id: Level; label: string }[] = [
  { id: 'easy', label: 'Easy' },
  { id: 'medium', label: 'Medium' },
  { id: 'hard', label: 'Hard' },
];

export const MODELS: ModelInfo[] = [
  { id: 'basics', title: 'Basics', blurb: 'Start here: how to step through, play, turn and read each fold.', difficulty: 1, category: 'lesson', steps: 15, minutes: 5, sheets: 1, added: '2026-10-16' },
  { id: 'folds-lesson', title: 'Common folds', blurb: 'Valley and mountain, reverse, squash, rabbit ear, pleat, crimp and petal folds, each on its own square.', difficulty: 2, category: 'lesson', steps: 56, minutes: 20, sheets: 1, added: '2026-10-21' },
  { id: 'bases-lesson', title: 'Origami bases', blurb: 'The kite, square, water bomb, bird, fish and frog bases: where most models start.', difficulty: 2, category: 'lesson', steps: 104, minutes: 30, sheets: 1, added: '2026-10-21' },
  { id: 'paper-plane', title: 'Paper plane', blurb: 'The classic dart. Flies far and straight.', difficulty: 1, category: 'plane', steps: 13, minutes: 5, sheets: 1, paper: 1.43, added: '2026-10-16' },
  { id: 'glider', title: 'Glider', blurb: 'A flat-nosed plane with broad wings, for slow, long glides.', difficulty: 1, category: 'plane', steps: 12, minutes: 5, sheets: 1, paper: 1.43, added: '2026-10-18' },
  { id: 'bulldog-dart', title: 'Bulldog dart', blurb: 'The dart with its point folded back: a stubby nose for rough landings.', difficulty: 1, category: 'plane', steps: 14, minutes: 5, sheets: 1, paper: 1.43, added: '2026-10-18' },
  { id: 'navy-plane', title: 'Navy plane', blurb: 'A slim delta-winged jet, built for speed.', difficulty: 2, category: 'plane', steps: 19, minutes: 8, sheets: 1, paper: 1.3, added: '2026-10-21' },
  { id: 'king-bee', title: 'King bee', blurb: 'A stubby acrobat with two feelers, that wiggles through the air like a bee.', difficulty: 2, category: 'plane', steps: 23, minutes: 10, sheets: 1, paper: 1.3, needs: ['scissors'], added: '2026-10-21' },
  { id: 'dog-face', title: 'Dog face', blurb: 'A first fold: a triangle with floppy ears.', difficulty: 1, category: 'animal', steps: 11, minutes: 2, sheets: 1, needs: ['pen'], added: '2026-10-18' },
  { id: 'cat-face', title: 'Cat face', blurb: 'A first fold: a triangle with pointed ears.', difficulty: 1, category: 'animal', steps: 7, minutes: 2, sheets: 1, needs: ['pen'], added: '2026-10-18' },
  { id: 'cup', title: 'Cup', blurb: 'A cup that holds water, for a while.', difficulty: 1, category: 'object', steps: 7, minutes: 4, sheets: 1, added: '2026-10-16' },
  { id: 'samurai-helmet', title: 'Samurai helmet', blurb: 'A kabuto with horns. Fold a big one to wear.', difficulty: 2, category: 'object', steps: 15, minutes: 8, sheets: 1, added: '2026-10-16' },
  { id: 'fortune-teller', title: 'Fortune teller', blurb: 'Pick a colour, pick a number.', difficulty: 2, category: 'toy', steps: 19, minutes: 8, sheets: 1, added: '2026-10-16' },
  { id: 'heart', title: 'Heart', blurb: 'A simple heart, nice for cards.', difficulty: 2, category: 'object', steps: 20, minutes: 5, sheets: 1, added: '2026-10-16' },
  { id: 'cicada', title: 'Cicada', blurb: 'A traditional Japanese cicada, its wings folded out from a diamond.', difficulty: 2, category: 'animal', steps: 10, minutes: 5, sheets: 1, added: '2026-10-18' },
  { id: 'jumping-frog', title: 'Jumping frog', blurb: 'From half a square of paper. Press its back and watch it hop.', difficulty: 2, category: 'animal', steps: 23, minutes: 10, sheets: 1, paper: 2, added: '2026-10-16' },
  { id: 'ninja-star', title: 'Ninja star', blurb: 'Two sheets locked into a spinning shuriken.', difficulty: 2, category: 'modular', steps: 17, minutes: 10, sheets: 2, added: '2026-10-16' },
  { id: 'tulip', title: 'Tulip', blurb: 'A blossom and a stem from two squares.', difficulty: 3, category: 'flower', steps: 15, minutes: 10, sheets: 2, added: '2026-10-17' },
  { id: 'fox', title: 'Fox', blurb: 'A sitting fox with big ears and a bushy tail.', difficulty: 2, category: 'animal', steps: 15, minutes: 5, sheets: 1, needs: ['pen'], added: '2026-10-16' },
  { id: 'crane', title: 'Crane', blurb: 'The traditional symbol of peace and luck.', difficulty: 4, category: 'animal', steps: 34, minutes: 20, sheets: 1, added: '2026-10-16' },
  { id: 'swan', title: 'Swan', blurb: 'A kite folded narrow, with a neck that stands up.', difficulty: 1, category: 'animal', steps: 14, minutes: 5, sheets: 1, added: '2026-10-18' },
  { id: 'lily', title: 'Lily', blurb: 'Four curled petals from the frog base.', difficulty: 5, category: 'flower', steps: 42, minutes: 20, sheets: 1, added: '2026-10-17' },
  { id: 'penguin', title: 'Penguin', blurb: 'A very easy penguin with a white front.', difficulty: 1, category: 'animal', steps: 12, minutes: 3, sheets: 1, added: '2026-10-21' },
  { id: 'whale', title: 'Whale', blurb: 'A fish base folded into a whale, with fins and a flicked-up tail.', difficulty: 2, category: 'animal', steps: 22, minutes: 8, sheets: 1, added: '2026-10-21' },
  { id: 'crow', title: 'Crow', blurb: 'A traditional crow with a sharp beak.', difficulty: 3, category: 'animal', steps: 26, minutes: 12, sheets: 1, added: '2026-10-21' },
  { id: 'christmas-tree', title: 'Christmas tree', blurb: 'A fir tree in a white pot, nice on a card.', difficulty: 1, category: 'object', steps: 11, minutes: 5, sheets: 1, added: '2026-10-21' },
  { id: 'waterbomb', title: 'Water bomb', blurb: 'A paper balloon. Blow into the hole and it puffs up.', difficulty: 2, category: 'toy', steps: 27, minutes: 8, sheets: 1, added: '2026-10-21' },
  { id: 'balloon', title: 'Balloon', blurb: 'The water bomb, blown up. Experimental: the paper puffs into a pillow, not yet a cube.', difficulty: 2, category: 'toy', steps: 28, minutes: 8, sheets: 1, added: '2026-10-23' },
  { id: 'flapping-bird', title: 'Flapping bird', blurb: 'Pull its tail and the wings flap.', difficulty: 3, category: 'toy', steps: 24, minutes: 12, sheets: 1, added: '2026-10-21' },
  { id: 'balloon-rabbit', title: 'Balloon rabbit', blurb: 'A water bomb with long ears, puffed up round.', difficulty: 3, category: 'animal', steps: 25, minutes: 10, sheets: 1, added: '2026-10-21' },
  { id: 'pinwheel', title: 'Pinwheel', blurb: 'A windmill with four sails. Pin it to a stick and blow.', difficulty: 2, category: 'toy', steps: 12, minutes: 6, sheets: 1, added: '2026-10-21' },
  { id: 'butterfly', title: 'Butterfly', blurb: 'Wings folded out from a squashed square, lifted for flight.', difficulty: 3, category: 'animal', steps: 28, minutes: 10, sheets: 1, added: '2026-10-21' },
  { id: 'dolphin', title: 'Dolphin', blurb: 'A traditional dolphin, leaping.', difficulty: 3, category: 'animal', steps: 24, minutes: 12, sheets: 1, needs: ['scissors'], added: '2026-10-21' },
  { id: 'seal', title: 'Seal', blurb: 'A seal with its head up, flippers out and tail raised.', difficulty: 3, category: 'animal', steps: 20, minutes: 12, sheets: 1, added: '2026-10-22' },
  { id: 'frog', title: 'Frog', blurb: 'The classic frog from the frog base, legs and all.', difficulty: 4, category: 'animal', steps: 55, minutes: 20, sheets: 1, added: '2026-10-21' },
  { id: 'sword', title: 'Sword', blurb: 'A knight’s sword with a crossguard, from one long strip.', difficulty: 2, category: 'toy', steps: 14, minutes: 8, sheets: 1, paper: 4, added: '2026-10-18' },
  { id: 'masu-box', title: 'Masu box', blurb: 'A square box from one sheet, its corners locked in by the ends.', difficulty: 2, category: 'object', steps: 22, minutes: 10, sheets: 1, added: '2026-10-22' },
  { id: 'masu-shallow-lid', title: 'Shallow masu lid', blurb: 'A low lid for the masu box, neater and easier to lift off. It takes more care to fold.', difficulty: 3, category: 'object', steps: 32, minutes: 15, sheets: 1, added: '2026-10-22' },
  { id: 'envelope', title: 'Envelope', blurb: 'A letter envelope from a sheet of printer paper, its top flap tucked in. No glue.', difficulty: 2, category: 'object', steps: 27, minutes: 8, sheets: 1, paper: 1.41, added: '2026-10-22' },
  { id: 'masu-lid', title: 'Masu box lid', blurb: 'A lid for the masu box: the same folds, the corners stopping just short of the middle.', difficulty: 2, category: 'object', steps: 22, minutes: 10, sheets: 1, added: '2026-10-22' },
  { id: 'pajarita', title: 'Pajarita (little bird)', blurb: 'The little paper bird of Spain, from a square with its corners folded in.', difficulty: 2, category: 'animal', steps: 19, minutes: 10, sheets: 1, added: '2026-10-22' },
  { id: 'boomerang', title: 'Boomerang', blurb: 'A flat paper boomerang that flies out, turns and comes back.', difficulty: 3, category: 'toy', steps: 11, minutes: 10, sheets: 1, paper: 1.54, needs: ['tape'], added: '2026-10-22' },
  { id: 'fish', title: 'Fish', blurb: 'A very easy fish, all triangles.', difficulty: 1, category: 'animal', steps: 9, minutes: 3, sheets: 1, added: '2026-10-22' },
  { id: 'crown', title: 'Crown', blurb: 'Three points and a band, from a triangle. A first fold fit for a king.', difficulty: 1, category: 'object', steps: 5, minutes: 3, sheets: 1, added: '2026-10-28' },
  { id: 'sailboat', title: 'Sailboat', blurb: 'A white sail on a red hull, in five folds.', difficulty: 1, category: 'object', steps: 5, minutes: 3, sheets: 1, added: '2026-10-28' },
  { id: 'lotus', title: 'Lotus', blurb: 'The corners folded to the middle three times, then opened into four curling petals.', difficulty: 2, category: 'flower', steps: 4, minutes: 8, sheets: 1, added: '2026-10-28' },
  { id: 'tulip-bloom', title: 'Tulip in 3D', blurb: 'The traditional 3D blossom: a water bomb base wrapped narrow, then blown up into a bud.', difficulty: 3, category: 'flower', steps: 20, minutes: 12, sheets: 1, added: '2026-10-28' },
  { id: 'peacock', title: 'Peacock', blurb: 'A blue bird in front of its green fan of a tail, from two squares.', difficulty: 2, category: 'animal', steps: 11, minutes: 8, sheets: 2, added: '2026-10-28' },
  { id: 'cactus', title: 'Cactus', blurb: 'A ribbed cactus in a pot, with a flower on top. Three squares, no glue.', difficulty: 2, category: 'flower', steps: 9, minutes: 10, sheets: 3, added: '2026-10-28' },
  { id: 'pirate-hat', title: 'Pirate hat', blurb: 'The newspaper hat, from a sheet of printer paper, with a skull and crossbones drawn on.', difficulty: 1, category: 'object', steps: 12, minutes: 5, sheets: 1, paper: 1.41, needs: ['pen'], added: '2026-10-28' },
  { id: 'frog-bookmark', title: 'Frog bookmark', blurb: 'A frog’s head with eyes that stick out, slipped over the corner of a page.', difficulty: 1, category: 'object', steps: 8, minutes: 5, sheets: 1, needs: ['pen'], added: '2026-10-28' },
  { id: 'heart-bookmark', title: 'Heart bookmark', blurb: 'A heart that slips over the corner of a page.', difficulty: 1, category: 'object', steps: 11, minutes: 5, sheets: 1, added: '2026-10-28' },
  // Coming soon: listed, with no steps yet.
  { id: 'boat', title: 'Boat', blurb: 'The classic paper boat. It really floats, for a while.', difficulty: 2, category: 'object', minutes: 6, sheets: 1 },
  { id: 'iris', title: 'Iris', blurb: 'Three petals up, three down, from the frog base.', difficulty: 4, category: 'flower', minutes: 20, sheets: 1 },
  { id: 'fan', title: 'Fan', blurb: 'Pleat a sheet back and forth, then pinch the end.', difficulty: 1, category: 'object', minutes: 3, sheets: 1 },
  // A lesson rather than a model, kept last: geometry by folding.
  { id: 'folding-geometry', title: 'Geometry by folding', blurb: 'Folding’s own rules of geometry: an angle split in three, and any triangle a compass can draw.', difficulty: 1, category: 'lesson', steps: 44, minutes: 20, sheets: 1, added: '2026-10-18' },
];

/**
 * Models so closely related they share one card in the gallery, split by a slash: a box and its lid, a model
 * and the same model taken one step further, two faces folded the same way. Left first.
 */
export const PAIRS: [string, string][] = [
  ['masu-box', 'masu-lid'],
  ['dog-face', 'cat-face'],
  ['waterbomb', 'balloon'],
  ['tulip', 'tulip-bloom'],
  ['frog-bookmark', 'heart-bookmark'],
];

/**
 * The models as the gallery lays them out: each pair whose models are both here as one entry, where the first of
 * them comes; the rest one by one.
 */
export function withPairs<M extends { id: string }>(models: M[]): (M | [M, M])[] {
  const byId = new Map(models.map((m) => [m.id, m]));
  const pairOf = new Map(PAIRS.flatMap((p) => p.map((id) => [id, p] as const)));
  const placed = new Set<string>();
  const out: (M | [M, M])[] = [];
  for (const m of models) {
    if (placed.has(m.id)) continue;
    const [a, b] = (pairOf.get(m.id) ?? []).map((id) => byId.get(id));
    if (a && b) {
      out.push([a, b]);
      placed.add(a.id).add(b.id);
    } else out.push(m);
  }
  return out;
}

export function levelOf(difficulty: Difficulty): Level {
  return difficulty <= 2 ? 'easy' : difficulty === 3 ? 'medium' : 'hard';
}

export function findModel(id: string | undefined): ModelInfo | undefined {
  return MODELS.find((m) => m.id === id);
}

export interface Filter {
  query?: string;
  level?: Level | null;
  category?: Category | null;
  /** Only the models marked New. */
  onlyNew?: boolean;
}

/**
 * How the gallery orders models. `natural` is the catalog's own order, easing in from the lessons; `newest` puts
 * the latest shipped first, models still to come last.
 */
export const SORTS = ['natural', 'newest', 'easiest', 'hardest', 'az', 'za', 'quickest'] as const;
export type Sort = (typeof SORTS)[number];

/**
 * Models in the order `sort` asks for, ties kept in the catalog's order. Titles compare in `locale`, as shown.
 */
export function sortModels<M extends ModelInfo>(models: M[], sort: Sort, locale?: string): M[] {
  const byTitle = (a: M, b: M) => a.title.localeCompare(b.title, locale, { sensitivity: 'base' });
  const compare: Record<Sort, ((a: M, b: M) => number) | null> = {
    natural: null,
    newest: (a, b) => (b.added ?? '').localeCompare(a.added ?? ''),
    easiest: (a, b) => a.difficulty - b.difficulty,
    hardest: (a, b) => b.difficulty - a.difficulty,
    az: byTitle,
    za: (a, b) => byTitle(b, a),
    quickest: (a, b) => a.minutes - b.minutes,
  };
  const by = compare[sort];
  return by ? [...models].sort(by) : models;
}

export function filterModels(models: ModelInfo[], { query = '', level, category, onlyNew }: Filter): ModelInfo[] {
  const q = query.trim().toLowerCase();
  return models.filter(
    (m) =>
      (!level || levelOf(m.difficulty) === level) &&
      (!category || m.category === category) &&
      (!onlyNew || isNew(m)) &&
      (!q || m.title.toLowerCase().includes(q) || m.blurb.toLowerCase().includes(q)),
  );
}
