# Plan: paper through paper (November 2026)

Clipping is the inside of the paper showing through its outside: one face passing through another, so the colour
or the layer that should be hidden pokes out. Where it stands on 20 November 2026, and the order of work to cut it
down further.

## What's there to work with

- **`restingCrossings(model)`** (`src/fold/collisions.ts`): paper through paper in the frame each step comes to
  rest on, what's on screen most. Every pair of faces is compared, bent triangles too, except faces joined along a
  crease. Bent layers lying the same way are marked `stacked`: the viewer draws those in their stacking order where
  they meet (`LIFT` in `FoldedPaper.tsx`).
- **`crossings(model, samples, joined)`**: the same while each step plays, at 0.1 to 0.9 of the way through. With
  `joined` `'point'` (the default, and what CI uses) faces meeting at a single corner on the sheet are skipped; with
  `'edge'` only faces joined along a crease are, which also finds a flap's point tucked through what it meets there.
- **`npm run clip-report`**: both, model by model and step by step, with where on the sheet. `--playing` adds the
  motions (a few minutes for every model), `--stacked` adds bent stacks, `--md <file>` writes Markdown too.
- **The model checks** (`src/models/model-checks.ts`): at rest no deeper than `REST` (2.5 layers, about 0.26 mm on
  a 15 cm sheet) and playing no deeper than `GRAZE` (0.005, about 7 layers), except the models listed in `RESTS`
  and `GRAZES` at what they were measured at. Lists only shrink: a model that's fixed must come off.

Done so far: the checks and report (15 November, `8f7ff14`); the squirrel, T-rex, chrysanthemum and kusudama fixed
at rest, 4 to 10 mm each (`f58d3aa`); the kusudama's ball made dense again without clipping (`b6981f4`).

## Where it stands (20 November 2026)

| | Over the limit | Of which already listed |
|---|---|---|
| At rest, more than 2.5 layers | 5 models: rainbow chain (2.5 mm), pirate hat (1.5 mm), 3D fox, butterfly, shallow masu lid (0.3 to 0.5 mm). The 3D fox and butterfly fixed later that day. | All 5 (`RESTS`) |
| Playing, faces joined at a point included, more than 7 layers | 22 steps in 13 models | 11 models (`GRAZES`); new: the kusudama's "Squash the flaps" (step 6, 5.9 mm) and the penguin's "Turn the head down" (step 12, 0.8 mm) |
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
| Pirate hat | 1.5 mm, step 13 "Open it and stand it up" (bent) | Two triangles of opposite sides cross near the brim's corner as the hat opens. They don't face the same way, so the bend solver's contacts between stacked layers don't hold them apart. | Contacts between those parts of the bend, or open it a little less. | Medium to large |
| Rainbow chain | 2.5 mm, steps 14 and 15 | Rigid links set on a ring dip into each other where they cross; real links flex. | **Decide:** a wider ring so rigid links clear (it looks less like the real chain), links that bend, or leave it listed as an accepted approximation. | Large, or none |

Then bring `REST` down from 2.5 layers to 1.5, measure again and list what's newly over: the masu box, the
lotus's "Open the petals" and the boat's opening are near.

Since 20 November `restingCrossings` leaves out a crossing within `NEAR_JOIN` (0.02, 3 mm on a 15 cm sheet) of the
corner two faces meet at: their layers' offset where they're joined, as at a cone's tip, not a point tucked through.
`crossingAt` with `joined: 'edge'` should get the same before CI switches to it (part 2).

## 2. Motions

1. **Close the blind spot in CI.** Switch the model checks' motion test to `joined: 'edge'`. Only two models go
   newly over `GRAZE` today. Fix the kusudama's step 6 first: 5.9 mm, 0.9 of the way through squashing the first
   petal's flaps, probably a flap swinging through the diamond's tip it meets at a point. Then the penguin's step
   12, or list it at 0.0055.
