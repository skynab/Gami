# Plan: what's next (November 2026)

Where Gami stands on 7 November 2026 (brought up to date 12 November): the housekeeping done, what's waiting on a decision or on something
only the owner can see, and the order of work after that. Each area keeps its detail in its own plan; this
one points to them and is kept up to date as items close.

Work goes straight onto `dev`, not into worktrees or feature branches (decided 7 November 2026). The `wip/*`
branches stay for experiments that would leave `dev` broken; releases go to `main` by a `dev-to-main-N` pull
request.

## Housekeeping (7 November 2026)

| Item | Status |
|---|---|
| OrigamiOK's intermediate folds | Done 13 November (`docs/origamiok-intermediate-plan.md`): turtle, sunflower, lizard, squirrel, strawberry and a standing fox, all Gami's own; the creeper left out. The strawberry and fox are 3D: the strawberry pops up point down, which needed `popUp`'s `only` and `assemble` after a pop-up (both new). |
| The decision on `PROVENANCE.md` was in the `PLAN.md` decisions log twice | Done: one copy removed. |
| Fold'N Fly plan: "Gami's own planes need names of their own" | Done: they're the corkscrew and the flying saucer. Taken off the open questions. |
| A link here from `PLAN.md` | Done, under the milestones. |
| CI's first run (`Tests`, 7 November, on `dev` at `933b887`) | **Failed in the end-to-end job**: found and fixed 8 November (see "Waiting" below), to confirm on CI. The type check and unit tests passed. The e2e job's report was never uploaded, as Playwright wasn't writing one; on CI it now writes an HTML report, with a trace of each test that fails once and is run again, which the workflow uploads as `playwright-report`. |
| Finished sessions' worktrees | Done: "Lesson: common origami folds", "Lesson: origami bases" and "Standardise fold vocabulary and unfold logic" are archived and their worktrees removed. Their work is all in `dev` (the third's commit, `5dbf414`, landed in another form: `CREASE_KINDS`, `FOLD_KINDS`, `lastFold`). |
| Old branches, and the `fold-grazes` worktree | **Not done.** Auto mode stopped the deletions as irreversible. The commands are under "Branches to delete by hand". |
| Release `dev` to `main` | See Progress at the end. |

## Waiting

Things that can't be settled from the code alone.

- **CI's e2e job, to confirm.** Found 8 November from its log: on the phone, two Studio tests (the tape tool, the
  named folds) waited the whole 30 s to click a tool. A runner's fonts are wider than Windows', so the Studio's
  tool bar wraps onto more lines and leaves less height; on a narrow screen the 3D preview kept its 220 px and
  spilled down over the tools, taking their clicks. And the editor's top bar made the page wider than a phone
  (535 px on a 412 px screen), so it showed zoomed out. Both reproduced here with text spaced wider, and fixed:
  the preview shrinks into what height is left and the Studio's middle is clipped; on screens up to 760 px the
  editor's crowded top bar scrolls sideways in one line (its "Studio" title hidden; a screen-reader label inside it
  had been left past the screen's edge); a long hint wraps. A new test checks the editor fits the screen and its
  tools take taps (it fails on the old layout). Passes here; confirm on CI's next run, after a push.
- **The New cutoff.** `NEW_SINCE` is `2026-10-28`, so 40 models show as New: 24 added on 28 October, 10 on
  29 October and 6 on 13 November (OrigamiOK's intermediate batch, `docs/origamiok-intermediate-plan.md`). Move it
  to `2026-11-13` to keep only the new batch's stars, or leave it.
- **Sword or easy sword.** `easy-sword` (one square, 9 steps, difficulty 1) went in on 29 October "to compare
  with `sword` and keep the better one" (`sword`: a 1 × 4 strip, 14 steps, difficulty 2). Keep both, or drop one
  (its recipe, catalog entry, files, step translations and `PROVENANCE.md` row, and its line in
  `DESIGNS-LICENSE.md`).
- **The `paper-breaking-bug` branch** (on GitHub too). One commit from 25 October, "only part way through
  figuring out the problem": scripts in `.tmp-scripts/` measuring how far paper comes apart mid-step (petal
  folds, the pajarita's swivels, the king bee's ailerons), and changes to `animate.ts`, the bend solver and the
  ninja star. It's 79 commits behind `dev`. "Creases round a point fold in step" and "Paper joined up sooner, and
  to the end" (November) took on the same problem, so it's probably done with. Check its list against `dev`,
  then delete it here and on GitHub, or pick it up.
