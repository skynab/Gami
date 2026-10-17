import type { OrigamiModel } from '../../fold/types';
import { basics } from '../basics';
import { crane } from './crane';
import { cup } from './cup';
import { fortuneTeller } from './fortune-teller';
import { fox } from './fox';
import { heart } from './heart';
import { jumpingFrog } from './jumping-frog';
import { ninjaStar } from './ninja-star';
import { paperPlane } from './paper-plane';
import { samuraiHelmet } from './samurai-helmet';
import { tulip } from './tulip';

/**
 * Every built-in model, as code. `npm run models` turns these into public/models/<id>.fold and <id>.svg,
 * which the site loads. Not bundled into the site itself.
 */
export const RECIPES: (() => OrigamiModel)[] = [() => basics, paperPlane, cup, samuraiHelmet, fortuneTeller, heart, jumpingFrog, ninjaStar, tulip, fox, crane];
