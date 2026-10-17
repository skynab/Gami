import type { Line } from './geometry2d';
import { shape } from './shape';
import type { FoldFrame, Vec2 } from './types';

/**
 * Finishing steps in 3D: lift part of the paper off the table by turning it about a crease, like opening a
 * wing or standing up a flap. Unlike a fold, the result isn't flat, so it's usually a model's last step.
 * A single bend; see `shape` for several.
 */
export interface PoseOptions {
  line: Line;
  /** How far to turn, in radians: 0 leaves it flat, π/2 stands it straight up, π folds it right over. */
  angle: number;
  /** Turn only the top N layers on the moving side. Leave out to turn every layer there. */
  layers?: number;
  /** Turn only faces whose corners on the sheet pass this test. */
  only?: (paper: Vec2[]) => boolean;
}

/** Turns the side to the left of the line's direction up off the table about the line. */
export function pose(frame: FoldFrame, options: PoseOptions): FoldFrame {
  return shape(frame, [options]);
}
