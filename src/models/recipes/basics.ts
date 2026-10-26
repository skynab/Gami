import { paper, Recipe } from '../../fold/recipe';
import { basics } from '../basics';

/**
 * "Basics": the first lesson, a tour of the app rather than of origami. Each step folds the square a little
 * (creases, corners to the middle) so there's something to watch, while its words show how to use the viewer:
 * stepping, playing, the scrubber and its sections, turning the camera, the view cube, the guides and the card.
 * Shares only its id and paper with the hand-written ../basics.ts, which the engine's tests use.
 */
export function folds() {
  const middle = paper(0, 0);
  return (
    new Recipe({ id: basics.id, title: 'Basics', sheet: basics.sheets[0] })
      .section('Stepping through')
      .onto(paper(-0.5, -0.5), paper(0.5, 0.5), {
        title: 'Welcome to Gami',
        text: 'Each step shows one fold. Press Next step (›) or → to go on.',
      })
      .unfold({
        title: 'Going back',
        text: 'Previous step (‹) or ← goes back, all the way to the flat sheet before the first fold.',
      })
      .onto(paper(0.5, -0.5), paper(-0.5, 0.5), {
        title: 'Watch it again',
        text: 'Replay (R) plays this step again. Play half a step (H) stops halfway, so you can see how the paper moves.',
      })
      .unfold({
        title: 'Play by itself',
        text: 'Press and hold Next step to play on through the steps. Press it again, press Space or click the model to pause.',
      })
      .onto(paper(0, 0.5), paper(0, -0.5), {
        title: 'Speed',
        text: 'The 1× button (S) changes how fast the paper folds.',
      })
      .section('Finding your way')
      .unfold({
        title: 'Sections',
        text: 'Purple diamonds on the bar mark where each part starts, like this one. Click one to jump there.',
      })
      .onto(paper(-0.5, 0), paper(0.5, 0), {
        title: 'The progress bar',
        text: 'Drag along the bar to move the paper by hand, as slowly as you like. Each tick is a step.',
      })
      .unfold({
        title: 'Back to the first step',
        text: 'Press and hold First step (⏮) until it fills up to go back to step 1. A quick tap does nothing, so you can’t lose your place by accident.',
      })
      .section('Looking around')
      .turnOver('Drag the model to turn it. Scroll or pinch to zoom, and right-drag or drag with two fingers to move it.')
      .rotate(45, {
        title: 'Set views',
        text: 'Free, Top, Front and Side (1 to 4) look from set angles. On a phone they’re behind the ⋯ button.',
      })
      .onto(paper(-0.5, -0.5), middle, {
        title: 'The view cube',
        text: 'Click a face, edge or corner of the cube in the top right to look from there. Hold it down to make it bigger and easier to pick.',
      })
      .onto(paper(0.5, 0.5), middle, {
        title: 'Lock and reset',
        text: 'Lock view (L) holds the angle still, so dragging moves the paper instead. Reset view (0) puts the camera back.',
      })
      .section('Reading the steps')
      .onto(paper(0.5, -0.5), middle, {
        title: 'Fold lines and arrows',
        text: 'A dashed line is a valley fold, a dotted one a mountain fold, and the arrow shows where the paper goes. The button on this card (G) hides them.',
      })
      .onto(paper(-0.5, 0.5), middle, {
        title: 'Hide the instructions',
        text: 'The ˅ on this card hides it, to see more of the model. Show instructions (I) brings it back.',
      })
      .rotate(-45, {
        title: 'Pick up where you left off',
        text: 'Gami remembers your step in every model and marks the ones you finish. Press ? for every keyboard shortcut.',
      })
      .build()
  );
}
