# Plan: more modular models

The Modular filter shows one model, the ninja star. This plan adds more, starting from six OrigamiOK pages the
user suggested. Like `docs/origamiok-easy-plan.md`, each phase ships on its own, in its own commit, and every
model is marked New on its card.

## What was found (29 October 2026)

- **OrigamiOK credits nobody.** Each page names its writer (Bella) and photographer (Tomas), with no designer
  and no licence. So each model's status comes from [Gilad's database](https://www.giladorigami.com/origami-database/kusudama%20flower)
  (`/origami-database/<name>`) and origami.me. Gami follows the order of folds only and copies none of
  OrigamiOK's text or photos.
- **What the engine lacks.** Sheets can only be placed **flat on the table** (`place`), on top or underneath,
  so units can't yet be stood up and plugged together in 3D. That already blocked the cube, dice and spinning top
  (`docs/origamiok-easy-plan.md`, phase 5). There is also no way to **tuck a placed unit between layers** of
  another, or to fold one unit and **make N more like it**. So far no model has used more than three sheets, and
  each sheet is folded on screen (`together`), which won't scale to 28 or 60 units. Glue isn't needed: Gami's
  sticky tape (`tape`) can hold joins together, as glue does.
- **The six, checked:**

  | OrigamiOK | Units | How it's made | Gilad's / origami.me | Verdict |
  |---|---|---|---|---|
  | [Rainbow chain](https://origamiok.com/origami-rainbow-chain/) | 28 squares, 9 folds each | Each unit is a narrow folded strip; the next unit's layers tuck into it. Ends join into a bracelet | Not found by name. Two near relatives are **Traditional**: the *gum wrapper chain* (Gilad: *Creating Origami*) and the *chain bracelet* (*Creative Origami and Beyond*) | **Clear as a traditional chain**: fold the gum wrapper chain in rainbow colours |
  | [Kusudama flower ball](https://origamiok.com/origami-kusudama-flower-ball/) | 60 squares, glued | Five petals glued into a flower, 12 flowers glued into a ball | *Flower Kusudama*: **Traditional** (Gilad: *Charming Flower Origami*) | **Clear** |
  | [Infinity cube](https://origamiok.com/origami-infinity-cube/) | 48 squares, glue and tape | Eight small glued cubes, taped at hinges so they flip round endlessly | A hinge toy, not a folded design; the six-panel cube inside it is unnamed | **Gami's own**: eight of Gami's cubes joined with tape hinges |
  | [Cube](https://origamiok.com/origami-cube/) | 6 squares | Edges to the middle, turn over, corners to opposite edges: a parallelogram with two tabs | This is the **Sonobe unit** (Mitsunobu Sonobe; origami.me's cube credits him too) | **Not open.** Use the **business card cube** instead: 6 units, **Traditional** (Gilad: Hull, *Project Origami*) |
  | [Ninja star, 8 points](https://origamiok.com/origami-ninja-stars-8-points/) | 8 squares | Each unit's corners folded in and collapsed, then wrapped round its neighbour into a ring | Every 8-unit ninja star on Gilad's is named (Jose Meeusen; Jaime Niño Bernal); the transforming star is Robert Neale's. Only the two-unit shuriken is Traditional | **Not open**: Gami's own eight-point star |
  | [Magic circle](https://origamiok.com/origami-magic-circle/) | 9 squares | Units wrapped into a ring whose flaps flip inside out over and over | *Magic circle*: **Kumasaka Hiroshi** (Gilad: Temko, *Origami Magic*); the 8-unit *Kurum kurum* is George Rhoads's | **Not open**: Gami's own flipping ring, or drop it |

- **Other open modulars found:**

  | Model | Units | Source | Fit |
  |---|---|---|---|
  | Kusudama chrysanthemum | 6 squares, corners glued | origami.me: **Traditional** ([kusudama-chrysanthemum](https://origami.me/kusudama-chrysanthemum/)) | A cube-shaped ball of six flower units. 3D, taped where it glues |
  | Business card cube | 6 rectangles | Gilad: **Traditional** | 3D. The dice is this cube with pips drawn on |
  | Five-point star | 5 rectangles | Gilad: **Traditional** (Palacios, *Papiroflexia al alcance de todos*) | Flat. Needs a folding sequence to follow: check one can be found that isn't a named design |
  | Golden Venture units | Many 1 × 2 rectangles | Gilad: **Traditional** | Hundreds of units for a swan or bowl. Only with copies (phase 2); a small piece, say a ring, at most |

  Not modular after all: origami.me's **Lazy Susan** is one sheet (`docs/origami-me-candidates.md` had it as
  modular). No openly licensed modern modular turned up: a search found Stephen Cavilia's *Open Frame* under CC
  BY-SA 3.0, but only as a repost; it would need the original checked before use.

## The routine for each model

As in `docs/origamiok-easy-plan.md`: licence row first (`record-model-licence`); recipe in
`src/models/recipes`; `npm run models`; no crossings; catalog entry, category `modular`, `sheets` set, `added` set
to the ship date; update the Modular filter test in `src/gallery/catalog.test.ts` (it expects only the ninja star);
Japanese, Spanish and French steps; `npm test` and `npm run typecheck`; look at it in the viewer. Where OrigamiOK
glues, Gami says to glue (glue isn't drawn: tape can't be laid on paper standing up in 3D). Fold the first unit in
full; the rest are "fold the others the same way" (`copy`).

## Order

On 29 October 2026 the user chose three: the **kusudama flower ball**, the **rainbow chain** and the **cube**. The
eight-point star, magic circle and infinity cube are dropped, Gami's own versions too ("too proprietary"). Each
phase can ship alone.

| Phase | Work | Engine fit | Risk |
|---|---|---|---|
| 1. **Engine: piles, copies and tucks** | Sheets that start in a pile; fold one unit and make the rest like it; slide a placed unit between another's layers | A pile is sheets starting stacked at one place. A `copy` step turns sheets in the pile into copies of a folded one, recorded as an op so `.fold` files fold again. `move` gains `into`: parts of the moving piece go just under chosen faces of the paper they land on, so a link's halves slide into another's sleeves. Tests in `src/fold`. | Medium |
| 2. **Rainbow chain** | The traditional gum wrapper chain in seven colours | A strip folded to a quarter of its width, its ends to the middle, then in half: a link of two halves, each a sleeve. The next link, turned a quarter turn, slides its halves into the sleeves, and so on into a flat zigzag. The ends can be joined into a bracelet; the model ends flat. | Medium |
| 3. **Engine: 3D assembly** | Put folded units together in 3D | An `assemble` step, from the last flat state as shaping is: each sheet can be bent along lines (as `shape`) and then picked up and set down anywhere in 3D, turned any way. Later assembly steps add to earlier ones, so units go on one by one. Nothing folds afterwards. | High |
| 4. **Cube** | The traditional **business card cube** | Two cards crossed, each one's ends folded round the other, give two units: a square with a flap at either end. Six units, flaps bent square, make a cube, each flap lying over the outside of the next face. | Medium |
| 5. **Kusudama flower ball** | The traditional flower ball: 60 petals, 12 flowers | One petal folded in full (triangle, corners up, flaps squashed, tips down, flaps folded in half), the other 59 copied. Each petal's sides are glued into a cone, five petals make a flower, twelve flowers a ball (on a dodecahedron's faces). Check the viewer's speed and the file's size before shipping. | High |

## Open questions

- **The rainbow chain.** The traditional gum wrapper chain is folded from a rectangle, not OrigamiOK's square;
  the finished look, a zigzag chain of colours, is the same.
- **How many units on screen.** 60 petals is many more sheets than any model so far. If the viewer slows, the
  ball could show fewer flowers.

## Progress

| Phase | Status |
|---|---|
| 1. Piles, copies and tucks | Done. Sheets put down where others lie start in a pile (`startFrame`). `copy` (`copy.ts`) makes sheets into copies of a folded one. A copy step plays each copy folding as the first unit did, step by step, lifted clear and taking turns from the top of the pile (copies made together, as the cube's pairs, fold together), then going to its place: no paper passes through paper. Each face going straight to its place had passed through other paper thousands of times. `move`'s `into` slides parts of a piece in under chosen paper. Layer stacking skips faces far apart, for speed. |
| 2. Rainbow chain | Done: 28 strips, one folded in full, the rest copied and slid in. Flat layers made the chain a wedge: each link lies inside the one before, so the first link's halves ended up 448 layers apart. A last step, `settle` (`settle.ts`, "Press it flat"), sets each face only as high as the paper under it, tilted to fit, so the chain is as thin as its thickest crossing. A last step curls it round into a bracelet standing up: assembly from paper pressed flat starts from those heights, each link set rigidly on the ring (neighbours dip into each other by up to 0.017 where they cross, as rigid links on a curve must), all going straight there together (`straight`) rather than each coming in from outside. |
| 3. 3D assembly | Done: `assemble` (`assemble.ts`). Steps with more than 400 faces play face by face, and the viewer's guides skip faces whose outlines don't touch: they had taken up to 16 s on the kusudama. |
| 4. Cube | Done: the business card cube in three colours, each pair of cards making two units, the cube built up from the bottom, every edge held by a flap over the next face. It's turned 35° so its card shows two sides; cards seen at a slant are now painted in the order faces cover each other, which showed flaps under the faces they lie on (and, on the bracelet and lotus, colours the viewer doesn't show). |
| 5. Kusudama flower ball | Done. The squash is the flap folded in half on its crease, then its top layer opened back out over the diamond's lower edge, two folds as one step. Each petal is a three-sided cone: its halves 66° apart, so its lower edges are 45° apart and the flaps (22.5° each) meet between them. Five petals tilt 70° out from each flower's middle, their flaps outward; flowers sit 0.5 out from the ball's middle, each petal towards a corner of its face. Small gaps show where three flowers meet, as on a real one. The file is 1.0 MB (about 210 KB compressed), the biggest by far: every face of every assembled step is kept. A flap's bend names its quarter of the square rather than each of its faces, which saved 15%. |
| Later: glue and dice | Done. Glue is a tool on the card, as tape is: an assembly step can say its pieces are glued (`glue`, not drawn), and the kusudama's are. The **dice** is the business card cube in white cards put together with its flaps inside, so each face is one plain square, the units turned over to draw the dots on the side that ends up outside, 1 to 6 with opposite faces adding to 7. Cards seen at a slant now draw pen marks, and break rings of faces covering each other (three flaps meeting in a corner) within the ring. |
