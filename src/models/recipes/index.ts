import type { OrigamiModel } from '../../fold/types';
import { folds as basics } from './basics';
import { bulldogDart } from './bulldog-dart';
import { catFace } from './cat-face';
import { cicada } from './cicada';
import { crane } from './crane';
import { cup } from './cup';
import { dogFace } from './dog-face';
import { fortuneTeller } from './fortune-teller';
import { fox } from './fox';
import { glider } from './glider';
import { heart } from './heart';
import { jumpingFrog } from './jumping-frog';
import { lily } from './lily';
import { swan } from './swan';
import { sword } from './sword';
import { foldingGeometry } from './folding-geometry';
import { ninjaStar } from './ninja-star';
import { paperPlane } from './paper-plane';
import { penguin } from './penguin';
import { samuraiHelmet } from './samurai-helmet';
import { tulip } from './tulip';

/**
 * Every built-in model, as code. `npm run models` turns these into public/models/<id>.fold and <id>.svg,
 * which the site loads. Not bundled into the site itself.
 */
export const RECIPES: (() => OrigamiModel)[] = [basics, paperPlane, glider, bulldogDart, dogFace, catFace, cup, samuraiHelmet, fortuneTeller, heart, cicada, jumpingFrog, ninjaStar, tulip, fox, crane, lily, swan, penguin, sword, foldingGeometry];
