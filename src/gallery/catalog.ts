/**
 * Gallery listing for the built-in models. Fold data lives in public/models (milestone 4);
 * until then each entry only carries what the gallery and step bar need.
 */

export type Category = 'basics' | 'animal' | 'object' | 'toy' | 'modular' | 'flower';
export type Difficulty = 1 | 2 | 3 | 4 | 5;
export type Level = 'easy' | 'medium' | 'hard';

export interface ModelInfo {
  id: string;
  title: string;
  blurb: string;
  difficulty: Difficulty;
  category: Category;
  steps: number;
  minutes: number;
  /** Number of sheets of paper. The ninja star uses two. */
  sheets: number;
}

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'basics', label: 'Basics' },
  { id: 'animal', label: 'Animals' },
  { id: 'object', label: 'Objects' },
  { id: 'toy', label: 'Toys' },
  { id: 'modular', label: 'Modular' },
  { id: 'flower', label: 'Flowers' },
];

export const LEVELS: { id: Level; label: string }[] = [
  { id: 'easy', label: 'Easy' },
  { id: 'medium', label: 'Medium' },
  { id: 'hard', label: 'Hard' },
];

export const MODELS: ModelInfo[] = [
  { id: 'basics', title: 'Folding basics', blurb: 'Start here: fold, unfold and turn the paper over.', difficulty: 1, category: 'basics', steps: 4, minutes: 2, sheets: 1 },
  { id: 'paper-plane', title: 'Paper plane', blurb: 'The classic dart. Flies far and straight.', difficulty: 1, category: 'toy', steps: 7, minutes: 3, sheets: 1 },
  { id: 'boat', title: 'Boat', blurb: 'A little sailboat that really floats.', difficulty: 1, category: 'object', steps: 9, minutes: 5, sheets: 1 },
  { id: 'cup', title: 'Cup', blurb: 'A cup that holds water, for a while.', difficulty: 1, category: 'object', steps: 8, minutes: 4, sheets: 1 },
  { id: 'heart', title: 'Heart', blurb: 'A simple heart, nice for cards.', difficulty: 2, category: 'object', steps: 10, minutes: 5, sheets: 1 },
  { id: 'fortune-teller', title: 'Fortune teller', blurb: 'Pick a colour, pick a number.', difficulty: 2, category: 'toy', steps: 9, minutes: 5, sheets: 1 },
  { id: 'jumping-frog', title: 'Jumping frog', blurb: 'Press its back and watch it hop.', difficulty: 2, category: 'animal', steps: 12, minutes: 8, sheets: 1 },
  { id: 'ninja-star', title: 'Ninja star', blurb: 'Two sheets locked into a spinning shuriken.', difficulty: 2, category: 'modular', steps: 14, minutes: 10, sheets: 2 },
  { id: 'tulip', title: 'Tulip', blurb: 'A blossom and a stem from two squares.', difficulty: 3, category: 'flower', steps: 13, minutes: 10, sheets: 2 },
  { id: 'fox', title: 'Fox', blurb: 'A sly fox face with pointy ears.', difficulty: 3, category: 'animal', steps: 11, minutes: 8, sheets: 1 },
  { id: 'crane', title: 'Crane', blurb: 'The traditional symbol of peace and luck.', difficulty: 4, category: 'animal', steps: 18, minutes: 15, sheets: 1 },
  { id: 'lily', title: 'Lily', blurb: 'Six curled petals from the frog base.', difficulty: 5, category: 'flower', steps: 22, minutes: 20, sheets: 1 },
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
