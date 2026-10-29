import { Recipe, table } from '../../fold/recipe';
import { birdBase, squareBase } from './bird-base';
import { fishBase } from './fish-base';
import { frogBase } from './frog-base';
import { waterbombBase } from './waterbomb-base';

/**
 * A lesson rather than a model: the classic bases, the shapes most traditional models start from, each folded
 * on a fresh square in its own section. The choice and order of bases follow origami.me's beginner's guide;
 * the folds are the gallery models' own (bird-base.ts, waterbomb-base.ts, fish-base.ts, frog-base.ts).
 */
export function basesLesson() {
  const r = new Recipe({ id: 'bases-lesson', title: 'Origami bases', sheet: { size: [1, 1], front: '#3f8fd2', back: '#f6f3ec' } });

  /**
   * A section: on a fresh square (but for the first, which has its square already), says what the base is,
   * folds it, and opens it out again.
   */
  const base = (name: string, intro: string | null, fold: () => void, open?: string) => {
    r.section(name);
    if (intro) r.newSheet({ title: name, text: intro });
    const flat = r.mark();
    fold();
    if (open) r.unfold({ title: 'Open it out', text: open, to: flat });
  };

  // The first square needs no fetching, so the kite base's intro goes on its first fold.
  base(
    'Kite base',
    null,
    () => {
      const h = Math.SQRT1_2;
      const [top, bottom] = [table(0, -h), table(0, h)];
      r.rotate(45, {
        title: 'Make a diamond',
        text: 'A base is a simple shape that many models start from. The kite base is the simplest: two edges folded to a diagonal. The swan and the fox start from it. Begin by turning the square so a corner points at you.',
      })
        .crease(table(-h, 0), table(h, 0), { title: 'Crease down the middle', text: 'Fold the left corner to the right corner, and unfold.' })
        .edgeOnto([bottom, table(-h, 0)], [bottom, top], { title: 'Fold a kite', text: 'Fold the lower left edge to the centre crease.' })
        .edgeOnto([bottom, table(h, 0)], [bottom, top], { title: 'Fold the other side', text: 'And the lower right edge. It’s a kite.' });
    },
    'Open the paper out flat. Each base leaves its own pattern of creases.',
  );
  base(
    'Square base',
    'The square base, also called the preliminary base: a small square of four flaps, with the paper’s corners together at one end. The crane and the frog start from it.',
    () => squareBase(r),
    'Open it out. The square base’s creases: both diagonals and both middle lines.',
  );
  base(
    'Water bomb base',
    'The water bomb base is the square base turned inside out: the same creases, folded the other way, make a triangle. The water bomb and the balloon rabbit start from it.',
    () => waterbombBase(r),
    'Open it out. Compare the creases with the square base’s: the same lines, folded the opposite way.',
  );
  base(
    'Bird base',
    'The bird base is a square base with a petal fold on each side, making four long points. The crane, the flapping bird and the crow start from it.',
    () => birdBase(r),
    'Open it out to see the bird base’s creases, the start of many birds.',
  );
  base(
    'Fish base',
    'The fish base comes from a kite folded at both ends, with two little flaps pinched up at the sides. The whale, the dolphin and the seal start from it.',
    () => fishBase(r, 'Start coloured side up, with a corner pointing towards you.'),
    'Open it out. The fish base is two kite bases, one from each end.',
  );
  base(
    'Frog base',
    'The frog base is a square base with all four flaps squashed and then petal folded. The frog and the lily start from it. It takes the most steps of all the bases.',
    () => frogBase(r),
  );
  return r.build();
}
