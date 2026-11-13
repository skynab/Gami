# Plan: intermediate folds from OrigamiOK

A third batch from OrigamiOK, from its [intermediate origami](https://origamiok.com/intermediate-origami-instructions/)
page (131 models). Seven were asked for: the sunflower, strawberry, squirrel, fox, lizard, turtle and Minecraft
creeper. Like `docs/origamiok-easy-plan.md`, each phase ships on its own, one commit per model, and every model is
marked New on its card.

## What was found (13 November 2026)

- **Two pages name a designer this time.** As before, most pages credit only their writer (Bella) and
  photographer (Tomas Jing), with no licence beyond the site's copyright. But the **fox** page credits
  **Hoàng Tiến Quyết** and the **lizard** page credits **Lee Won-pyo** ("Mr. Square"). The rest were checked
  against [Gilad's database](https://www.giladorigami.com/origami-database/turtle) (`/origami-database/<name>`).
  Gami follows the order of folds only and copies none of OrigamiOK's text or photos.
- **Only the turtle has a traditional version.** Every sunflower, strawberry, squirrel and lizard in Gilad's has
  a named designer, so those become Gami's own, per the cactus decision: keep the general look, fold it
  differently, licence it CC BY 4.0 in `DESIGNS-LICENSE.md`.
- **What the engine has, and lacks.** No glue: Gami's versions tuck, lock or use the sticky tape (`tape`), as
  the modulars do. It has scissor cuts, a pen, several sheets, 3D assembly (`docs/modular-plan.md`), the named
  compound folds (crimp, squash, petal, rabbit ear, swivel: `src/fold/presets.ts`), and air blown in through a
  bend (`inflate`, as the balloon and 3D tulip). Rolling a sheet into a stalk is a curl spread over many small
  bends (`shape`), as the finger trap's tube. Reverse folds on long, thin flaps (tails, legs) tend to pass paper
  through paper: watch `GRAZES` (`src/models/model-checks.ts`).
- **The seven, checked:**

  | Model | OrigamiOK | Gilad's database | Verdict |
  |---|---|---|---|
  | Turtle | 1 sheet, 19 steps, no cuts. Corners creased to the middle, a kite-like body, the front corners swung out into flippers, a small tail crimped at the back | 388 results. About ten Traditional **Turtle (square)** entries (Gross, *Zoogami*; Momotani, *Beginner Origami*; NOA 493; *Le Pli* 62-63; Stern, *My First Origami Kit*), some with cuts, plus three Traditional tortoises | **Candidate**: check OrigamiOK's sequence against a traditional turtle |
  | Sunflower | 4 sheets (head, rolled stem, two small leaves), scissors and glue, 35 steps. The head is a square base with its bottom cut off, opened and pushed into eight petals round a hollow middle | 81 results, none Traditional (Yoshizawa, Kasahara, Petty, Yamaguchi, Robinson, …) | **Not open**: Gami's own |
  | Strawberry | 2 sheets, cuts, glue and paint, 23 steps. A square base narrowed both sides, opened into a 3D berry; a cut calyx and a rolled stalk glued in | 49 results, none Traditional. The "classic" one is Rae Cooker's | **Not open**: Gami's own |
  | Squirrel | 1 sheet, 21 steps, no cuts. Corners to the middle, sides to the middle, folded in half, the tail opened up from below and shaped; stands up | 276 results, none Traditional in any part read | **Not open**: Gami's own |
  | Lizard | 1 sheet, 28 steps, eyes drawn. Four legs each made with zigzag folds, a long tail | Page credits **Lee Won-pyo**. 147 results, none Traditional | **Not open**: Gami's own |
  | Fox | 1 sheet, 24 steps, 3D: face pressed out, tail opened up and bent, cheek fur folded back | Page credits **Hoàng Tiến Quyết** | **Not open.** Gami already has a fox (Okuda's, kept by decision). See open questions |
  | Minecraft creeper | 2 sheets, a head unit and a body-and-feet unit slotted together, face drawn | Not a question for Gilad's: the creeper is a character from *Minecraft* (Mojang / Microsoft), and its face is the whole point of the model | **Decide** (open questions) |

## The routine for each model

As in the earlier OrigamiOK plans: licence row first (`record-model-licence`); recipe in `src/models/recipes`;
`npm run models`; no crossings, and no new `GRAZES` entry without a note why; catalog entry with `added` set to the
ship date; Japanese, Spanish and French steps; `npm test` and `npm run typecheck`; look at it in the viewer. Where
OrigamiOK glues, Gami tucks, locks or tapes, and says so in the step. Where it cuts, prefer a fold if one gives the
same look. Where it draws or paints, use the pen.

## Order

Easiest and clearest first. Each phase can ship alone, and the models within a phase don't depend on each other.

| Phase | Models | Engine fit | Risk |
|---|---|---|---|
| 1. **Turtle** | Turtle | Flat folds and swung-out flaps, much as the fox and frog bookmark. The only likely traditional one, so it's the quickest to settle: if OrigamiOK's sequence matches a traditional turtle, follow it; if not, fold a traditional one (Gross's *Zoogami* turtle is the best known). The tail is a crimp (preset). | Low |
| 2. **Sunflower** | Sunflower | Gami's own, flat, no scissors or glue. The head is a square with its corners folded to the middle and back out into eight petals, the middle coloured in with the pen for seeds. Check it against `chrysanthemum`, `rose` and `lotus` first so it isn't one of them in yellow. The stem is a second sheet folded thin (as the kunai's handle), with a leaf folded out of each side, and the head tucked or taped on top. OrigamiOK's rolled, glued stem isn't needed. | Low–medium |
| 3. **Flat animals** | Lizard, squirrel | Both Gami's own, both lying flat. The **lizard** is a long body with four points for legs (a fish base or a narrowed bird base gives four), each foot a crimp, the tail a narrowed point, eyes drawn. The **squirrel** is a kite body folded in half, its big tail a reverse fold up over its back (as the fox's tail and the seal's), the ears a small squash. Standing it up, as OrigamiOK does, is a bonus with `shape`. Long reverse-folded flaps graze: try them early, and shape the steps round what plays cleanly. | Medium |
| 4. **Strawberry** | Strawberry | Gami's own, 3D, two sheets. The berry is the water bomb base wrapped narrower (as the 3D tulip's blossom), blown up and led by guides into a rounded cone rather than a box (`docs/bending-plan.md`): this is the hard part, as the guides have so far led to boxes. The calyx is a small green square folded into a star (corners to the middle, points out), set on top and taped. Seeds drawn with the pen. If the cone can't be reached, stop at the tulip's box shape and leave it out until it can. | Medium–high |
| 5. **3D fox** | Fox (`fox-3d`) | Gami's own, standing up beside Okuda's flat sitting fox (decided 13 November). Folded flat first, as the squirrel, then stood up with `shape`: the body opened a little along its back fold so it stands on its legs, the face pressed out, the tail raised. Make it differ from the squirrel in the head (pointed ears and snout, as the flat fox's) and a long low tail rather than one curled over the back. | Medium–high |

Left out (13 November): the **Minecraft creeper**. The creeper is Mojang's character, and the model is its face
drawn on a block; Gami's open-designs rule turns away models that proprietary, as it did the named modulars.

## Open questions

- **The New cutoff.** `NEW_SINCE` is `2026-10-28`. When phase 1 ships, move it forward so only this batch shows
  as New, or leave it.

## Progress

| Phase | Status |
|---|---|
| 1. Turtle | Done (13 November), Gami's own: no traditional turtle's order of folds could be checked against OrigamiOK's. A water bomb base narrowed on each side as the water bomb is (corners up, corners in) into a tall six-sided shell, the loose points folded down and out as flippers rather than tucked: the back side's at 30°, low down, the front side's at 55°, high up. The base's top point is the head; eyes and the shell's plates are drawn with the pen. The flaps are two layers, so the paper's other colour never shows. Pen lines are split where the paper on top changes (`onTop` in `face.ts`), as a mark only draws on the layer under its first point. |
| 2. Sunflower | Done (13 November), Gami's own, three squares and no glue. The petals are a yellow square, orange side up, its corners folded to the middle and their points folded back out past the edges: eight petals, the square's corners and the points. The folded-in flaps leave an orange square, so the brown middle (a square half as wide, its corners folded behind into an octagon) is big enough to leave only a thin orange ring and the square's corners between the petals. Seeds are 40 dots in a sunflower's golden-angle spiral. The stem is the flat tulip's traditional stem with a leaf, now shared (`leafyStem` in `tulip.ts`); the tulip's files didn't change. It isn't `chrysanthemum`, `rose` or `lotus`: the rose's points twist and it has no middle. |
| 3. Flat animals | **Lizard** done (13 November), Gami's own, two squares. The fish base was tried first, but its side flaps can't swing out flat as legs (as the whale's fins can't), and the lower flaps would need two snips each. So the body is the turtle's narrowed water bomb base (now shared, `narrowedSide` in `turtle.ts`), its legs steeper: the back ones at 20°, the front ones at 65°, reaching forwards. The tail is a smaller square turned light side up and narrowed twice into a long point, as the tulip's stem starts, slipped under the body with its widest part under the back legs. The water bomb base's helpers take an `only` now, so a second sheet on the table isn't folded with them; the body turns over and points up by moving just its sheet (a whole-table turn moves it off the middle). The other models' files didn't change. **Squirrel** done (13 November), Gami's own, three squares. From one sheet (a kite or a triangle folded in half, its ends reverse-folded up for tail and head) the tail came out thin, and a 45° corner leaves too little paper for a head: reverse-folded forwards it either lands on the front edge or tucks inside. So, as the T-rex: the body is a triangle folded right over left, its folded edge the back, its bottom point folded behind for feet; the tail a tall kite turned over to be dark all over, its top flicked down so the light tip curls over, slipped behind the back and leaning over it; the head a small triangle, nose forwards, its top corner the ear, its bottom folded behind. No reverse folds, so no grazes. |
| 4. Strawberry | Done (13 November), Gami's own, but **flat rather than 3D**: blowing paper up is led face by face onto a box (`cubeGuides`, as the balloon and 3D tulip are), and nothing leads it into a rounded cone yet, so a blown-up berry would be a tall red box. The berry is a red diamond with its sides folded behind on a slant (from where the top fold meets the diamond's edges, so nothing pokes out past the corners), its top and bottom point folded behind and its four corners rounded; the leaves an eight-pointed green star folded as the sunflower's petals are, laid over its top; seeds drawn in staggered rows. A 3D strawberry waits on a guide for a rounded shape. |
| 5. 3D fox | Done (13 November) as the **standing fox** (`fox-3d`), Gami's own, three squares. Not folded flat and shaped, as planned, but put together in 3D (`assemble`, as the cube is): the body is a square snipped twice from each of its top and bottom edges, the strips between folded behind, then folded in half top behind, so the strips are inside and four legs hang down; it's stood up with its two sides opened 12° either side of the back. The head is the cat face's traditional folds, set at the front facing forwards; the tail a kite folded in half lengthwise, so it's slim and orange both sides, its wide end tucked between the back legs, held out behind and up 20°. Seen from above, the inside of the far side shows white through the opening. Checked in the 3D viewer: it stands on the table, four legs down. |
| Creeper | Left out |
