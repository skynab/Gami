# Plan: advanced folds from OrigamiOK

A fourth batch from OrigamiOK, from its [advanced origami](https://origamiok.com/advanced-origami/) page (55
models). Seven were asked for: the skull, pot plant, dragon, unicorn, Godzilla, cute whale and hummingbird. As in
`docs/origamiok-intermediate-plan.md`, each phase ships on its own, one commit per model, and every model is marked
New on its card. These are the hardest models Gami has tried from OrigamiOK, so the phases are smaller and the
riskiest ones wait for engine work already planned.

## What was found (21 November 2026)

- **Credits.** Every page is written by Bella, none states a licence beyond the site's copyright, and only one
  names a designer: the **unicorn** is **Imai Yudai**'s. The **hummingbird**'s page says it's built on the bird
  base, and a reply from the site says they designed that version themselves. The rest name nobody. Gami follows
  the order of folds at most and copies none of OrigamiOK's text or photos.
- **Nothing here is traditional.** Gilad's database (`/origami-database/<name>`) has no Traditional entry in what
  could be read for skull (113 results), dragon (1083), unicorn (145), Godzilla (30, read in full), whale (282) or
  hummingbird (144). The dragon, whale and hummingbird pages were too long to read to the end, so a traditional one
  could still be hiding there, but none of OrigamiOK's sequences looks like one. So, per the cactus decision, all
  of them become **Gami's own**: keep the general look, fold it differently, licence it CC BY 4.0 in
  `DESIGNS-LICENSE.md`. Each starts from a traditional base or an existing Gami helper where it can.
- **"Origami Dragon"** has no page of that name. The nearest is **Easy Origami Dragon** (#46, marked Advanced
  despite the name); there's also a dollar-bill **Money Dragon** (#47). This plan takes the first.
- **Godzilla is Toho's character**, as the creeper was Mojang's. Decided 21 November: Gami makes its own generic
  **kaiju** instead: an upright monster with back plates, as many kaiju are, but no name or distinctive detail
  taken from Godzilla (phase 7).
- **What the engine has, and lacks.** As before: no glue (Gami tucks, locks or tapes), scissor cuts, a pen,
  several sheets, 3D assembly (`assemble`), pop-ups (`popUp`), blowing up (`inflate`), shaping (`shape`), and the
  presets: pleat, crimp, squash, petal, rabbit ear, swivel and sink (`src/fold/presets.ts`). Helpers for the bird,
  fish, frog and water bomb bases are in `src/models/recipes`. The limit that matters most here is clipping
  (`docs/clipping-plan.md`): advanced models stack many layers, and reverse folds on long, thin flaps (necks,
  tails, horns) pass paper through paper while they play. `REST` is 1.5 layers and `GRAZE` 5 layers since 20
  November, and the lists only shrink, so a new model can't simply be listed. Bending reverse folds round the
  corner (clipping plan, part 3) isn't done yet.
