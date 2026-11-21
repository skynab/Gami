# Plan: paper through paper (November 2026)

Clipping is the inside of the paper showing through its outside: one face passing through another, so the colour
or the layer that should be hidden pokes out. Where it stands on 20 November 2026, and the order of work to cut it
down further.

## What's there to work with

- **`restingCrossings(model)`** (`src/fold/collisions.ts`): paper through paper in the frame each step comes to
  rest on, what's on screen most. Every pair of faces is compared, bent triangles too, except faces joined along a
  crease. Bent layers lying the same way are marked `stacked`: the viewer draws those in their stacking order where
  they meet (`LIFT` in `FoldedPaper.tsx`).
- **`crossings(model, samples, joined)`**: the same while each step plays, at 0.1 to 0.9 of the way through by
  default. With `joined` `'point'` (the default) faces meeting at a single corner on the sheet are skipped; with
  `'edge'` (what CI uses since 20 November) only faces joined along a crease are, which also finds a flap's point
  tucked through what it meets there. Crossings within `NEAR_JOIN` of that corner are left out, as at rest.
- **`npm run clip-report`**: both, model by model and step by step, with where on the sheet. `--playing` adds the
  motions, at the same points as CI (a few minutes for every model), `--stacked` adds bent stacks, `--md <file>` writes Markdown too.
- **The model checks** (`src/models/model-checks.ts`): at rest no deeper than `REST` (2.5 layers, about 0.26 mm on
  a 15 cm sheet) and playing no deeper than `GRAZE` (0.005, about 7 layers; at every tenth of each step and at 0.05
  and 0.95), except the models listed in `RESTS`
  and `GRAZES` at what they were measured at. Lists only shrink: a model that's fixed must come off.

Done so far: the checks and report (15 November, `8f7ff14`); the squirrel, T-rex, chrysanthemum and kusudama fixed
at rest, 4 to 10 mm each (`f58d3aa`); the kusudama's ball made dense again without clipping (`b6981f4`).

## Where it stands (20 November 2026)

| | Over the limit | Of which already listed |
|---|---|---|
| At rest, more than 2.5 layers | 5 models: rainbow chain (2.5 mm), pirate hat (1.5 mm), 3D fox, butterfly, shallow masu lid (0.3 to 0.5 mm). The 3D fox and butterfly fixed later that day. | All 5 (`RESTS`) |
| Playing, faces joined at a point included, more than 7 layers | 22 steps in 13 models | 11 models (`GRAZES`); new: the kusudama's "Squash the flaps" (step 6, 5.9 mm) and the penguin's "Turn the head down" (step 12, 0.8 mm), both fixed later that day; then the heart and seal, found near steps' ends |
| Playing, more than 2.5 layers | 64 steps | |
| Bent stacks at rest | Cup and samurai helmet 0.7 mm, balloon rabbit 0.4 mm, boat, tulip bloom, balloon, waterbomb 0.1 to 0.3 mm | Not checked: left to `LIFT` |

45 of the 86 models have nothing deeper than a layer anywhere the report looks (bent steps' motions aside, see
part 3).

## How to fix (what the first four taught)

- **Fix the geometry, not the drawing.** The depth buffer separates surfaces about 30 times closer than a layer at
  normal distances, so specks aren't depth fighting; the paper is really there. Hiding the inside colour would hide
  it where it should show too (inside the cup, the boat).
- **Find the cause before tuning numbers.** The kusudama looked like flowers set too close; it was its ball's face
  directions mirrored, so its petals were aimed unevenly. The squirrel's head looked mis-turned; the body's stacked
  layers had moved its back 0.008 forward.
