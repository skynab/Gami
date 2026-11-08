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
- **How a paper boat's small diamond comes apart.** The boat is parked (8 November 2026): its guided opening
  tangles where the diamond's two halves interlock (`docs/bending-plan.md`, step 7). A real paper boat, folded
  to the small diamond and opened slowly, would show whether the starboard wall's bow triangle and the port
  wall's bow brim come apart, and how, or stay tucked round each other in the finished boat.
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
solver to find it from a few goals. The other `wip/*` branches are 100 to 210 commits behind `dev`; the boat's
recipe is on `dev` now, not yet in the gallery's list. The fan is in the gallery.

| # | Work | Needs bending? |
|---|---|---|
| 1 | **Boat, as far as the small diamond.** Parked with row 3 (8 November). On `dev`. The squashes now pass paper through paper by 0.007 and 0.025 (they were 14 cm and 1.7 cm). The second can't fold in step: kept joined, its creases follow another way of folding (bending plan, step 7). Next: live with 0.025 on `GRAZES`, or find what keeps its creases on this way of folding. | No |
| 2 | ✅ **Fan.** In the gallery (7 November): redesigned to fold as origami.me does, so it can open at all; the spread guided as a book's pages fanned round a half circle; thin faces now meshed in rows, which also helps the 3D tulip (bending plan, step 6). | Yes |
| 3 | **Boat's opening.** Parked (8 November) until a real paper boat has been watched opening (see "Waiting"). Its shape is worked out and holds together, but the guided path tangles where the small diamond's two halves interlock (bending plan, step 7; `scripts/boat-opening-lab.ts`). Next: watch a real paper boat open to see how the interlock comes apart, or whether it stays. | Yes |
| 4 | **Balloon blown up**, and the 3D tulip with it. The cube is worked out face by face and the solver reaches it, but the way there pops through at T and the hole (30% stretch as it plays): the ends' side triangles can't open without a fold moving across the paper, which the solver won't make, sharp or rolled, at any mesh tried (bending plan, step 7, the paper balloon; `scripts/balloon-cube-lab.ts`). The gallery's balloon is unchanged. | Yes |
| 5 | **Shallow masu lid's locks.** They come apart by up to 0.08 as the flap goes over the wall; with rigid paper the flap is locked there. | Yes |
| 6 | **Iris.** Needs paper that bends and then lies flat again. Last. | Yes |

### 2. Grazes

`GRAZES` in `src/models/models.test.ts` lets eight models pass paper through paper deeper than a few layers
(0.005). Each one taken off is a small, tested win; the test fails once a model no longer needs its entry, so the
list can't go stale.

| Model | Depth | Where |
|---|---|---|
| Rainbow chain | 0.034 | Joining the ends: rigid links set on a ring dip into each other where they cross. |
| Swan | 0.013 | Pulling up the neck. With rigid paper its body is a closed tube (milestone 13); likely a dead end without bending. |
| Frog | 0.013 | Lifting the front legs, against the other front quarter. |
| Lily | 0.009 | Its squash-and-petal folds, joined up all the way. |
| Whale | 0.009 | Opening the fins out in 3D. |
| Shallow masu lid | 0.0085 | Raising the walls: riding layers sit a little off the faces they ride on. |
| Dolphin | 0.0075 | Opening the fins out in 3D. |
| King bee | 0.0065 | Bending up the ailerons between the slits. |

### 3. Studio (`docs/studio-plan.md`)

| Row | Work | Size |
|---|---|---|
| 5 | Swivel and open sink as named folds | Medium |
| 6 | Bend with crease goals, solved in a worker, baked on save | Large; after the fan and boat have proved guides |
| 7 | Bend with point goals (3D handles) | Large, and only if 6 shows the need |
| 8 | Submissions with ownership and licence | Large; needs decisions first |

### 4. Smaller

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
| Bending, rows 1 and 3 (boat) | Parked 8 November: its recipe and the opening lab on `dev`, findings in `docs/bending-plan.md` (step 7). Stays Coming soon. |
| Bending, row 2 (fan) | Done 7 November: in the gallery. |
| Bending, row 4 (balloon) | Started 8 November: the cube's shape and guides in `scripts/balloon-cube-lab.ts`; the path doesn't solve smoothly yet. |
| Improving the solver (bending plan, "Improving the solver") | Rows 1 and 2 done 8 November: bent models' files written compactly (a third to a fifth of the size), and `npm run bend-report`. Row 3 tried and dropped: the paper isn't falling behind; each stage ends stretched and the lengths set at its end ignore the guides. Row 6 done 8 November for guided bends: each stage brought to the least of one energy; tuned, the fan and the cup (now in ten stages) are better than with the passes, and were made again with it. The balloon's ends still lock (they'd have to crumple). Row 9's fixed folds done: a bend can name lines on the table to fold along, and the mesh is cut along them. |