2. **Look nearer the ends.** Many steps are deepest at 0.9 of the way, the last sample. Add 0.05 and 0.95 to the
   samples (about a fifth more time) and see whether depths grow.
3. **Work the `GRAZES` list deepest first, by cause**, as one fix often covers several models:

| Cause | Steps | Approach |
|---|---|---|
| Reverse folds with rigid paper: the point turns as one through half the flap | Crane (neck, tail, head, 1.1 mm), fox (tail), frog (legs lifted, turned out and bent, up to 1.6 mm), penguin (head) | The flap opens a few degrees as the point turns and closes after it (a staged motion in `animate.ts`), as real paper does. The biggest shared win: about six models. |
| Squash and petal folds: layers grazing as they turn | Lily (four flaps, 1.3 mm), boat (the diamond again, 1.5 mm), frog (squashes), chrysanthemum, kusudama step 6 | Hold the layers apart longer (`makeWay`), or land them in order as the seal's tail now does. |
| Opening out in 3D: the fins swing before the layers part | Whale and dolphin "Open the fins" (1.3 and 1.1 mm, deepest 0.1 of the way) | Part the layers first, then swing. |
| A closed tube in rigid paper | Swan "Pull the neck up" (2.0 mm) | Needs bending (PLAN.md, milestone 13). Stays listed until then. |
| Rigid links | Rainbow chain (up to 5 mm) | As decided in part 1. |

Once the list is down to the swan and the chain, bring `GRAZE` down from 7 layers to 5.

## 3. Bent paper

- **Bent stacks** (the cup, helmet, balloon rabbit and others above) are left to `LIFT` drawing them in their stacking
  order. Look at them rather than assume it works, with part 5's check or by eye. If specks show, have the bend
  solver hold its gap between stacked layers at more points (`contacts` in `src/fold/bend/solver.ts`): today
  they're kept apart at the triangles' corners but can pass into each other between them.
- **Bent steps as they play** are left out of both the CI check and the report. Add them to `clip-report`, stacked
  pairs marked, so they're seen at least.

## 4. Catch it before it's built

- **When a recipe is built**: check each step's resting pose with `restingCrossings` and warn in `npm run models`,
  naming the model and step, so an author finds out at once rather than from the model checks. Then make it an error
  for anything not in `RESTS`.
- **The report**: give each line a link to the step in the viewer (`/learn/<id>?step=<k>`).
- **The Studio**: community designs have no checks at all. Run `restingCrossings` when a design is saved (the bend
  worker already runs then) and warn in the editor ("Paper passes through paper in step 7"); show the same in the
  admin review queue, before a submission is approved.

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
| 2 | Kusudama step 6 and the penguin; CI's motion check to `joined: 'edge'`; samples at 0.05 and 0.95 | Medium |
| 3 | Reverse folds opening their flap as the point turns | Large, about six models |
| 4 | Pirate hat; decide the rainbow chain | Medium to large |
| 5 | Squash and petal folds; the fins | Medium |
| 6 | Recipe-build warning, report links, the Studio's warning | Medium |
| 7 | `REST` to 1.5 layers, `GRAZE` to 5; bent stacks looked at; part 5 only if needed | Small, then as needed |

## Progress

| Item | Status |
|---|---|
| Checks and report | Done 15 November (`8f7ff14`). |
| Squirrel, T-rex, chrysanthemum, kusudama at rest | Done 15 November (`f58d3aa`); the kusudama's ball dense again (`b6981f4`). |
| Order of work, row 1 | 20 November: the 3D fox's tail tucked lower; lifted stacks in `shape` turned about their top, which fixed the butterfly (the kusudama's flowers set out to 0.77 to stay clear, 29.5% gaps); crossings beside a shared corner left out at rest. The masu box and lids' cause found, and deferred. Three left on `RESTS`: the rainbow chain, pirate hat and shallow masu lid. |