- **Keep the design, and say when it changes.** Where a fix changes the look (the T-rex's head perched on its back,
  the kusudama's flowers turned 20°, its loop a step of its own), the commit says so and the step text and its
  translations follow.
- **Rest first, then motions, deepest first.** Each fix takes a model off a list; once a list is empty its limit
  comes down.

## 1. The rest of the resting list

| Model | At rest | Cause | Approach | Size |
|---|---|---|---|---|
| 3D fox | ~~0.5 mm~~ fixed 20 November | The tail rose past the back just inside the body's rear edge, where the body's sides meet and there's no room between them. | Its wide end tucked lower, so it rises past the back only behind the body. | Done |
| Butterfly | ~~0.4 mm~~ fixed 20 November | `shape` turned a stack lifted by one bend about its bottom layer, so its upper layers' edges swung in past the crease, through the wing's top layers lying still there. | Fixed in `shape`, for every model: a stack that's all lifted turns about its top, the fold's inside, its lower layers swinging out round it (a stack carrying on past its line the other way, as a plane's fin past its body, keeps its bottom). 24 models' files moved a little; none newly crosses. | Done |
| Shallow masu lid | 0.3 mm, steps 30 to 32 (raising and locking the walls) | Not the riding layers, as first thought: at the box's inside corners, a flap lying on one wall (or the floor) runs right out to the corner's line, while the other wall's inner layers stand a few layers in from it, so its edge pokes 2 to 3 layers into them. Hidden inside the corner; the masu box (1 layer) has the same. | In the chained `shape` (`opened`), stop each layer short of a wall it meets at a corner by that wall's layers there, a mitre. Changes shared code for 0.2 mm out of sight: after the motions. | Medium, deferred |
| Pirate hat | ~~1.5 mm~~ fixed 20 November, step 13 "Open it and stand it up" (bent), and about as deep all through the opening | The band's ends, out past the line from the point to the brim's corners, carried on from the walls' slope (`along` in `pirate-hat.ts`), and at the corners the walls head in towards each other, so each wall's band ends passed through the other's, at the 54° the walls meet at. Real paper presses them flat together between the walls, the hat's two points. | They carry on flat between the walls instead, with `lines` along the point-to-corner lines so the paper can fold there: 0.0005 at rest. The cut band pieces first came out in slivers (7.2% stretch as it played, 68 s to build), so `meshFrame` now lays a face out on a square grid when halving its triangles would leave any corner sharper than 20° (a long narrow face), once the faces around it are halved. The hat's whole band was slivers before, cut or not. Now 2.9% stretch, 33 s to build. Of the other models only the boat's mesh changed, no worse. | Done |
| Rainbow chain | 2.5 mm, steps 14 and 15 | Rigid links set on a ring dip into each other where they cross; real links flex. | Left listed for now (decided 20 November), as an accepted approximation. A wider ring (looks less like the real chain) or links that bend are the ways on, if it's taken up again. | None for now |

✅ `REST` came down from 2.5 layers to 1.5 on 20 November: nothing but the two listed (the rainbow chain and the
shallow masu lid) goes deeper at rest; the boat's opening is next, at 1.3.

Since 20 November `restingCrossings` leaves out a crossing within `NEAR_JOIN` (0.02, 3 mm on a 15 cm sheet) of the
corner two faces meet at: their layers' offset where they're joined, as at a cone's tip, not a point tucked through.
`crossingAt` with `joined: 'edge'` should get the same before CI switches to it (part 2).

## 2. Motions

1. ✅ **Close the blind spot in CI** (20 November). The motion check uses `joined: 'edge'`, with `NEAR_JOIN` as at
   rest. The kusudama's step 6 was 6.4 mm, not a point tucked through: its squash was two folds merged (fold the
   flap in half, open it out), each face taking its own way and the joins pulling a corner down through the diamond.
   `together(…, { inTurn: true })` now plays such folds one after another; it's 0.2 mm. The penguin was only the
   offset beside its shared corner, under the limit once `NEAR_JOIN` left that out.
2. ✅ **Look nearer the ends** (20 November). With 0.05 and 0.95 added, three steps go deeper, each for a moment:
   the heart's "Fold the top down" (1.6 mm at 0.03 of the way: its white side triangles lie on the point that turns
   up through them, so they'd need lifting aside as it starts), the seal's "Raise the neck" (1.0 mm at 0.95, not
   looked at yet) and the dolphin's fins (1.3 mm at 0.05). The heart and seal are listed, the dolphin's limit raised.
   Points between samples go deeper still (the heart is deepest at 0.03): sampling finds steps, not their worst.

   Also found: the viewer plays the `.fold` files, whose rounded coordinates can pick a slightly different way
   through a step than the recipe the checks build (the penguin's step 12: 0.0054 from its file, 0.0046 from its
   recipe). Worth checking from the files too, perhaps in the test that compares them.
3. **Snaps at a step's ends** (found 20 November, working on the squash folds). Looked at every 0.005 in the first
   and last 5% of each step, nine models go deeper than the samples show, the deepest by far: the folds lesson's
   "Fold a square base" (steps 54 and 62, 18 mm at 0.99) and "Crimp" (step 47, 6 mm), the lily's three
   squash-and-petal folds (steps 22, 25 and 28, 7 to 7.5 mm at 0.96 to 0.985), the rainbow chain (5.7 mm), the heart
   (1.8 mm at 0.035), the boat, the diamond ring, the pinwheel and the chrysanthemum (about 1 mm). Most of the deep
   ones aren't grazes but snaps: most of the step's motion in its last 2.5%, as far as a corner goes. The folds
   lesson's square base moves 0.90 of its 1.13 there, the lily's petal folds 0.49 of 0.71, the bases lesson's step 53
   0.49 of 1.42, the rainbow chain's step 14 all of it at the start; the pinwheel, chrysanthemum, butterfly and
   diamond ring less. On screen that's paper jumping into place as the step ends, through whatever's in the way.

   The cause: `joinFixes` (animate.ts) joins the paper up at 40 points through the step, each starting from the
   last one's join. Where the faces' own moves pull the paper well apart, the joins have two settled states: the
   paper as it starts, and as it ends. Carried on from the start, they hold it as it started all through the step,
   and only the end, where the fix is nothing, lets it go, in the last fortieth. Joined up from the end back, they
   hold it as it ends all through, back to the start: the two never come near each other (0.3 to 0.5 apart all
   through, in the lily, crimp and pinwheel), so switching from one to the other anywhere jumps as far, and
   bridging them, joined up from the two blended, falls one way or the other (tried, reverted).

   ✅ **Fixed 20 November** where the faces' own moves can be better:
   - The animator's own checks never saw the jump: they judge the faces' moves without the joins, at points that
     miss the last fortieth, and only stand a flap up first where faces pass through each other, which faces all
     meeting at a point (a petal fold) never do. Now where the paper as drawn jumps in the first or last eightieth
     of a step (`jumps`), standing the moving paper up first (`stagedWays`) is tried too, judged as drawn, joins and
     all, every eightieth (`asDrawn`), and kept where it's clearly shallower, or no deeper and clearly less torn or
     not jumping (`stoodFirst`). The lily's petal folds: 0.040, 0.040, 0.050 to 0.0056, 0.0053, 0.0105, torn 1.7%
     rather than 7.7% (now on `TEARS`). The folds lesson's crimp: torn 0.7% rather than 5.6%, still crossing 0.025
     as its point settles between the layers (on `GRAZES`, as the crane's reverse folds).
   - The folds lesson's square base was its four creases, the collapse and the turn all at once: now the creases
     and collapse, then the turn, in turn (`together`'s `inTurn`, which needed `inTurnVia`'s first frame to point
     back at the frame before the step, and `transitionVia` to match frames with the same faces by their corners).
     18 mm to clean.
   - The checks look at 0.025, 0.975 and 0.99 too (`PLAYING` in collisions.ts, shared with `clip-report`), and the
     tearing check at 0.975 and 0.99.

   ✅ **Then, 20 November:** the kusudama's and chrysanthemum's assembly: `comingIn` moved each face of a unit its own
   way to its place, so a unit bent into shape as it came in came apart in the air (half a sheet), and the joins
   held it as it started until the end. Now each unit moves as its biggest piece that keeps its shape does, and each
   face bends into place relative to that piece, so a face turning about a crease with it stays joined: the
   kusudama 32% apart to under 1%, the chrysanthemum's ball clean. And where a step jumps, the other ways `moving`
   weighed (each face its own way, hinged at each pace, creases in step, a squash as rigid paper folds it:
   `Transition.others`) are judged as drawn too: the butterfly's squash, 1% apart to 0.3%. The pinwheel's squash
   jumps whichever way it moves (all of its ways do, as drawn), so it stays listed.

   **Left, listed** (what the closer look found, beyond the above): the kusudama's and chrysanthemum's assembly
   (units held where they started, let go as the step ends: 32% and 14% apart for a moment, `TEARS`), the rainbow
   chain (4%), the pinwheel's and chrysanthemum's squash (0.0064 through, 1.2% apart: all the paper moves, so
   there's nothing to stand up first), the butterfly's squash (1%, no crossing), the diamond ring (0.0088 as the band
   closes). The way on for those is better moves for the faces before they're joined up, step by step: as here,
   folds in turn, or the units brought in nearer where they end.
4. **Work the `GRAZES` list deepest first, by cause**, as one fix often covers several models:

| Cause | Steps | Approach |
|---|---|---|
| Reverse folds with rigid paper: the point ends between layers staying put on both sides | Crane (neck, tail, head, 1.1 mm), fox (tail) | Not the flap opening as the point turns: that was tried on 8 November ("open, fold, close", `docs/next-tasks-plan.md`, Smaller) and fails on each of these. The crane's flap carries on across the body's centre line, the fox's tail can't open without tearing. Checked again 20 November: the point's layers already turn each about its own crease at its own height, so it isn't the point turning as one block. It's where it lands: between layers that stay put and carry on past the crease, so any flat face turning in cuts through one side by about the stack's thickness (0.0077 on the crane's neck). Real paper bends the body apart near the corner. The way on is the bending one: frames on the way with a finer mesh round the corner, which needs `transitionVia` and the file format to place faces that aren't pieces of the end frame's. Large. |
| Squash and petal folds: layers grazing as they turn | Lily (four flaps, 1.3 mm sampled, but see item 3: 7.5 mm as they snap down at the end), boat (the diamond again, 1.5 mm, grazing all through the step), frog (turning out a back leg, 1.6 mm at 0.8), chrysanthemum, ~~kusudama step 6~~ | Looked at 20 November: the lily's is the snap in item 3. Not `makeWay`, which lifts separate paper (another unit) out of the way, not layers of one sheet. The boat's and frog's not looked into further. |
| Opening out in 3D: the fins swing through the body | Whale and dolphin "Open the fins" (1.3 and 1.4 mm, deepest 0.05 to 0.1 of the way) | Looked at 20 November: not the layers parting late. Each fin lies folded back on the layer it's hinged to, inside the body: the whale's lower fin (layers 1 and 2) has 13 layers above it, the other half of the body. Opening it can only turn it up through them (turned down, it's folding further, into its own layer). At rest the fin's hinge is drawn lifted above the body, so it's clear; on the way it passes through. Real paper parts the body to let it out, or (origami.me) swings the fins out past the belly's open edge. Either needs bending: large. Looked at again 20 November: the cause is earlier, in the fish base. Its collapse lays each little flap under the kite flap it's hinged to (layer 2 of 4, the kite flap's tip over it), where real paper has it on top, so after the body is folded in half each fin is inside its half. Tried: the laying crease as a mountain (can't lie flat); the collapse's `under` with the fins (no effect: both papers move); folding each fin behind about its hinge before the fold in half (it comes out on the outside of the body, but the narrowing and tail folds then cut it differently, so the tail fold and the fins' opening need redoing round it, and the steps' instructions changing). Reverted. |
| A closed tube in rigid paper | Swan "Pull the neck up" (2.0 mm) | Needs bending (PLAN.md, milestone 13). Stays listed until then. |
| Rigid links | Rainbow chain (up to 5 mm) | Left listed for now, as in part 1. |

✅ `GRAZE` came down from 7 layers to 5 on 20 November. Of the six between, the cute cat's and 3D fox's ears (two
folds at once, passing through each other) now fold in turn and cross nothing; the penguin's head, crow's feet and
flapping bird's neck are reverse folds, as the crane's (the flapping bird's 0.013 at its deepest, between samples);
the turtle's back flippers, a four-layer flap whose lower layers dip into the shell as it lands. Those four are
listed. The boat's second squash was looked at too: every other way of moving it crosses 3.5 to 6.6 times deeper
than the rigid squash it uses, so its 1.5 mm stays; the frog's back leg is a reverse fold.

## 3. Bent paper

- ✅ **Bent stacks**, looked at 20 November: specks did show, the samurai helmet's blue through its white horns,
  the cup's white through its green. Stacked layers pass up to 7 layers into each other at rest (the helmet; the cup
  6.4, pirate hat 4.0, balloon rabbit 3.4, boat 2.5), and `LIFT` drew a covered layer only 4 layers back a place, so
  one place back wasn't enough. At 8 (viewer and thumbnails both) the specks are gone; a few hair-thin lines along
  the helmet's creases remain, likely where a fold wraps round other layers rather than stacked layers. The bend
  solver holding its gap at more points (`contacts` in src/fold/bend/solver.ts) is still the way to stop them
  passing through at all, if those show.
- **Bent steps as they play** are left out of both the CI check and the report. Add them to `clip-report`, stacked
  pairs marked, so they're seen at least.

## 4. Catch it before it's built

✅ Done 20 November:

- **When a recipe is built**: `npm run models` checks where each step comes to rest (`clippedSteps` in
  collisions.ts, each frame looked at once) against the limits the model checks use, now in
  src/models/known-clipping.ts (`REST`, `RESTS`, and the playing and tearing lists). Anything deeper is named, model,
  step and title, with its link in the viewer, and it ends in an error once the files are written (so they can
  still be looked at). It says when a listed model no longer clips, to take it off.
- **The report**: each line ends with a link to its step in the viewer, on the dev server or the site `--url` names.
- **The Studio**: under any step where paper passes through paper as it comes to rest, a warning saying how deep
  ("0.3 mm on a 15 cm sheet"). Worked out in the editor as the design changes (each frame once), not when it's
  saved: the bend worker only runs for bends. The admin review queue lists the steps that clip in each submission,
  each a link to it in the viewer (not checked in the browser: it needs an admin sign-in).

## 5. A check of what's drawn (only if clipping is still seen)

If someone reports clipping where `clip-report` is clean, it's in the drawing: `LIFT` ranking bent layers wrongly,
the rounded strips drawn at folds, or depth precision far zoomed out. Then build the check the numbers can't do:
draw still frames from about a dozen directions in the viewer (Playwright), each face's front and back in a colour
of its own, and compare each pixel with the side a ray cast says should show, honouring the layer order. Its first
use would be part 3's bent stacks.

## Order of work

| # | Work | Size |
|---|---|---|
| 1 | ✅ 3D fox and butterfly (20 November); masu box and lids diagnosed and deferred | Small to medium |
| 2 | ✅ Kusudama step 6 and the penguin; CI's motion check to `joined: 'edge'`; samples at 0.05 and 0.95 (20 November) | Medium |
| 3 | Reverse folds: bending round the corner as the point turns in (frames on the way with a finer mesh; format and animator first). Not opening the flap, tried 8 November. | Large, two or three models |
| 4 | ✅ Pirate hat (20 November); the rainbow chain left listed | Medium |
| 5 | ✅ Squash and petal folds, and the snaps at steps' ends (20 November: part 2, item 3); the fins need bending, the boat's and frog's grazes not looked into | Medium |
| 6 | ✅ Recipe-build warning, report links, the Studio's warning and the review queue's (20 November) | Medium |
| 7 | ✅ `REST` to 1.5 layers; bent stacks looked at and `LIFT` doubled; `GRAZE` to 5 layers (20 November); part 5 only if needed | Small, then as needed |

## Progress

| Item | Status |
|---|---|
| Checks and report | Done 15 November (`8f7ff14`). |
| Squirrel, T-rex, chrysanthemum, kusudama at rest | Done 15 November (`f58d3aa`); the kusudama's ball dense again (`b6981f4`). |
| Order of work, row 1 | 20 November: the 3D fox's tail tucked lower; lifted stacks in `shape` turned about their top, which fixed the butterfly (the kusudama's flowers set out to 0.77 to stay clear, 29.5% gaps); crossings beside a shared corner left out at rest. The masu box and lids' cause found, and deferred. Three left on `RESTS`: the rainbow chain, pirate hat and shallow masu lid. |
| Order of work, row 2 | 20 November: CI's motion check compares faces meeting at a point (crossings beside the corner left out), at 0.05 and 0.95 too; the kusudama's squash plays as two folds in turn (`together`'s `inTurn`); the heart and seal listed, the dolphin's limit raised. |
| Order of work, row 3 | 20 November: looked at again before starting. The approach planned (the flap opening as the point turns) was tried on 8 November and fails on these steps; the cause is the point landing between layers that carry on past the crease. Needs the bending way: waiting on a decision. |
| Order of work, row 4 | 20 November: the pirate hat's cause found (its band ends carried on into the other wall at the brim's corners). Lying them flat between the walls along cut lines fixes the clipping but stretches slivers of the mesh 7.2% as it plays and builds in 68 s; not committed, decision needed. The rainbow chain's decision put to the user. Then: the mesher lays long narrow faces out on a grid (`meshFrame`), and the hat's fix went in, off `RESTS` (2.9% stretch, 33 s). The rainbow chain stays listed for now. |
| Order of work, row 5 | 20 November: the whale's and dolphin's fins open from inside the body (needs bending). Looking closely at the ends of steps found snaps, the joins letting paper go only in the last fortieth of a step: the folds lesson 18 mm, the lily 7.5 mm, and others. Then fixed where better moves exist (standing a flap up first, judged as drawn; the square base in turn), and the checks look near the ends; what's left is listed (part 2, item 3). |
| Order of work, row 6 | 20 November: `npm run models` fails on a step clipping at rest beyond its limit, the report links each line to the viewer, and the Studio warns under such a step (the review queue lists them). |
| Order of work, row 7 | 20 November: `REST` down to 1.5 layers (nothing new listed). Bent stacks showed specks (the helmet, the cup); the viewer now draws covered bent layers 8 layers back a place rather than 4, and they're gone. `GRAZE` left at 7: six more would be listed at 5. |
| After the plan (2) | 20 November: the fins' cause traced to the fish base's stacking (part 2's table); not fixed. The reverse folds need bending in a step that ends flat: designed, not built (part 2's table). |
| After the plan | 20 November: assembly snaps fixed (units move as their biggest unbent piece, bending into place relative to it); a jumping step's other ways of moving judged as drawn (the butterfly); the cute cat's and 3D fox's ears in turn; `GRAZE` to 5 layers with the penguin, crow, flapping bird and turtle listed; the boat's and frog's grazes looked at, left (rigid paper's best, and a reverse fold). |