- **The seven, checked:**

  | Model | OrigamiOK | Gilad's database | Verdict |
  |---|---|---|---|
  | Hummingbird | 1 sheet (24 cm), 38 steps, no cuts or glue. A bird base, the wings folded down and back up, feet from a folded corner, the tail shaped, the neck closed by pinching and the beak narrowed. 3D | 144 results, none Traditional seen. OrigamiOK's own version | **Not open**: Gami's own, from the traditional bird base |
  | Skull | 1 sheet, 30 steps, no cuts or glue. Half folds and creases, triangles squashed, pockets opened and flaps pulled out for sockets and cheekbones, teeth from small pleats. A relief, front only | 113 results, none Traditional (Kirschenbaum, Limet, van Goubergen, Kasahara, …) | **Not open**: Gami's own |
  | Cute whale | 1 sheet, 39 steps, no glue (a step mentions slits). A crease grid, the head raised into a cube, the tail folded at the other end. Turned over, it's a box for small things | 282 results, none Traditional seen. Gami's `whale` is origami.me's traditional one, a flat fish-base whale | **Not open**: Gami's own, a box whale (not a second flat whale) |
  | Pot plant | 8 sheets (2 for the pot, 6 cut into 8 leaves and 8 stems), 37 steps, scissors and glue. The pot is OrigamiOK's separate short pot; the stems are rolled strips glued into a rolled filler; leaves cut and folded. Stands, 1 hour | Too broad to check (1207 "plant" results); no potted leafy plant seen as Traditional | **Not open**: Gami's own. Must differ from Gami's `cactus` (also a plant in a pot, flat, three squares) |
  | Unicorn | 1 sheet (20 cm), 41 steps, no cuts. A full crease grid collapsed, the horn one layer folded back, head and neck from pockets, legs and tail from corner folds. 3D | Page credits **Imai Yudai**. 145 results, none Traditional (Esteve, Ermakov, Kamiya, Montroll, …) | **Not open**: Gami's own |
  | Dragon | "Easy Origami Dragon": 1 sheet, 30 steps, no cuts. A collapse into a small square, the tail in zigzags, head and horn from the top flaps, zigzag wings spread out. 3D | 1083 results, none Traditional seen (Kamiya, Afonkina, Kasahara, Montroll, Joisel, …) | **Not open**: Gami's own |
  | Godzilla | 2 sheets, 47 steps, one cut, glued. A grid collapsed into a standing body (two legs, broad chest, small head); the back fins a separate small square glued into a slot. Stands | 30 results, none Traditional (Inoue, Maekawa, Esteve, Kamiya, …) | **Not open, and a trademarked character**: Gami's own generic kaiju (decided 21 November) |

## The routine for each model

As in the earlier OrigamiOK plans: licence row first (`record-model-licence`); recipe in `src/models/recipes`;
`npm run models` (warn any other session first: it rewrites every file in `public/models`); no crossings, and no
new `RESTS` or `GRAZES` entry; catalog entry with `added` set to the ship date and a difficulty of 3 or 4 (Gami has
13 at 3, 3 at 4, 1 at 5); Japanese, Spanish and French steps; `npm test` and `npm run typecheck`; look at it in the
viewer, in 3D where it's 3D. Where OrigamiOK glues, Gami tucks, locks or tapes, and says so in the step. Where it
cuts, prefer a fold if one gives the same look. Where it pinches or shapes, use `shape`. Check line endings before
committing (`git ls-files --eol`).

"Advanced" here means Gami's version should feel like a step up from the intermediate batch (more steps, a sink
or petal fold where it earns its place) but not copy OrigamiOK's step count for its own sake. A clean model with 20
steps beats a 40-step one that clips.

## Order

Engine fit first: the models that reuse a traditional base and lie mostly flat, then the 3D and multi-sheet ones,
then the ones with long reverse-folded necks and tails, which wait for the clipping plan's part 3.

