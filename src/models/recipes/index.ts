import type { OrigamiModel } from '../../fold/types';
import { findModel } from '../../gallery/catalog';
import { folds as basics } from './basics';
import { balloonRabbit } from './balloon-rabbit';
import { boomerang } from './boomerang';
import { bulldogDart } from './bulldog-dart';
import { butterfly } from './butterfly';
import { catFace } from './cat-face';
import { christmasTree } from './christmas-tree';
import { cicada } from './cicada';
import { crane } from './crane';
import { crow } from './crow';
import { flappingBird } from './flapping-bird';
import { cup } from './cup';
import { dogFace } from './dog-face';
import { dolphin } from './dolphin';
import { fortuneTeller } from './fortune-teller';
import { frog } from './frog';
import { fox } from './fox';
import { glider } from './glider';
import { heart } from './heart';
import { jumpingFrog } from './jumping-frog';
import { lily } from './lily';
import { swan } from './swan';
import { sword } from './sword';
import { basesLesson } from './bases-lesson';
import { foldingGeometry } from './folding-geometry';
import { foldsLesson } from './folds-lesson';
import { kingBee } from './king-bee';
import { masuBox, masuLid } from './masu-box';
import { envelope } from './envelope';
import { navyPlane } from './navy-plane';
import { ninjaStar } from './ninja-star';
import { pajarita } from './pajarita';
import { paperPlane } from './paper-plane';
import { penguin } from './penguin';
import { pinwheel } from './pinwheel';
import { samuraiHelmet } from './samurai-helmet';
import { seal } from './seal';
import { tulip } from './tulip';
import { waterbomb } from './waterbomb';
import { whale } from './whale';
import { fish } from './fish';

/**
 * Every built-in model, as code. `npm run models` turns these into public/models/<id>.fold and <id>.svg,
 * which the site loads. Not bundled into the site itself. Each carries its gallery details from the catalog,
 * so a copy opened in the Studio or shared keeps them.
 */
export const RECIPES: (() => OrigamiModel)[] = ([basics, foldsLesson, basesLesson, paperPlane, glider, bulldogDart, navyPlane, kingBee, dogFace, catFace, cup, samuraiHelmet, fortuneTeller, heart, cicada, jumpingFrog, ninjaStar, tulip, fox, crane, lily, swan, penguin, whale, crow, christmasTree, waterbomb, balloonRabbit, flappingBird, pinwheel, pajarita, butterfly, frog, dolphin, seal, masuBox, masuLid, envelope, sword, boomerang, fish, foldingGeometry] as (() => OrigamiModel)[]).map((make) => () => withAbout(make()));

function withAbout(model: OrigamiModel): OrigamiModel {
  const info = findModel(model.id);
  if (!info) return model;
  const { blurb, difficulty, category, minutes } = info;
  return { ...model, about: { blurb, difficulty, category, minutes } };
}
