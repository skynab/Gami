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
import { masuBox, masuLid, masuShallowLid } from './masu-box';
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
import { balloon } from './balloon';
import { whale } from './whale';
import { fish } from './fish';
import { cactus } from './cactus';
import { peacock } from './peacock';
import { tulipBloom } from './tulip-bloom';
import { lotus } from './lotus';
import { sailboat } from './sailboat';
import { crown } from './crown';
import { pirateHat } from './pirate-hat';
import { frogBookmark } from './frog-bookmark';
import { heartBookmark } from './heart-bookmark';
import { cuteCat } from './cute-cat';
import { bat } from './bat';
import { bull } from './bull';
import { tRex } from './t-rex';
import { knife } from './knife';
import { kunai } from './kunai';
import { handFan } from './hand-fan';
import { rose } from './rose';

/**
 * Every built-in model, as code. `npm run models` turns these into public/models/<id>.fold and <id>.svg,
 * which the site loads. Not bundled into the site itself. Each carries its gallery details from the catalog,
 * so a copy opened in the Studio or shared keeps them.
 */
export const RECIPES: (() => OrigamiModel)[] = ([basics, foldsLesson, basesLesson, paperPlane, glider, bulldogDart, navyPlane, kingBee, dogFace, catFace, cup, samuraiHelmet, fortuneTeller, heart, cicada, jumpingFrog, ninjaStar, tulip, fox, crane, lily, swan, penguin, whale, crow, christmasTree, waterbomb, balloon, balloonRabbit, flappingBird, pinwheel, pajarita, butterfly, frog, dolphin, seal, masuBox, masuLid, masuShallowLid, envelope, sword, boomerang, fish, crown, sailboat, lotus, tulipBloom, peacock, cactus, pirateHat, frogBookmark, heartBookmark, cuteCat, bat, bull, tRex, knife, kunai, handFan, rose, foldingGeometry] as (() => OrigamiModel)[]).map((make) => () => withAbout(make()));

function withAbout(model: OrigamiModel): OrigamiModel {
  const info = findModel(model.id);
  if (!info) return model;
  const { blurb, difficulty, category, minutes } = info;
  return { ...model, about: { blurb, difficulty, category, minutes } };
}