| Phase | Model | Engine fit | Risk |
|---|---|---|---|
| 1. **Hummingbird** | `hummingbird` | The bird base helper (`bird-base.ts`) as the crane and flapping bird. The bird base's two lower flaps become the long beak and the tail (narrowed by folding their edges in, as the crane's neck is); the two upper flaps the wings, folded down and out at an angle so they read as hovering, not gliding. The beak is a long, thin reverse fold: try it first and, if it grazes, fold the beak outside (a crimp, preset) or narrow it after the turn instead. Different from the crane: a short body, wings forwards, the beak straight and longer than the tail. `shape` opens the body a little so it sits in 3D. | Low–medium |
| 2. **Skull** | `skull` | A front-only relief, as the cat and dog faces are, one square, light side up, so the skull is pale and the sockets show the dark side. Corners folded to the middle and back out (as the sunflower's), the top two squashed round into the cranium, two flaps turned back to open dark eye sockets and a small one for the nose, the bottom edge pleated into teeth (`pleat`, preset). No pen if the folds can show the sockets; the pen for the teeth's gaps if they can't. The relief comes from `shape` lifting the cranium and cheekbones a little. | Medium |
| 3. **Cute whale** | `cute-whale` | 3D and box-like, one sheet if it can be done cleanly, two if not. The body is a masu-like box (`masu-box.ts`, traditional) with its walls folded up from a creased grid, so it really is a box when turned over, as OrigamiOK's is; the tail is a flap left long at one end, narrowed and flicked up (as the whale's tail is, but as a crimp on the box's end). Eyes with the pen. If one sheet clips where the tail leaves the wall, use two: the box, and a tail tucked into its end wall. Check it isn't just a masu box with a tail glued on: the head end should be taller and rounded, the tail end low. | Medium |
| 4. **Pot plant** | `pot-plant` | Gami's own, standing in 3D, as few sheets as gives the look (aim for 4: pot, filler and two leafy stems, rather than OrigamiOK's 8). The pot is the masu box (traditional) in terracotta, set on the table; each stem is a sheet folded thin into a long stalk, as the tulip's stem starts, with two or three leaves folded out of its sides (the shared `leafyStem` in `tulip.ts`, extended), stood up in the pot with `assemble`. The stalks lean outwards a little at different angles so it looks like a plant, not a fan. Unlike the `cactus`: in 3D, leafy rather than ribbed, no flower. If `assemble` can't stand a stalk inside a box without clipping its walls, put a filler (a square folded into a smaller box, upside down) in the pot for the stalks to stand on. | Medium–high |
| 5. **Unicorn** | `unicorn` | Gami's own, standing, built as the standing fox (`fox-3d`) is: a body snipped and folded so four legs hang down, stood up with `assemble`; a head and neck from a second sheet; a long thin horn from a small third sheet, narrowed three times into a point and set on the forehead; a mane and tail from a fourth small sheet pleated (`pleat`) for hair. One sheet, as OrigamiOK folds it, would need the grid collapse and many thin reverse folds, which the engine can't play cleanly yet: revisit a one-sheet version after the clipping plan's part 3. Make it read as a horse, not the fox: a longer neck, a long face, the horn. | High |
| 6. **Dragon** | `dragon` | Gami's own, after part 3 of the clipping plan (reverse folds that bend on the way), as most of it is long reverse folds. The plan: the bird base (or the frog base, for more points), its two lower flaps narrowed into neck and tail, each crimped twice into an S (crimp, preset), the head a reverse fold with two small horns from a rabbit ear; the upper flaps opened into wings and pleated into ribs (`pleat`), as OrigamiOK's zigzag wings. Try the neck and tail on their own first, and stop at the step where a graze would need listing. If part 3 isn't done when phases 1 to 5 are, a two-sheet dragon (body and tail one sheet, wings a second, pleated, set on the back with `assemble`) is the fallback. | High |
| 7. **Kaiju** (for Godzilla) | `kaiju` | Gami's own generic standing monster, titled "Kaiju", never "Godzilla" in its title, blurb, steps or translations. Two sheets, the T-rex's approach (`t-rex.ts`: a kite folded in half for body, tail and legs) made taller and heavier, standing upright, with a row of back plates from a small second sheet pleated and tucked into the back fold (not glued). Must differ from the T-rex: upright rather than leaning forwards, short arms, plates down the back. | Medium–high |

Phases 1 to 3 are each one sitting. Phases 4 to 6 may need engine work and should each start with a short spike
(try the hard step alone) before the full recipe. Phase 6 can be swapped with 7 if the clipping work runs long.

## Open questions

- **One sheet or several.** OrigamiOK's unicorn, dragon and whale are one sheet each. Gami's own can use more,
  as the standing fox and squirrel did, and it's the safer route while reverse folds clip. If one-sheet versions
  matter, phases 5 and 6 wait for the clipping plan's part 3.
- **The New cutoff.** `NEW_SINCE` is `2026-10-28`. When phase 1 ships, move it forward so only the intermediate
  and advanced batches show as New, or leave it.
- **An Advanced shelf.** The gallery's difficulty filter has Easy, Medium and Hard (`LEVELS` in
  `src/gallery/catalog.ts`); these will land under Hard. A separate Advanced level is only worth adding if the
  user wants them apart from the 3s.

## Progress

| Phase | Status |
|---|---|
| 1. Hummingbird | Not started |
| 2. Skull | Not started |
| 3. Cute whale | Not started |
| 4. Pot plant | Not started |
| 5. Unicorn | Not started |
| 6. Dragon | Not started |
| 7. Kaiju | Not started (decided 21 November: Gami's own generic kaiju in place of Godzilla) |
