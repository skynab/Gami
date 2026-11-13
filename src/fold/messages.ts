/**
 * What the fold engine says when a fold can't be made, in English, by code. Errors carry the code and any values
 * it fills in, so the Studio can say it in the interface's language (`fold` in src/i18n, where these are the
 * English); the error's own message is the English, for recipes, tests and anywhere without the interface.
 * Messages for recipe authors (naming the model and step) and for malformed files (naming a path in the file)
 * stay English only, as plain messages.
 */
export const FOLD_MESSAGES = {
  anchorOffPaper: 'The anchor point isn’t on the paper.',
  bendFailed: 'The bend couldn’t be worked out.',
  bendsCross: 'Those bends cross on the paper, so they’d stretch it. Shape one part at a time.',
  bent: 'Paper that has bent can’t be folded any further.',
  copyOntoItself: 'A sheet can’t be copied onto itself.',
  copyPlaces: 'Each copy needs its own place.',
  copySameSize: 'Copies must be folded from sheets the same size.',
  creaseNeedsTwoPoints: 'Each crease needs two different points.',
  creasesNotFlat: 'Those creases can’t all fold flat at once.',
  creasesStretch: 'Those creases would stretch the paper between them.',
  cutMissesPaper: 'That cut doesn’t cross any paper.',
  edgeOnLine: 'That edge is already on that line.',
  flatCantBend: 'Paper pressed flat can’t be bent as it’s put together.',
  foldsStretch: 'Those folds can’t all open together without stretching the paper.',
  layersJoined: 'Those layers are joined to the ones below, so folding only them would tear the paper. Try more layers.',
  linesNeedFlat: 'Lines to fold along are on the table: the paper has to lie flat.',
  noPaperThere: 'There’s no paper there.',
  noPaperToReplace: 'No paper to replace with a fresh sheet.',
  noPaperUnderTape: 'There’s no paper under that tape.',
  noSavedOp: 'Can’t add to a 3D step that has no operation saved.',
  noSheetToCopyOnto: 'There’s no sheet {{sheet}} to copy onto.',
  noStacking: 'These folds can’t lie flat in any stacking order.',
  noStill: 'No part of the paper stays still.',
  notEnoughPicks: 'Not enough points picked yet.',
  notFlat: 'This step isn’t flat, so it can’t be folded further here.',
  notOnPaper: '({{point}}) isn’t on the paper.',
  nothingOnFoldingSide: 'Nothing is on the folding side of that line.',
  nothingOnLiftingSide: 'Nothing is on the lifting side of that line.',
  nothingToBend: 'Nothing to bend: no faces were picked.',
  nothingToMove: 'Nothing to move.',
  nothingToPress: 'There’s nothing to press down.',
  nothingToSlide: 'No part of the piece to slide in.',
  nothingToSlideUnder: 'There’s no paper there for that part to slide under.',
  nothingToUnfold: 'Nothing to unfold.',
  petalCant: 'That flap can’t be petal-folded.',
  petalNoFlap: 'There’s no flap there. Pick the free corner of the flap on top.',
  petalNoSides: 'That flap has no sides to fold in. Pick the free corner of a diamond-shaped flap.',
  poseZero: 'A pose needs directions that aren’t zero.',
  rabbitNoPaper: 'There’s no paper in that triangle.',
  rabbitTriangle: 'Pick three corners of a triangle.',
  ridingOnNothing: 'A riding layer has nothing beneath it to ride on.',
  shareDamaged: 'this link is incomplete or damaged',
  shareNoOp: 'step {{step}} can’t be folded again from its file',
  shareStep: 'step {{step}}: {{error}}',
  sheetMissingToCopy: 'Sheet {{sheet}} isn’t there to copy.',
  sheetMissingToFold: 'Sheet {{sheet}} isn’t there to fold.',
  sinkNoPoint: 'There’s no point there to sink. Pick the tip of a point.',
  sinkOffPaper: 'Pick a point on the paper for the tip to sink to.',
  sinkPicks: 'Pick the tip of the point, then a point further in for it to sink to.',
  squashLanding: 'Pick a point on the flap for its folded edge to land on.',
  squashNoFlap: 'There’s no flap to squash there. Pick the corner of a flap where its folded edges meet.',
  stackCircle: 'These faces overlap in a circle, which a stack of layers can’t show.',
  stackContradicts: 'The known stacking contradicts itself.',
  swivelNoHinge: 'There’s no flap hinged there. Pick the pivot at the end of a folded edge, then a point along it.',
  swivelNoPaper: 'There’s no paper for the flap to swing across that way.',
  swivelOffLine: 'Pick where the folded edge swings to off the line it’s on now.',
  swivelPicks: 'Pick the pivot, a point along the flap’s folded edge, then where that point should swing to.',
  tapeEnds: 'A piece of tape needs two different ends.',
  tooManyFaces: 'more than {{n}} faces',
  tooManySteps: 'more than {{n}} steps',
  unfoldAhead: 'Can’t unfold to step {{step}}, which hasn’t happened yet.',
  wallsAngle: 'Walls meeting at a corner must turn by the same angle.',
};

export type FoldMessage = keyof typeof FOLD_MESSAGES;

/**
 * The values a message fills in. A value can itself be something said (a step's error inside a share link's), so
 * it's said in the same language.
 */
export type MessageParams = Record<string, string | number | Said>;

/** Something said: its English, and its code and values where it has one. */
export interface Said {
  message: string;
  code?: FoldMessage;
  params?: MessageParams;
}

const isCode = (s: string): s is FoldMessage => Object.hasOwn(FOLD_MESSAGES, s);

/** A message in English, its {{values}} filled in. */
export function english(code: FoldMessage, params: MessageParams = {}): string {
  return FOLD_MESSAGES[code].replace(/\{\{(\w+)\}\}/g, (_, k: string) => {
    const v = params[k];
    return v === undefined ? '' : typeof v === 'object' ? v.message : String(v);
  });
}

/** The parts of an error the interface needs to say it: plain data, so it can be posted from a worker. */
export function said(e: unknown): Said {
  if (e instanceof CodedError) return { message: e.message, ...(e.code && { code: e.code, params: e.params }) };
  return { message: e instanceof Error ? e.message : String(e) };
}

/**
 * An error made from a message code (`new FoldError('notFlat')`), with its values, or from a plain English message
 * for authors and files. The message is the English either way.
 */
export class CodedError extends Error {
  readonly code?: FoldMessage;
  readonly params?: MessageParams;
  constructor(what: FoldMessage | (string & {}), params?: MessageParams) {
    const coded = isCode(what);
    super(coded ? english(what, params) : what);
    if (coded) {
      this.code = what;
      this.params = params;
    }
  }
}