- ✅ **The Studio's submissions** (`docs/studio-plan.md`, part 4: ownership and licence): decided and made 13
  November. **Before deploying**, run the new migration (`20261113000000_submissions.sql`) on the Supabase project
  (`docs/accounts.md`). Its other open questions are settled and done: the cloud panel stays for creators with Submit
  hidden, share links carry a design in the address, a short tour on the first visit, and phones get a note
  that the Studio is easiest on a bigger screen.
- **The Spin Plane's designer** (`docs/foldnfly-planes-plan.md`): Laux's, or Unattributed? Needs his book's
  contents.
- **The bending plan's last open question** (`docs/bending-plan.md`): whether the mesh pattern needs to be finer
  near the fan's pinched end. Re-solving bends on replay and a bend tool in the Studio were both settled by
  Studio row 6.

## Branches to delete by hand

All merged into both `dev` and `main` (`git branch -d` refuses anything that isn't):

```bash
git branch -d deb-to-main-minor-polish dev-to-main dev-to-main-4 dev-to-main-6 dev-to-main-mobile-upgrade main-build-source main-to-dev-2
```

The `fold-grazes` worktree, at `dev`'s tip with nothing of its own (its `.tmp/` holds scratch scripts and a
copy of `animate.ts` as `dev` has it):

```bash
git worktree remove --force .claude/worktrees/fold-grazes && git branch -d worktree-fold-grazes
```

The archived sessions' branches:

```bash
git branch -d claude/lesson-bases-cf4d91 claude/lesson-folds-cc4e1d && git branch -D claude/sharp-mccarthy-24d693
```

