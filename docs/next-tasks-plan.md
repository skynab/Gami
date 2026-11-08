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
| CI's first run (`Tests`, 7 November, on `dev` at `933b887`) | **Failed in the end-to-end job.** The type check and unit tests passed. See "Waiting" below. The e2e job's report was never uploaded, as Playwright wasn't writing one; on CI it now writes an HTML report, with a trace of each test that fails once and is run again, which the workflow uploads as `playwright-report`. |
| Finished sessions' worktrees | Done: "Lesson: common origami folds", "Lesson: origami bases" and "Standardise fold vocabulary and unfold logic" are archived and their worktrees removed. Their work is all in `dev` (the third's commit, `5dbf414`, landed in another form: `CREASE_KINDS`, `FOLD_KINDS`, `lastFold`). |
| Old branches, and the `fold-grazes` worktree | **Not done.** Auto mode stopped the deletions as irreversible. The commands are under "Branches to delete by hand". |
| Release `dev` to `main` | See Progress at the end. |

## Waiting

Things that can't be settled from the code alone.

- **Why the e2e job fails on CI.** Its log is only open to the repository's admins. Tried: the e2e tests pass
  here with `CI=1`, and again with Chromium drawing WebGL in software (SwiftShader), as a runner does; no import
  or `public/` path differs from its file in case, which Linux would care about and Windows doesn't. Next: read
  the failing run's log
  ([run 42422151666](https://github.com/skynab/Gami/actions/runs/42422151666)), or the `playwright-report`
  artifact the next failing run uploads. Likely suspects, given everything passes locally: a test running past
  Playwright's 30 s on a two-core runner drawing WebGL in software (the finished-model pictures), or fonts.
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
solver to find it from a few goals. The other `wip/*` branches are 100 to 210 commits behind `dev`; the boat's and
the fan's recipes are on `dev` now, not yet in the gallery's list.

| # | Work | Needs bending? |
|---|---|---|
| 1 | **Boat, as far as the small diamond.** On `dev`. The squashes now pass paper through paper by 0.007 and 0.025 (they were 14 cm and 1.7 cm). The second can't fold in step: kept joined, its creases follow another way of folding (bending plan, step 7). Next: live with 0.025 on `GRAZES`, or find what keeps its creases on this way of folding. | No |
| 2 | **Fan.** On `dev`, redesigned to fold as origami.me does, so it can open at all; the spread is guided as a book's pages fanned round a half circle and holds its shape within 0.8%. Played, slivers in the mesh stretch 13% (5% allowed). Next: a grid mesh pattern for long thin faces (bending plan, step 6), then the cup, balloon and 3D tulip checked again. | Yes |
| 3 | **Boat's opening.** Pulling the diamond's points apart, with guides as for the cup. | Yes |
| 4 | **Balloon blown up**, and the 3D tulip with it: the blown-up shape built face by face first. | Yes |
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
| Bending, rows 1 and 2 | Started 7 November: the boat's and fan's recipes on `dev`, findings in `docs/bending-plan.md` (steps 6 and 7). Neither is in the gallery yet. |
