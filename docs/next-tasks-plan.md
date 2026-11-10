# Plan: what's next (November 2026)

Where Gami stands on 7 November 2026: the housekeeping done, what's waiting on a decision or on something
only the owner can see, and the order of work after that. Each area keeps its detail in its own plan; this
one points to them and is kept up to date as items close.

Work goes straight onto `dev`, not into worktrees or feature branches (decided 7 November 2026). The `wip/*`
branches stay for experiments that would leave `dev` broken; releases go to `main` by a `dev-to-main-N` pull
request.

## Housekeeping (7 November 2026)

| Item | Status |
|---|---|
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
- **The New cutoff.** `NEW_SINCE` is `2026-10-28`, so 34 models show as New: 24 added on 28 October and 10 on
  29 October. Nothing has been added since, so moving it past the 29th leaves the New filter empty. Either leave
  it until the next batch, or move it to `2026-10-29` to keep only the last batch's stars.
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
- **The Studio's open questions** (`docs/studio-plan.md`): keep the cloud panel for creators, share links that
  carry a design in the address, a first-fold tour, phones. Part 4 (submissions with ownership and licence)
  needs its decisions before any work starts.
- **The Spin Plane's designer** (`docs/foldnfly-planes-plan.md`): Laux's, or Unattributed? Needs his book's
  contents.