(`-D` for the last: its commit isn't in `dev` as such, only its changes.)

## Order of work

### 1. Bending: the three coming-soon models (`docs/bending-plan.md`)

The cup showed the way: work the shape out first and lead the paper there with guides, rather than leaving the
solver to find it from a few goals. The other `wip/*` branches are 100 to 210 commits behind `dev`. The fan and
the boat are in the gallery; the iris is still to come.

| # | Work | Needs bending? |
|---|---|---|
| 1 | ✅ **Boat, as far as the small diamond.** The second squash stacks the small diamond as paper does (9 November), and since 12 November right side out: the folded-up points outside, the pocket inside (bending plan, step 7, "The small diamond, right side out"). The squashes pass paper through paper by 0.004 and 0.010, the second on `GRAZES` (kept joined, its creases can't all fold in step). | No |
| 2 | ✅ **Fan.** In the gallery (7 November): redesigned to fold as origami.me does, so it can open at all; the spread guided as a book's pages fanned round a half circle; thin faces now meshed in rows, which also helps the 3D tulip (bending plan, step 6). | Yes |
| 3 | ✅ **Boat's opening.** In the gallery (9 November), as two steps: a collapse into a boat lying flat, then a bend opening it out and standing it on its keel, only the corner flaps' lower triangles bending (bending plan, step 7, "In the gallery"). Since 12 November the collapse plays as rigid paper folds it (0.003 through itself, 0.019 before), and the opening bends nothing. `scripts/boat-opening-lab.ts` was for the old stacking and is no longer needed. | No, as it turned out |
| 4 | ✅ **Balloon blown up** (8 November): the gallery's balloon now blows up into a cube, guided face by face, its ends crumpling on the way (bending plan, "Improving the solver", row 11). The 3D tulip was still blown up by air into a pillow until 12 November: it's the same base wrapped narrower, so the balloon's map leads it too, into a box twice as tall as wide, stood on end (bending plan, "The tulip bloom, led as the balloon is"). | Yes |
| 5 | ✅ **Shallow masu lid's locks** (10 November). They came apart by up to 0.08 as the flap went over the wall, and `shape` refused the locks part-way. It wasn't the paper: the flap's sides, folded over onto it, turned over the wall the same way round as the flap rather than the other way (as they already did going down onto the floor). A half turn either way ends in the same place, so only the way there was wrong. Turned the other way round, every pose on the way holds together; the locks part by 0.005 at most and graze 0.003 (0.0077 before). The box and the plain lid play as before. No bending needed. | No |
| 6 | **Iris.** Needs paper that bends and then lies flat again. Last. Surveyed 11 November: five of its eight swivels can be made with rigid paper, and no order makes the rest (`docs/bending-plan.md`, step 8). | Yes |

### 2. Grazes

`GRAZES` in `src/models/model-checks.ts` (until 11 November in `models.test.ts`) lets models pass paper through
paper deeper than a few layers (0.005). Each one taken off is a small, tested win; the test fails once a model no
longer needs its entry, so the list can't go stale. Depths as measured on 11 November, each entry allowing a little
more (the frog's tightened from 0.013 to 0.011):

| Model | Depth | Where |
|---|---|---|
| Rainbow chain | 0.033 | Joining the ends (step 15): rigid links set on a ring dip into each other where they cross. |
| Boat | 0.0099 | The second squash (step 13), its twelve layers grazing as they turn: about a hundred pairs of faces, none deeper. Pulling the small diamond out into a boat was the deepest (0.019) until 12 November, when the small diamond was folded right side out and the pull played as rigid paper folds it (0.003; bending plan, step 7). Before that the second squash tore by 0.36 halfway (the back wall's halves apart at the gunwale's middle) and grazed 0.032: its paper moves as four panels about the small hat's top, a squash rigid paper folds with one freedom, but it starts and ends flat, where its two ways of folding meet, and folding in step took the other way. Fixed 10 November: when folding in step fails, the animator works such a squash out as a spherical four-bar (`vertexFold` in `animate.ts`), one panel turning steadily and the next as far as keeps the fourth's two creases at their angle, and keeps it over paper tearing apart. It stays joined (0.008, the stack's thickness) and grazes 0.008. |
| Swan | 0.013 | Pulling up the neck. With rigid paper its body is a closed tube (milestone 13); likely a dead end without bending. |
| Frog | 0.0106 | Turning out a back leg (step 45); 0.0094 lifting the other front leg against the other front quarter (44) and bending the front legs (47, 48). Landing the leg's layers one after another grazes 0.0086 there, but needs the whole step joined up to show it doesn't tear, which more than doubled the frog's time (tried 11 November). |
| Lily | 0.0085 | Its squash-and-petal folds (steps 22, 25, 28), joined up all the way. Step 25 deepest; 22 at 0.0075, 28 at 0.0068, 31 at 0.0061. |
| Whale | 0.0087 | Opening the fins out in 3D. Both fins lie in pockets (10 November): the top one under the body's top layer, the bottom one between its bottom layer and the layers above, so opening either way passes it through paper; the bottom one, rising, passes the whole body near its crease. Bent down instead (9 November), either fin goes deeper (0.012, 0.014) and below the table. A recipe that freed the fins first would be needed. |
| Shallow masu lid | 0.0072 | Raising the walls (step 30): riding layers sit a little off the faces they ride on. Measured 12 November: about s = 0.6–0.75, faces by the corners (on the sheet near (±0.33, ±0.02) against (±0.14, ±0.44)). |
| Crane | 0.0076 | Reverse-folding the neck (step 27); the tail 0.0056 and head 0.0050. The point turns as one and settles in between the flap's halves (see "Reverse folds' animation" under Smaller). |
| Fox | 0.0070 | Folding the tail in (step 14), a reverse fold as the crane's. |
| Dolphin | 0.0071 | Opening the fins out in 3D: as the whale. |
| ✅ Seal | 0.0048 | Off the list (11 November). Its tail's reverse fold (step 18) grazed 0.0050: layers may now land one after another over up to 0.8 of a step, not 0.4 (`LANDS` in `animate.ts`), and over 0.6 the tail grazes 0.0048. No other model goes deeper, or comes further apart than 0.01; working out every model's steps takes about 3% longer. |
| ✅ King bee | 0 | Off the list (10 November). The first wing is turned right over (by the body's bend and its own), and `shape` lifts paper turned right over so its layers stack upside down. The aileron, turned a little further, wasn't turned right over, so it was lifted along its own slanting way up instead: 49 layers down and to the side, 3 cm off its hinge, and through the wingtip. Paper turned further on paper turned right over is now lifted as that paper is. The first wingtips of the king bee and the corkscrew were off their wings the same way (3.5 and 1.4 mm). |

Tried 12 November on the frog, lily and shallow lid: landing layers over up to 0.9 of a step as well (`LANDS`) changes
none of their depths, and the frog then comes apart by 0.011, over `TEAR`. Each still on the list needs its own look at
the step, as the seal's and the king bee's had; a wider landing spread doesn't take them off.

### 2b. Paper coming apart while a step plays

The tests checked paper passing through paper as models play, but not joined paper coming apart, which is how
the boat's small diamond tearing by 0.36 halfway went unnoticed (fixed 10 November). Since 11 November they check
that too (`partings` in `collisions.ts`, `TEARS` in `src/models/model-checks.ts`): at 19 points through every step,
how much further each point of paper on several faces strays from where its corners are on average than it does
at either end of the step, as the viewer draws it. What's apart at the ends anyway doesn't count: the gaps between
layers at a fold, paper riding on paper, a cut's two sides. (A first survey, on 10 November, measured the copies'
whole distance apart and counted those gaps, which made the rainbow chain's links look torn by 0.39; they part by
0.002.) Up to 0.01 is allowed, about a 14-layer stack's thickness, 1.5 mm on a 15 cm sheet. Four models went
further, each for a moment near a step's end; since 11 November none does, and `TEARS` is empty:

| Model | Apart | Where | Now | Why it parted |
|---|---|---|---|---|
| Lily | 0.033 | Squash and petal-folding a back flap (step 28) | 0.004 | Joining up carried on from the moment before, which held a face the wrong way round near the end. |
| Seal | 0.019 | Raising the neck (step 17), a reverse fold | 0.0045 | Joined, it grazed 0.0066 rather than 0.0047, and only a tear past 0.05 bought a deeper graze. |
| Frog | 0.019 | Lifting the other front leg (step 44) | 0.006 | Its layers landed one after another, though some are joined across a crease. |
| Fox | 0.012 | Folding the tail in (step 14), a reverse fold | 0.0015 | As the lily: joined from the paper as it moves, it grazes no deeper than it already does. |

Three changes in `animate.ts`, none changing a model's files or how long working out the steps takes:
- Where paper can't be joined up at a point, starting from where the joins either side leave it, it's also
  joined starting from the paper as it moves.
- Where joining up within the graze it lets by would still leave the paper more than 0.01 further apart than at
  either end, a deeper graze is let by, 0.2 of one for each sheet width it has opened past that. (Before, only a
  tear past 0.05 did. Let by everywhere, it took the crow's feet 0.0002 past a few layers, where a partial join
  kept them together anyway.)
- Layers land one after another (`landInOrder`) only if that opens the paper no further than landing all
  together, or than 0.01, unless it can be joined up again where it's furthest apart within that graze. Checked
  at that one point, as joining up the whole step for each way of landing doubled the time the crane took.

The frog now grazes a little deeper, 0.0106 at most (step 45) against 0.0094, still inside its `GRAZES` entry.

### 3. Studio (`docs/studio-plan.md`)

| Row | Work | Size |
|---|---|---|
| 5 | ✅ Swivel and open sink as named folds (8 November) | Medium |
| 6 | ✅ Bend with crease goals, solved in a worker, baked on save (11 November; `docs/studio-plan.md`) | Large |
| 7 | Bend with point goals (3D handles) | Large, and only if 6 shows the need |
| 8 | ✅ Submissions with ownership and licence (13 November): decided that day as CC BY 4.0 only, anyone signed in, and a Report button feeding the admin queue; see `docs/studio-plan.md`, part 4, and `docs/accounts.md` | Large |

### 4. Smaller

- ✅ **Reverse folds stacked the point wrongly** (found and fixed 8 November, making the open sink). `collapse`
  worked out where a reverse fold's point tucks in (the middle of the flap's stack) from the faces the crease
  crosses, but only after cutting them along it (or after an earlier crease had), so it was always 0: every
  `inside` crease laid the point behind all the flap's layers, every `outside` one in front. Models looked right
  from the front but wrong from behind and as they played, and an outside reverse fold showed the wrong colour. Now
  each face along the crease asks whether more of the faces staying put on the same stretch of it lie over it or
  under it, and each half of the point turns over on its own (its layers swap among themselves, but stay on their
  side of the other half's), which the layer solver's "keep the order of paper moving together" now knows. Ten
  models fold differently from their first reverse fold on (the crane, crow, corkscrew, fox, frog, penguin, seal,
  swan, whale and the common-folds lesson); nine more only record their squashes' and petal folds' face lists
  differently, their paper the same. Their files are made again. As they play, though, the crane's three reverse folds, the
  fox's tail and the seal's tail pass paper through paper further than before (up to 0.0076, against 0.005
  allowed), and the swan's neck 0.0135 (0.013 allowed): the animation turns each half of the point about its own
  crease, opposite ways, and tucked into the middle the halves' tips pass through each other by about the
  stack's thickness, where real paper opens the flap a little first. Allowed for now (`GRAZES`: the crane, fox
  and seal added, the swan's raised; two collision tests leave those steps out).
- **Reverse folds' animation, with the point in the middle.** Tried 8 November: the flap's upper half (found from
  the frames: moving paper ending sandwiched between paper staying put) tilted up about the fold joining it to
  the lower half, as paper making way does, with the two halves of the point turning opposite ways into the gap.
  On the crane's neck it passed more paper through paper (117–167 crossings against 97) and pulled the point
  apart by 0.4: the point's halves are joined along its own folded edge, and turning different ways they part.
  It's the geometry, not the tilt. Where the reverse crease meets the flap's folded edge, two straight creases
  cross, and rigid paper can fold only one of two crossing lines at a time: a rigid inside reverse fold opens the
  flap right out, folds the point and closes it again. Real paper bends a little near that point instead.

  Open, fold, close was tried next, the same day. The flap's upper side (all the paper joined to the upper half of
  the point other than across the flap's folded edge) opens out flat, or nearly, about that edge, then everything
  folds back up from there, the creases round the corner in step (`inStep`, with a little more slack for a thick
  stack). Bending near the corner wasn't tried: the animator's faces are large polygons, and at a 90° opening the
  point's halves disagree by about 70°, which dragging corners would smear; a fine mesh there means running the
  bend solver for every reverse fold. Open, fold, close works on a flap that's free to open: the seal's neck
  (step 17, not one of the grazing steps) opened cleanly and closed in step, and paper went a tenth as deep
  (summed over the step), though its deepest graze rose from 0.0043 to 0.0048. But none of the four grazing
  steps is such a flap:
  - The crane's neck, tail and head: the legs' folded edges lie on the body's centre line, and the upper side
    carries on flat across that line into the other half of the body. Opened out, it swings over through that
    half (the opening alone passed through paper 5.7 deep, summed, against 1.3 for the whole step now).
  - The fox's tail and the seal's tail: the flap's two sides are joined away from its folded edge too, so it
    can't open without tearing.
  - The swan's neck: it opens cleanly, but it can't fold back up in step: the paper comes apart further the
    further it closes (0.003, 0.008 and 0.012 of slack each ran out mid-way), and the other ways of closing tear
    it (0.09–0.15).

  So real paper does what these steps need by bending the body (the crane's sides bowing apart), not by swinging
  a free side open. The way on, if it's worth it, is the bending one: a fine mesh round the corner, solved per
  step, ahead of time (the gallery's ~20 reverse folds). Until then, the point turning as one block and settling
  in between, as now, passes through about half the stack at most.

  Measured again 12 November, face by face, on the three steps still on `GRAZES` (the crane's neck and tail, the
  fox's tail; the crane's head is at 0.0051): the grazes all come at the end of the step, from s ≈ 0.75 for the neck and 0.9 for
  the tails, and stay at their depth until the point lands. They aren't the point's tip slipping between the
  flap's halves. On the crane's neck the point (eight layers, as one block) swings round under the stack and
  comes up into place, so every layer of it passes up through the four layers that stay below it (the body's,
  faces 48–54). The depth, 0.0077, is how high the point's top layer is hinged above the bottom layer: just past its
  hinge that layer lies under the bottom one for the whole last stretch of the swing. Swung round over the top
  instead (`moving`'s `yielding` way, forced), the depths are the same to four places, as the four layers above
  (the flap's near half, which already shift up to make room) are as thick. Neither side's layers can get out of
  the way rigidly: they're joined to the body along the flap's folded edge, and the point lies along that edge,
  so tilting them about it lifts nothing where the point passes. That leaves the bending way above. It needs
  frames on the way with a finer mesh than the step's end, which `transitionVia` can't place (each final face
  has to be a piece of one face of each frame on the way), so it's work on the format and the animator before
  any model.

- **Three reverse folds keep the old stacking.** The tulip's stem pulled out, the swan's head, and the flapping
  bird's tail (and so its neck and head, folded over it): stacked about the middle, they can't keep the paper that
  stays put in its order, so `collapse` falls back to the old stacking for them, every order kept, and their frames
  are as before. Traced on the bird's tail, the four layers of the leg judge their halves rightly, so it's the
  paper round them (the wings) that won't let the tips into the middle with rigid layers. Worth a look: whether
  those folds are better made as something other than a plain `inside` crease.

  Looked at 12 November: kept as they are. Logging each stacking `collapse` tries shows all three folds fail every
  stacking about the middle, keeping the order of all the paper moving together, only of paper still hinged
  together, or only of the paper staying put. So it isn't one order that's too strict: no flat stacking has
  the points in the middle. Something other than a plain `inside` crease would mean teaching a different fold: the flapping bird's
  tail and neck, and the swan's head, are inside reverse folds as people fold them. The tulip's stem is pulled
  out, which also ends as an inside reverse fold.
- ✅ **The unit tests took seven and a half minutes** (444 s on four cores, 11 November), nearly all of it one file:
  `models.test.ts` built every model (136 s) and checked each in turn (308 s) in one test worker, while
  `guides.test.ts` built them all again to work out every step's guides (185 s), and `collisions.test.ts` and
  the step translations' test built them all too, for a few models or their step titles. Now the checks on each
  model are in `src/models/model-checks.ts`, run in four shards (`models-1.test.ts` to `models-4.test.ts`, every
  fourth recipe) that each build only their own models; the guides are one more check on each model, reusing the
  motions the crossings check worked out; `collisions.test.ts` builds only the 18 models it looks at; and the step
  translations are checked against the models' files. 217 s, with 1075 tests (80 more: one guides check a model).
  The kusudama alone takes 84 s of checks, so its shard sets the pace; three or six shards would put the
  kusudama, rainbow chain, balloon and cup in one.
- ✅ **The fold engine's messages in every language** (13 November; milestone 9 had left them English only). The
  62 things the engine says when a fold can't be made (a squash with no flap there, a cut that misses the paper,
  folds that can't lie flat) are kept by code in `src/fold/messages.ts`, in English, which `en.ts` takes as its
  `fold` section, and are translated in `ja.ts`, `es.ts` and `fr.ts`. An error is made from its code
  (`new FoldError('cutMissesPaper')`), with any values it fills in, and its message is still the English, so recipes,
  tests and logs read as before. It keeps its code through a model folded again (`replay`'s `error`, kept with a
  design as its problem), the bend worker (`said` posts it as plain data) and share links (a step's error inside the
  link's). The Studio says it with `sayFold` (`src/i18n`), in the language chosen at the time, and a named fold's
  message follows a change of language. Left in English: messages for recipe authors (naming the model and step),
  for malformed `.fold` files (naming the path in the file), and the bend solver's checks on its own goals. A test
  checks every code used in the source is one the engine knows, so a misspelt one can't quietly show as English.
  Noticed on the way: the 2D editor's label, "The paper from above", is English in every language.
- ✅ **Recipes making named folds with the presets** (12 November), where a preset makes the same fold. The bird
  base's petal folds (`squareBaseFlaps` in `bird-base.ts`) are now `Recipe.preset` picked at the flap's free corner,
  in the crane, crow, flapping bird and both lessons. Their paper is identical; only each step's recorded collapse
  differs, plus noise in the 16th decimal of later steps' points. A search (each preset, picked at every corner of the
  top layer, against every collapse in the gallery) found no other fold a preset makes the same way. The frog
  base's squashes open an unfolded top layer, which the squash preset doesn't (it wants a flap folded over at the
  corner). The lily's folds are a squash and a petal in one step. The boat's and fox's squashes, and the
  reverse folds, have no preset, and the crimps, pleats and swivels were left as they are (the swivels already go
  through `Recipe.swivel`, which the swivel preset matches).
- ✅ **CI's actions on Node 24** (12 November): `checkout`, `setup-node` and `upload-artifact` moved from `@v4`
  (built for Node 20, which GitHub has deprecated) to `@v7`, and Pages' `upload-pages-artifact@v3` and
  `deploy-pages@v4` to `@v5`. None of the breaking changes on the way reach these workflows: they don't use
  `pull_request_target`, a registry token or dotfiles in `dist`. To confirm on CI's next run, after a push.
  `ubuntu-latest` is also moving to Ubuntu 26.

## Progress

| Item | Status |
|---|---|
| Housekeeping | Done but for the branches (above). 12 November: settled questions taken off "Waiting", CI's actions moved to Node 24 (see Smaller). |
| Studio, rows 6 and the open questions | Done 11 November: bend with crease goals, share links, a first-visit tour, a note on phones, Submit hidden (`docs/studio-plan.md`). |
| Unit tests' speed | Done 11 November: 444 s to 217 s, the model checks in four shards (see Smaller). |
| Grazes | 11 November: the seal off the list (landing in order over up to 0.8 of a step), the frog's entry tightened, every depth measured again (see 2). |
| Studio, row 5 | Done 8 November: swivel and open sink in the Studio's Named fold (`src/fold/presets.ts`); see `docs/studio-plan.md`. In the common-folds lesson since 11 November (two sections, 66 steps), the sink made with `Recipe.preset`. |
| Reverse folds' stacking | Fixed 8 November (see Smaller): points tuck into the middle of the flap; three folds keep the old stacking. |
| Bending, rows 1 and 3 (boat) | Done 9 November: in the gallery, pulled out flat by a collapse and opened by a bend (`docs/bending-plan.md`, step 7). |
| Bending, row 2 (fan) | Done 7 November: in the gallery. |
| Bending, row 4 (balloon) | Done 8 November: guided into the cube (`src/models/recipes/balloon-cube.ts`), folding along its edges, the paper at its ends allowed to crumple on the way (`crumple`), which ended the snapping. |
| Improving the solver (bending plan, "Improving the solver") | Rows 1 and 2 done 8 November: bent models' files written compactly (a third to a fifth of the size), and `npm run bend-report`. Row 3 tried and dropped: the paper isn't falling behind; each stage ends stretched and the lengths set at its end ignore the guides. Row 6 done 8 November for guided bends: each stage brought to the least of one energy; tuned, the fan and the cup (now in ten stages) are better than with the passes, and were made again with it. The balloon's ends locked (they'd have to crumple): row 11, done the same day, lets them. Row 9's fixed folds done: a bend can name lines on the table to fold along, and the mesh is cut along them. |
