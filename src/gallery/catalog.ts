/**
 * Gallery listing for the built-in models. Step data lives in public/models/<id>.fold, generated from
 * src/models/recipes. Models without `steps` are listed as coming soon.
 */

export type Category = 'basics' | 'animal' | 'object' | 'toy' | 'modular' | 'flower' | 'math';
export type Difficulty = 1 | 2 | 3 | 4 | 5;
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
  /** Tools beyond paper, shown on the card so nobody starts one without them: scissors for a cut, a pen for drawing. */
  needs?: Tool[];
}

export type Tool = 'scissors' | 'pen';

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'basics', label: 'Basics' },
  { id: 'animal', label: 'Animals' },
  { id: 'object', label: 'Objects' },
  { id: 'toy', label: 'Toys' },
  { id: 'modular', label: 'Modular' },
  { id: 'flower', label: 'Flowers' },
  { id: 'math', label: 'Math' },
];

export const LEVELS: { id: Level; label: string }[] = [
  { id: 'easy', label: 'Easy' },
  { id: 'medium', label: 'Medium' },
  { id: 'hard', label: 'Hard' },
];

export const MODELS: ModelInfo[] = [
  { id: 'basics', title: 'Folding basics', blurb: 'Start here: fold, unfold and turn the paper over.', difficulty: 1, category: 'basics', steps: 4, minutes: 2, sheets: 1 },
  { id: 'paper-plane', title: 'Paper plane', blurb: 'The classic dart. Flies far and straight.', difficulty: 1, category: 'toy', steps: 13, minutes: 5, sheets: 1 },
  { id: 'glider', title: 'Glider', blurb: 'A flat-nosed plane with broad wings, for slow, long glides.', difficulty: 1, category: 'toy', steps: 12, minutes: 5, sheets: 1 },
  { id: 'bulldog-dart', title: 'Bulldog dart', blurb: 'The dart with its point folded back: a stubby nose for rough landings.', difficulty: 1, category: 'toy', steps: 14, minutes: 5, sheets: 1 },
  { id: 'dog-face', title: 'Dog face', blurb: 'A first fold: a triangle with floppy ears.', difficulty: 1, category: 'animal', steps: 11, minutes: 2, sheets: 1, needs: ['pen'] },
  { id: 'cat-face', title: 'Cat face', blurb: 'A first fold: a triangle with pointed ears.', difficulty: 1, category: 'animal', steps: 7, minutes: 2, sheets: 1, needs: ['pen'] },
  { id: 'cup', title: 'Cup', blurb: 'A cup that holds water, for a while.', difficulty: 1, category: 'object', steps: 7, minutes: 4, sheets: 1 },
  { id: 'samurai-helmet', title: 'Samurai helmet', blurb: 'A kabuto with horns. Fold a big one to wear.', difficulty: 2, category: 'object', steps: 10, minutes: 6, sheets: 1 },
  { id: 'fortune-teller', title: 'Fortune teller', blurb: 'Pick a colour, pick a number.', difficulty: 2, category: 'toy', steps: 19, minutes: 8, sheets: 1 },
  { id: 'heart', title: 'Heart', blurb: 'A simple heart, nice for cards.', difficulty: 2, category: 'object', steps: 20, minutes: 5, sheets: 1 },
  { id: 'cicada', title: 'Cicada', blurb: 'A traditional Japanese cicada, its wings folded out from a diamond.', difficulty: 2, category: 'animal', steps: 10, minutes: 5, sheets: 1 },
  { id: 'jumping-frog', title: 'Jumping frog', blurb: 'From half a square of paper. Press its back and watch it hop.', difficulty: 2, category: 'animal', steps: 23, minutes: 10, sheets: 1 },
  { id: 'ninja-star', title: 'Ninja star', blurb: 'Two sheets locked into a spinning shuriken.', difficulty: 2, category: 'modular', steps: 17, minutes: 10, sheets: 2 },
  { id: 'tulip', title: 'Tulip', blurb: 'A blossom and a stem from two squares.', difficulty: 3, category: 'flower', steps: 15, minutes: 10, sheets: 2 },
  { id: 'fox', title: 'Fox', blurb: 'A sitting fox with big ears and a bushy tail.', difficulty: 2, category: 'animal', steps: 14, minutes: 5, sheets: 1, needs: ['pen'] },
  { id: 'crane', title: 'Crane', blurb: 'The traditional symbol of peace and luck.', difficulty: 4, category: 'animal', steps: 33, minutes: 20, sheets: 1 },
  { id: 'swan', title: 'Swan', blurb: 'A kite folded narrow, with a neck that stands up.', difficulty: 1, category: 'animal', steps: 14, minutes: 5, sheets: 1 },
  { id: 'lily', title: 'Lily', blurb: 'Four curled petals from the frog base.', difficulty: 5, category: 'flower', steps: 42, minutes: 20, sheets: 1 },
  { id: 'penguin', title: 'Penguin', blurb: 'A very easy penguin with a white front.', difficulty: 1, category: 'animal', steps: 12, minutes: 3, sheets: 1 },
  { id: 'whale', title: 'Whale', blurb: 'A fish base folded into a whale, with fins and a flicked-up tail.', difficulty: 2, category: 'animal', steps: 22, minutes: 8, sheets: 1 },
  { id: 'crow', title: 'Crow', blurb: 'A traditional crow with a sharp beak.', difficulty: 3, category: 'animal', steps: 26, minutes: 12, sheets: 1 },
  { id: 'christmas-tree', title: 'Christmas tree', blurb: 'A fir tree in a white pot, nice on a card.', difficulty: 1, category: 'object', steps: 11, minutes: 5, sheets: 1 },
  { id: 'waterbomb', title: 'Water bomb', blurb: 'A paper balloon. Blow into the hole and it puffs up.', difficulty: 2, category: 'toy', steps: 27, minutes: 8, sheets: 1 },
  { id: 'flapping-bird', title: 'Flapping bird', blurb: 'Pull its tail and the wings flap.', difficulty: 3, category: 'toy', steps: 24, minutes: 12, sheets: 1 },
  { id: 'balloon-rabbit', title: 'Balloon rabbit', blurb: 'A water bomb with long ears, puffed up round.', difficulty: 3, category: 'animal', steps: 25, minutes: 10, sheets: 1 },
  { id: 'pinwheel', title: 'Pinwheel', blurb: 'A windmill with four sails. Pin it to a stick and blow.', difficulty: 2, category: 'toy', steps: 12, minutes: 6, sheets: 1 },
  { id: 'butterfly', title: 'Butterfly', blurb: 'Wings folded out from a squashed square, lifted for flight.', difficulty: 3, category: 'animal', steps: 28, minutes: 10, sheets: 1 },
  { id: 'sword', title: 'Sword', blurb: 'A knight’s sword with a crossguard, from one long strip.', difficulty: 2, category: 'toy', steps: 14, minutes: 8, sheets: 1 },
  // Coming soon: listed, with no steps yet.
  { id: 'boat', title: 'Boat', blurb: 'The classic paper boat. It really floats, for a while.', difficulty: 2, category: 'object', minutes: 6, sheets: 1 },
  { id: 'frog', title: 'Frog', blurb: 'The classic frog from the frog base, legs and all.', difficulty: 4, category: 'animal', minutes: 20, sheets: 1 },
  { id: 'fish', title: 'Fish', blurb: 'A very easy fish, all triangles.', difficulty: 1, category: 'animal', minutes: 3, sheets: 1 },
  { id: 'dolphin', title: 'Dolphin', blurb: 'A traditional dolphin, leaping.', difficulty: 2, category: 'animal', minutes: 8, sheets: 1, needs: ['scissors'] },
  { id: 'pajarita', title: 'Pajarita', blurb: 'The little paper bird of Spain, from a square with its corners folded in.', difficulty: 2, category: 'animal', minutes: 8, sheets: 1 },
  { id: 'iris', title: 'Iris', blurb: 'Three petals up, three down, from the frog base.', difficulty: 4, category: 'flower', minutes: 20, sheets: 1 },
  { id: 'fan', title: 'Fan', blurb: 'Pleat a sheet back and forth, then pinch the end.', difficulty: 1, category: 'object', minutes: 3, sheets: 1 },
  { id: 'masu-box', title: 'Masu box', blurb: 'A square box with a lid, from two sheets.', difficulty: 2, category: 'object', minutes: 12, sheets: 2 },
  // A lesson rather than a model, kept last: geometry by folding.
  { id: 'folding-geometry', title: 'Geometry by folding', blurb: 'The rules of mathematical folding, and an angle split in three.', difficulty: 1, category: 'math', steps: 33, minutes: 15, sheets: 1 },
];

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
}

export function filterModels(models: ModelInfo[], { query = '', level, category }: Filter): ModelInfo[] {
  const q = query.trim().toLowerCase();
  return models.filter(
    (m) =>
      (!level || levelOf(m.difficulty) === level) &&
      (!category || m.category === category) &&
      (!q || m.title.toLowerCase().includes(q) || m.blurb.toLowerCase().includes(q)),
  );
}