- **The bending plan's open questions** (`docs/bending-plan.md`): re-solving bends on replay, the mesh pattern,
  a bend tool in the Studio.

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
| 1 | ✅ **Boat, as far as the small diamond.** The second squash stacks the small diamond as paper does (9 November). The squashes pass paper through paper by 0.007 and 0.032, the second on `GRAZES` (kept joined, its creases can't all fold in step). | No |
| 2 | ✅ **Fan.** In the gallery (7 November): redesigned to fold as origami.me does, so it can open at all; the spread guided as a book's pages fanned round a half circle; thin faces now meshed in rows, which also helps the 3D tulip (bending plan, step 6). | Yes |
| 3 | ✅ **Boat's opening.** In the gallery (9 November), as two steps: a collapse into a boat lying flat, then a bend opening it out and standing it on its keel, only the corner flaps' lower triangles bending (bending plan, step 7, "In the gallery"). `scripts/boat-opening-lab.ts` was for the old stacking and is no longer needed. | Yes |
| 4 | ✅ **Balloon blown up** (8 November): the gallery's balloon now blows up into a cube, guided face by face, its ends crumpling on the way (bending plan, "Improving the solver", row 11). The 3D tulip is still blown up by air into a pillow; guiding it the same way would need its own map. | Yes |
| 5 | ✅ **Shallow masu lid's locks** (10 November). They came apart by up to 0.08 as the flap went over the wall, and `shape` refused the locks part-way. It wasn't the paper: the flap's sides, folded over onto it, turned over the wall the same way round as the flap rather than the other way (as they already did going down onto the floor). A half turn either way ends in the same place, so only the way there was wrong. Turned the other way round, every pose on the way holds together; the locks part by 0.005 at most and graze 0.003 (0.0077 before). The box and the plain lid play as before. No bending needed. | No |
| 6 | **Iris.** Needs paper that bends and then lies flat again. Last. | Yes |

### 2. Grazes

`GRAZES` in `src/models/models.test.ts` lets models pass paper through paper deeper than a few layers
(0.005). Each one taken off is a small, tested win; the test fails once a model no longer needs its entry, so the
list can't go stale.

| Model | Depth | Where |
|---|---|---|
| Rainbow chain | 0.034 | Joining the ends: rigid links set on a ring dip into each other where they cross. |
| Boat | 0.032 | The second squash (step 13). Worse than its graze: halfway, the back wall's two halves part by 0.36 at the gunwale's middle, which shows (10 November). Folded in step, the creases keep the paper joined until about a quarter of the way, then drift apart steadily (0.003, 0.0036, 0.0041, ...): with the corner flaps and gunwales staying folded along the small hat's sides, the squash isn't rigidly foldable, so a looser allowance wouldn't help. Real paper bends there. Also tried (10 November): letting every hinge turn in step, including creases that start and end folded, still parts a quarter of the way; allowed to part by up to 0.01, the joined path stays joined but folds the paper another way, several creases ending far from their places (−2° for 180°), and jumps at the end. So it needs a path worked out for it and played through in-between frames, which a collapse can't carry yet (replay works each step out from its operation and drops stored frames), and bent in-between frames can't sit between flat ones (their triangles don't map back onto the faces). |
| Swan | 0.013 | Pulling up the neck. With rigid paper its body is a closed tube (milestone 13); likely a dead end without bending. |
| Frog | 0.013 | Lifting the front legs, against the other front quarter. |
| Lily | 0.009 | Its squash-and-petal folds, joined up all the way. |
| Whale | 0.009 | Opening the fins out in 3D. Both fins lie in pockets (10 November): the top one under the body's top layer, the bottom one between its bottom layer and the layers above, so opening either way passes it through paper; the bottom one, rising, passes the whole body near its crease. Bent down instead (9 November), either fin goes deeper (0.012, 0.014) and below the table. A recipe that freed the fins first would be needed. |
| Shallow masu lid | 0.0085 | Raising the walls: riding layers sit a little off the faces they ride on. |
| Dolphin | 0.0075 | Opening the fins out in 3D: as the whale. |
| ✅ King bee | 0 | Off the list (10 November). The first wing is turned right over (by the body's bend and its own), and `shape` lifts paper turned right over so its layers stack upside down. The aileron, turned a little further, wasn't turned right over, so it was lifted along its own slanting way up instead: 49 layers down and to the side, 3 cm off its hinge, and through the wingtip. Paper turned further on paper turned right over is now lifted as that paper is. The first wingtips of the king bee and the corkscrew were off their wings the same way (3.5 and 1.4 mm). |

### 3. Studio (`docs/studio-plan.md`)

| Row | Work | Size |
|---|---|---|
| 5 | ✅ Swivel and open sink as named folds (8 November) | Medium |
| 6 | Bend with crease goals, solved in a worker, baked on save | Large; after the fan and boat have proved guides |
| 7 | Bend with point goals (3D handles) | Large, and only if 6 shows the need |
| 8 | Submissions with ownership and licence | Large; needs decisions first |

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

- **Three reverse folds keep the old stacking.** The tulip's stem pulled out, the swan's head, and the flapping
  bird's tail (and so its neck and head, folded over it): stacked about the middle, they can't keep the paper that
  stays put in its order, so `collapse` falls back to the old stacking for them, every order kept, and their frames
  are as before. Traced on the bird's tail, the four layers of the leg judge their halves rightly, so it's the
  paper round them (the wings) that won't let the tips into the middle with rigid layers. Worth a look: whether
  those folds are better made as something other than a plain `inside` crease.
- The fold engine's error messages are still English only (milestone 9 left them).
- The recipes make named folds their own way; they could call `src/fold/presets.ts`, which the tests show gives
  the same paper.
- CI's actions (`checkout`, `setup-node`, `upload-artifact`, all `@v4`) are built for Node 20, which GitHub has
  deprecated; it runs them on Node 24 for now. Move them on when convenient. `ubuntu-latest` is also moving to
  Ubuntu 26.

## Progress

| Item | Status |
|---|---|
| Housekeeping | Done but for the branches (above). |
| Studio, row 5 | Done 8 November: swivel and open sink in the Studio's Named fold (`src/fold/presets.ts`); see `docs/studio-plan.md`. Not yet in the common-folds lesson. |
| Reverse folds' stacking | Fixed 8 November (see Smaller): points tuck into the middle of the flap; three folds keep the old stacking. |
| Bending, rows 1 and 3 (boat) | Done 9 November: in the gallery, pulled out flat by a collapse and opened by a bend (`docs/bending-plan.md`, step 7). |
| Bending, row 2 (fan) | Done 7 November: in the gallery. |
| Bending, row 4 (balloon) | Done 8 November: guided into the cube (`src/models/recipes/balloon-cube.ts`), folding along its edges, the paper at its ends allowed to crumple on the way (`crumple`), which ended the snapping. |
| Improving the solver (bending plan, "Improving the solver") | Rows 1 and 2 done 8 November: bent models' files written compactly (a third to a fifth of the size), and `npm run bend-report`. Row 3 tried and dropped: the paper isn't falling behind; each stage ends stretched and the lengths set at its end ignore the guides. Row 6 done 8 November for guided bends: each stage brought to the least of one energy; tuned, the fan and the cup (now in ten stages) are better than with the passes, and were made again with it. The balloon's ends locked (they'd have to crumple): row 11, done the same day, lets them. Row 9's fixed folds done: a bend can name lines on the table to fold along, and the mesh is cut along them. |
