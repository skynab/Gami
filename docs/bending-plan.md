# Plan: paper that bends

Gami's paper is rigid: every face is a flat polygon that keeps its shape, and paper only changes direction at
creases. That covers every gallery model so far. Three don't fit, because real paper bends to make them:

- **The fan** (`wip/fan`). Spread out, each pleat is nearly closed at the pinched end and open at the far end. A
  crease has one angle along its whole length, so flat panels can't do that; real paper twists the panels.
- **The boat** (`wip/boat`). Pulling the small diamond's points apart opens the paper into a hull. The halves are
  hinged to the layers behind along their outer edges, a closed loop, and no flat or rigid 3D state was found.
- **The iris** (`wip/iris`). The third flap's swivel needs paper to give where the next flap is already narrowed
  (see `docs/origami-me-plan.md`). Unlike the other two, the paper has to lie flat again afterwards.

This plan adds bending as an **opt-in for the few steps that need it**. Every other step, model and tool keeps
working exactly as it does now, and existing `.fold` files don't change.

## The idea: bent paper is many small rigid triangles

A bent step's result is still an ordinary frame: flat polygon faces that keep their shape. The difference is that
the paper that bends is cut into a fine mesh of small triangles, with a very slight fold between neighbours. A
curve is a row of tiny creases, as a curl already is (`shape`'s `segments`), but in any direction and with the
angles worked out rather than given.

That keeps the rest of Gami as it is:

- **The format.** A bent frame is FOLD faces and vertices like any other. Only the mesh edges need marking as
  soft (`gami:soft`, below), so they're drawn without crease lines.
- **The checks.** Each triangle still keeps its shape, so "no face stretches" still holds (to the solver's
  tolerance), and `crossings` still measures paper passing through paper.
- **The viewer and cards.** They draw faces; a bent region is just more of them.
- **Animation.** Rigid faces moving between frames close together barely separate, so a bent step plays through
  baked in-between frames (`via`, which steps can already carry).

## What a bend step says

A new operation, `bend`, recorded like every other (`gami:op`), so a file folds again from it:

```ts
{
  op: 'bend';
  /** The paper allowed to bend (by face, as other operations pick faces). Everything else stays rigid. */
  flex: Faces;
  /** What stays put. */
  anchor: { paper: Vec2 };
  /** Where to take things: points of the sheet to positions in 3D, and creases to angles. */
  goals: ({ point: At; to: Vec3 } | { crease: LineSpec; degrees: number })[];
  /** How finely to mesh the bending paper, as the longest triangle edge on the sheet. */
  mesh?: number;
}
```

A recipe writes it as `r.bend(step, { flex, anchor, goals })`. For the fan, the goals put each pleat's far corner on
a half circle round the pinched end. For the boat, they pull the diamond's two top points apart.

The step names the paper that may bend, so bending stays where it's asked for. Faces outside `flex` move as rigid
pieces: meshed coarsely (just enough to join the mesh), with stiff folds between their own triangles.

## The solver

Worked out once when the step is made (`npm run models`, or replaying a file), never in the viewer.

**Method: position-based dynamics (XPBD).** Simple, stable, and fast enough on the CPU for a few thousand
triangles. Each iteration nudges vertices to satisfy constraints in turn:

| Constraint | What it keeps | Stiffness |
|---|---|---|
| Edge length, on every triangle edge | The paper from stretching | Very stiff (near exact) |
| Fold angle, on real creases with a goal | The crease at its goal angle | Stiff |
| Fold angle, on existing creases without one | The crease where it was | Soft (creases give) |
| Bending, on soft mesh edges | The paper flat unless pushed | Softer still (paper bends) |
| Separation, between layers | Paper from passing through paper (at least a layer's gap) | Hard |
| Anchor and point goals | What stays put, and where things go | Hard / stiff |

**Running it.** The goals ramp from where the paper is to where they say, in a fixed number of stages. Each stage
iterates a fixed number of times, and its result is kept as one of the step's in-between frames, so the step
animates along the way the paper actually went.

**Determinism.** Fixed stages, iterations and constraint order, and no randomness, so the same step gives the same
paper every time on the same JavaScript engine. Replays in other browsers may differ in the last digits; the
viewer always uses the baked frames, so only the Studio's replay could notice (see open questions).

**Collisions.** Stacked layers (the fan is sixteen deep) start a layer's gap apart and must stay apart. A spatial
hash finds vertex–triangle pairs nearby. This is the riskiest part (see risks).

**Finishing.** A last pass corrects edge lengths so every triangle keeps its shape closely enough for the
checker; the tolerance for bent steps is set from what the solver reaches.

## Format

- `gami:op` gains `bend` (above), checked by `parseOp` like the rest.
- Frames gain `gami:soft`: the edges between triangles of bending paper, as pairs of vertex indices. Drawing
  skips their lines and shades across them smoothly; the fold engine and checks treat them as ordinary edges.
- In-between frames go in `gami:via`, as now.

**Size.** A meshed step and its in-between frames are much bigger than a flat one. Budget: a bent model's file
stays under 1 MB (the largest model now, the frog, is 288 KB). Levers: coarser mesh where the paper barely
bends, fewer in-between frames (the viewer interpolates between them), and only the bending region meshed.

## What changes elsewhere

- **Animation** (`animate.ts`): a bent step plays through its in-between frames (`transitionVia`, already there).
  The step into a bend must match its faces to the mesh: `faces_parent` points each triangle at the face it came
  from.
- **Viewer** (`FoldedPaper.tsx`): no crease lines on soft edges, smooth normals across them. Performance with a few
  thousand faces needs checking on a phone.
- **Checks** (`validate.ts`, `collisions.ts`): bent steps use the solver's tolerance for "keeps its shape"; their
  crossings are measured at the in-between frames. A new check reports the largest strain in a bent step.
- **Later steps.** A bend is meant to be a last step (the fan, the boat). Folding flat after one isn't supported
  at first; the fold engine refuses a frame with soft edges, with a clear message.
- **Studio.** No bend tool at first; bent steps replay and can be removed, as other steps without a tool once
  could.

## Order of work

1. **Solver spike** (`src/fold/bend/`, nothing else touched). XPBD on a hand-built mesh: a strip bent into an arc
   by moving its ends, and a square twisted by its corners. Tests: edge lengths within tolerance, no layer passes
   through another, the same result every run. Done when both shapes look right and the tests pass.

   **Done** (`src/fold/bend/`). What it found:
   - **Stiffness.** Edges exact (compliance 0), bending soft (1e-2), 12 stages of 120 iterations. On their own,
     the stages leave long strips a little stretched (each pass carries a correction only a few edges along), so
     a last pass on the edges alone runs until every edge is within 0.01% (or 20 × the iterations). The arch, a
     1 × 0.2 strip of 160 triangles brought in to 0.64 of its length, ends within 0.2% strain; the quarter twist
     within 1%. Over-relaxing the edges was tried and made it worse.
   - **Collisions.** A sheet pushed hard onto another holds a gap at every stage only with all three of: each
     point–triangle pair keeps the side it was **first** seen on (taking it afresh lets a point that got pushed
     through stay through); pairs are looked for again every 10 iterations, during the last pass too; and the
     search reaches a few gaps **beyond** each triangle's edges, as points slide onto triangles between searches.
     Separation runs last in each iteration. The search is still brute force; deep stacks will need the hash.
   - **Speed.** The tests' meshes (up to ~200 triangles) solve in well under a second each.
   - **Not yet tried:** deep stacks (the fan's sixteen layers), and creases with goals on a real crease pattern.
2. **Mesh and frames.** Triangulate the `flex` faces of a frame (and the rest coarsely), run the solver from the
   frame's 3D positions (`facePositions`, with layer gaps), write the result back as a frame with `gami:soft`
   and `faces_parent`. Done when a flat sheet bent by two handles round-trips through a `.fold` file.

   **Done** (`bend/frame.ts`: `meshFrame`, `bendFrame`). What it found:
   - **Meshing.** Each face is cut into triangles on the sheet, its outline taking every frame vertex along its
     edges so neighbours match point for point, then split across longest edges (Rivara) until none is longer
     than the mesh size (3 × that outside `flex`). Faces are joined where they share an edge that isn't cut.
     Stacked faces meet a hair apart along creases; their shared points meet halfway.
   - **Stiffness by edge.** Inside a bending face, soft (`gami:soft`); inside a rigid one, exact; between faces,
     a crease that gives a little (compliance 1e-3, held at the angle it starts at).
   - **Stretch.** Nudging one edge at a time left a sheet 12% stretched at each stage's end and 0.25% at the end,
     worse on finer meshes. So each stage ends by setting every edge's length at once (a few damped Newton steps
     solved by conjugate gradients, Goldenthal et al. 2007), holding pinned and goal points. A flat mesh has more
     edges than in-plane freedoms, so the solve is singular unless damped. With goals solved last in each
     iteration, the taco (a 1 × 1 sheet curled about a diagonal, 512 triangles) reaches its corners within 1e-3
     at 0.02% strain, in about 2 s, most of it the brute-force collision search.
   - **Anchors and goals** are by point on the sheet: the anchor holds the triangle there (its whole face, if
     rigid); a goal must be at a corner of a face.
2. **Mesh and frames.** Triangulate the `flex` faces of a frame (and the rest coarsely), run the solver from the
   frame's 3D positions (`facePositions`, with layer gaps), write the result back as a frame with `gami:soft`
   and `faces_parent`. Done when a flat sheet bent by two handles round-trips through a `.fold` file.
3. **The operation.** `bend` in `ops.ts` (types, `parseOp`, replay), `Recipe.bend`, in-between frames. Done when a
   test model with a bend step replays from its file to the same frames.
4. **Drawing and animation.** Soft edges in the viewer and cards; bent steps play through their in-between frames.
   Done when the test model plays smoothly in the viewer with no visible mesh lines.
5. **Checks.** Strain check, tolerances, crossings at in-between frames. Done when the test model passes `problems`
   and its crossings stay within a layer.
6. **The fan.** Its last step, the spread, as a bend. Done when it's in the gallery, the file is under budget, and
   the full test suite is no slower than a few seconds more.
7. **The boat.** Pulling the diamond's points apart, as a bend from the small diamond. Done as for the fan.
8. **The iris, later.** It needs paper that bends and then lies flat again (a "relax to flat" mode, or using the
   solver to find the crease pattern real paper takes). Revisit once 1–7 are done.

## Risks

- **Collisions in deep stacks.** Sixteen layers a hair apart, moving a lot: the solver may tangle or jitter. Mitigate
  with small stages, more iterations near contact, and separation constraints solved last in each iteration.
- **Speed.** Thousands of triangles times stages times iterations, in Node at build time, and again in the test
  suite (which animates every model). Mitigate with the coarsest mesh that looks right, and caching the solved
  frames (they're in the file).
- **File size.** See the budget above.
- **Looking right.** A solver finds *a* shape, not necessarily the one real paper takes. Mitigate by choosing goals
  close to the real shape and checking against origami.me's photos.

## Open questions

- **Replay in other browsers.** Should a bend step's replay in the Studio re-solve (and possibly differ slightly), or
  keep the baked frames and only re-solve when an earlier step changes?
- **Mesh pattern.** A regular grid of right triangles is simplest; aligned to the paper's creases it meshes cleanly.
  Is that enough, or does the fan's twist need a finer mesh near the pinched end?
- **A bend tool in the Studio.** Worth it only if creators ask for curved finishes.
