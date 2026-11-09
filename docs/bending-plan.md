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
  /**
   * Lines the paper will fold along, as segments on the table (paper lying flat only): every face they cross, in
   * every layer, is cut along them before meshing, so the mesh has edges there (November 2026).
   */
  lines?: [Vec2, Vec2][];
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
- In-between frames go in `gami:via`, as now. A bend's are written compactly (November 2026): they share the
  step's triangles, points on the sheet and seams, so each is just how far its points move from the frame before,
  in whole steps of 1e-5 (`gami:moves`); bent paper's points are kept to 1e-5, a seventieth of the gap between
  layers, not 1e-9. The bend's guides' paths go the same way, losslessly, as recipes round them to millionths
  (`gami:path`). Files written before still read.

**Size.** A meshed step and its in-between frames are much bigger than a flat one. Budget: a bent model's file
stays under 1 MB. Written compactly, the bent models went from 715–975 KB to 170–250 KB (the fan 250 KB, the cup
249, the balloon 200, the 3D tulip 173): before, the repeated triangles and points on the sheet were over half of
each, and the fan's guides a third of it. Other levers, if needed: coarser mesh where the paper barely bends, fewer
in-between frames (the viewer interpolates between them), and only the bending region meshed.

**Looking at a bend.** `npm run bend-report -- <model id, or a .fold file> [step]` (`src/fold/bend/report.ts`)
says what each bent step does, and where on the sheet: its stretch in its frames and as it plays, the most any
triangle turns from one frame to the next (paper snapping through turns a long way at once), how far the paper
is behind its guides stage by stage, how deep paper goes through paper, and its share of the file. The labs in
`scripts/` print it too.

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
3. **The operation.** `bend` in `ops.ts` (types, `parseOp`, replay), `Recipe.bend`, in-between frames. Done when a
   test model with a bend step replays from its file to the same frames.

   **Done.** `{ op: 'bend', flex, anchor: { paper }, goals, mesh? }`, goals being `{ point: { paper }, to }` or
   `{ crease: [from, to], degrees }` (valley positive). It's a pose step ("Bend it" in the Studio); `Recipe.bend`
   makes it through `applyOp`, so the model and its file agree exactly, and it replays from the file to the same
   frames. A mesh finer than 0.02 is refused (too slow to solve). Any step after a bend but drawing is refused, by
   replay and by recipes. What it found:
   - **Creases turning flaps.** A crease goal turned a bending flap only halfway: one constraint at a time, the turn
     crosses the flap a few triangles per pass (600 iterations reached 77°, 2000 reached 87°). Solving every
     constraint at once instead (damped Gauss–Newton by conjugate gradients) can't find buckling from flat paper,
     as lifting doesn't change lengths to first order: the arch flattened and stretched. What works is both:
     one at a time, with everything solved together every 20 iterations. That step needed its moves capped (a
     quarter of the shortest edge) or it blew up, a Jacobi preconditioner (fold angles' gradients are hundreds of
     times edges'), and less damping than setting lengths alone (1e-5 against 1e-4) so stretching costs far more
     than bending. The crease now reaches 90° exactly, the flap staying flat.
   - **In-between frames.** Setting lengths at a stage's end while holding the goals' points left early frames up
     to 17% stretched (flat paper can't lift to meet them). Letting those points give at every stage but the last
     keeps every frame within 1%, most within 0.1%; the test holds them to 2%.
   - The arch's end now lands within 5 mm of its goal on a 1-long strip (was 2), as the last pass on lengths lets
     it give a little; holding it there instead leaves the strip stretched 6%.
4. **Drawing and animation.** Soft edges in the viewer and cards; bent steps play through their in-between frames.
   Done when the test model plays smoothly in the viewer with no visible mesh lines.

   **Done** (`animate.ts`: `blended`; `FoldedPaper.tsx`; `thumbnail.ts`; `guides.ts`). What it found:
   - **Playing between frames.** The usual way, each triangle's own screw motion, tore the mesh apart mid-stretch
     (corners up to 3 mm apart on a 1-long sheet) and took over a second to work out, as every triangle became a
     part of its own and was tried for passing through paper. A step into a frame with soft edges instead moves
     each triangle by its own screw motion and puts every corner where the triangles sharing it place it on
     average, so the mesh stays joined; it takes milliseconds. Moving corners in straight lines shrank triangles
     that turn a lot (10%); turning each about its middle, 5.6%; screws, 3.8%, all of it one small triangle by the
     pulled corner that turns 53° in the last stretch, where the solver lets the goals' points give. The test
     holds it to 5%; checking strain (step 5) will say whether the last stage needs more frames.
   - **Seams, not creases.** Rigid faces are meshed too, so their seams showed as lines. `gami:soft` now marks
     every edge between triangles cut from one face, rigid or bending; rigid ones are still held exactly.
   - **Drawing.** Soft edges get no line, no rounded join between layers, and normals averaged round each vertex
     across them, so bent paper shades smoothly. Cards seen at a slant outline bent triangles in their own colour
     to close the hairline seams, and line only their other edges.
   - **Guides.** A bend has no single crease or part moving as one: the step's guide is one arrow along the
     path of the corner that goes furthest, through where it is halfway. The viewer passes guides the step's
     in-between frames, as a bent frame's faces point back at the last of them, not the step before.
5. **Checks.** Strain check, tolerances, crossings at in-between frames. Done when the test model passes `problems`
   and its crossings stay within a layer.

   **Done** (`validate.ts`: `bendStrain`; `solver.ts`: `floor`, `settle`). What it found:
   - **Tolerances.** A bend step's frames (its in-between ones too) may stretch by 1% (`BENT_STRAIN`), and the paper
     between them, as it plays, by 5% (`BENT_PLAY_STRAIN`). `problems` reports the worst once per step, not each
     triangle, and holds bent paper to the table like any other.
   - **Crossings.** A bend's triangles share one motion, so `crossings` took them as moving together and never
     compared them. Bending paper now never counts as moving together; triangles joined at a corner are still
     left alone. A test lays the bent half through the other to check it's found.
   - **The table.** The solver let paper sink up to 7 mm below the table in its early stages. It now takes a
     `floor` (the table, for `bendFrame`) that points are put back onto wherever layers are kept apart.
   - **Stacked paper.** A second test model lifts the top layer of a sheet folded in half by its corner. It
     stretched 9% mid-way and passed 2.7 mm (four layers) into the layer below: setting every edge's length at
     once at a stage's end moves paper into other paper and under the table, and pushing it back out stretches it
     again. Without layers or the table it stayed within 0.7%. Each stage but the last now ends by settling the
     edges one at a time with layers kept apart and the table under them (`settle`, as the last pass already did),
     the goals' points held: 0.8% at worst, no crossings, and a step that plays smoothly to its last frame (letting
     the goals give there left one triangle swinging 5.7% in the last stretch). It costs about a third more time;
     that test model, 238 triangles, takes about 3 s.
6. **The fan.** Its last step, the spread, as a bend. Done when it's in the gallery, the file is under budget, and
   the full test suite is no slower than a few seconds more.

   **Started; not reachable yet.** What the first try found (on `wip/fan`):
   - **The shape.** Folded in half, the stack is 34 layers: each strip's two halves are far apart in it (the
     first pleat's are the bottom and top layers), joined only along the half fold. Spread, the bottom half of the
     stack fans to one side and the top half to the other, each a quarter circle; a strip's halves stay closed at
     the middle, where the flap locks them, and open to nearly flat at the outer edges. A quarter circle of radius
     0.5 gives each strip a chord of 0.052 at its far end, against its width of 0.0875, so the far ends zigzag
     by 0.07; nearer the pinch the pleats close up, which twists every strip.
   - **The flap.** The recipe's flap wraps the stack's side along its whole length, so the half of the stack
     fanning towards it would pass through it. origami.me folds the flap's corners in first so it holds near the
     pinch; the recipe's corner folds may need to take more of it.
   - **The solver.** Goals on each crease's far end (both halves), the flap held: at mesh 0.1 (1660 triangles, 859
     points) it took 64 s and ended 100% stretched with paper deep through paper. Straight from 34 layers a
     hair apart to the spread, it doesn't find the shape. Points near other paper are now found through a grid
     (the same pairs, in the same order, as looking at every point), which deep stacks needed anyway.
   - **Next.** Rather than solving from the flat stack, build the spread shape directly (each half strip a ruled
     surface from the pinch to its place on the arc) and let the solver only settle it and the frames on the
     way; and see where the time goes at this size.

   **Second try: done** (November 2026, `src/models/recipes/fan.ts`).
   - **The recipe couldn't open.** It turned the paper back over before pleating, so the strip next to the flap
     was at the bottom of the stack and, folded in half, outermost. The flap's corners fold through both its
     layers, which locks them together, and so locks that strip's two halves, the outside of the whole stack:
     shut, bent or not. origami.me collapses the pleats from the back (its step 6 doesn't turn back over), so
     that strip ends on top, then in the middle once folded in half, and the flap locks the fan's middle, where
     its photos show a closed rib. The recipe now does the same: pleated from the back, the second strip from
     the left staying put and the rest going under it.
   - **The flap stays out.** origami.me's step 10 closes the flap "towards the center of the fan". Its two
     layers hang from the two middle layers, so folded over either face it would wrap one half of the stack and
     hold it shut; tucked in between them (an inside reverse fold along its crease) the collapse reshuffled the
     whole stack. With its corners folded it already holds the middle together, so it stays out, as a tab.
   - **The shape** (`spread` in the recipe). The fan opens like a book whose spine is the fold at its bottom: the
     bottom half of the stack fans up from the table on one side, the top half swings over onto the other, the
     two middle layers and the flap stand upright between them, and each half strip is a page a share of a
     quarter turn round. Between its creases a page is a ruled surface: at the spine the creases are a strip's
     width apart across it, as they lie folded; further out they fan apart round the arc and draw in across it
     to keep the page as wide. Every guided frame keeps the paper within 0.8%, paper passes through paper by
     at most half a centimetre, and the solved paper stays within 1.5 mm of its guides (0.01 at worst).
   - **Slivers.** Played, the step stretched 13% (16 stages), 6.5% (32) or 8.5% (48); 5% is allowed. At each
     stage it was under 0.8%: in between, each triangle takes its own screw from one frame to the next and shared
     corners are averaged, and the worst were slivers along the pages' edges, 10° at their narrow corner, whose
     normals swung by 45° from one stage to the next while their corners moved half a millimetre. Splitting the
     longest edge never splits a face's 10° corner (the diagonal of a strip 0.0875 by 0.5): it's passed down. More
     stages didn't help either: the last stage's extra polishing jumps, and over 20 stages the file is past 1 MB.
   - **Thin faces cut in rows** (`meshFrame`). A face narrower than a triangle's edge (twice its area over its
     perimeter) has its outline cut evenly instead, as do the stretches its neighbours share with it, so outlines
     still match; ear-clipped, it's a row of triangles across it, 35° at the narrowest. The wider faces beside
     them, with many points along that edge, have their diagonals swapped until no triangle is needlessly thin
     (the Delaunay rule). Other faces mesh as before. Tried and dropped: cutting every outline evenly (the cup's
     big faces filled with slivers where midpoints of different edges landed together), and points on a lattice
     inside every face, swapped to Delaunay (no slivers anywhere, but no edges along a square's diagonals, which
     the old mesh has, so a sheet curled about its diagonal couldn't reach its goals within the tests' 0.1%).
     The cup meshes exactly as before; the 3D tulip has no slivers now and plays within 0.9% (3% before); the
     balloon passes paper through paper less (0.0054 from 0.0061), its file 998 KB, just inside the budget.
   - **The creasing.** origami.me creases every strip; done as creases inside one step (fold and unfold at once,
     as the recipe had them) nothing moves, so there's nothing to show. The recipe creases in half, then both
     edges to the middle, to those creases, and to the nearest ones, each pair folding together and opening
     again; the pleating makes the rest. The last pair is the flap's hinge, which a collapse can't add as a
     crease left open.
   - **In the gallery** (7 November 2026): 14 steps, 498 triangles, 16 stages, solved in 5 s; every frame within
     0.8%, 1.5% as it plays, paper through paper by at most 0.0025, the file 732 KB.
7. **The boat.** Pulling the diamond's points apart, as a bend from the small diamond. Done as for the fan.

   **Parked (8 November 2026); not reachable yet.** What the first try found (on `wip/boat`):
   - **The branch.** Its recipe and collapse change still apply to `dev`, and the boat folds to the small diamond
     (28 faces, 13 layers) with no `problems`. But its two diamond squashes pass paper through paper: the first
     by 14 cm, the second by 1.7 cm. They need the staged and hinged playing other squashes have before the boat
     can go in the gallery, whatever happens to its last step.
   - **Which points.** One corner of the small diamond holds the sheet's centre (the sail's tip) and the four hat
     corners (±0.5, ±0.5), the bow and stern. origami.me opens the bottom and pulls the ends out; the bend pulled
     the (−0.5, ·) corners one way and the (0.5, ·) the other, along the diamond, with the sail held.
   - **The solver.** At mesh 0.08 (1400 triangles), 37 s to solve. The in-between frames stay within about 2%, but
     the last, where the goals are held, stretches 11%, and paper goes up to 1.9 cm through paper on the way.
     Pulling the ends 0.2 or 0.4 apart did no better, and pulling across the diamond was worse (22%).
   - **Next.** As for the fan: the solver doesn't find a shape this far from a flat stack. Both need the shape
     built first (here, the hull's sides and the sail as rigid panels opened about the diamond's creases), with
     the solver settling it and the frames on the way.
   **Why the solver got lost** (October 2026, after the fan's and boat's first tries). A benchmark with a known
   answer settled it: a strip pleated into a stack, opened into a zigzag. No bending is needed, so any stretch or
   crossing is the solver's.
   - **Goals on points drag paper through paper.** Opened by goals on the panels' corners, four panels stretched
     25% and passed 2.4 cm through each other, with or without contacts. Each goal's point moves in a straight
     line, stage by stage, but a pleat opening carries its far crease up and over the panels before it: the
     straight line goes through them. The fan's and boat's goals did the same.
   - **Goals on creases don't.** Opened by crease goals instead (each crease turning a little more each stage),
     eight panels open with 0.1% stretch, no crossings, in about 4 s, and nudging the angles changes nothing. A
     test keeps it so. Motions where paper swings round (pleats opening, a hull spreading) are best given as crease
     angles, with goals on points only where the paper goes more or less straight.
   - **Tried and dropped.** Goals that only lead (soft until the last stage) left the paper behind until the last
     stage, which then did everything at once; solving straight to the end that way is chaotic (one part in ten
     million on a goal swung the stretch from 0.4% to 23%). Building the frames on the way by turning each
     triangle about the edge it hangs from (exact on its own) inherits that. Forgetting which side of a triangle a
     point is on once it leaves it (for paper unwrapping round a fold) made things worse; sides stay for good.
   - **Folds round other layers wrap.** The mesh put the points joining two layers halfway between them; where
     layers lie between (every strip of the fan folds at the same edge), those points all met inside the stack
     and the triangles to them cut through it, so the fan with no goals at all ended 41% stretched. They now go
     out past the fold, square to it, by half the layers it goes round, so folds round folds nest. Two layers
     next to each other have nothing between them and are left as they were.
   - **Crease goals on fine meshes.** A crease turning a flap got only part of the way once the mesh was fine: half
     a right angle on a strip meshed at a twentieth of its length, a third at a fortieth. Solving everything
     together moved no point further than a quarter of the shortest edge at a time, so the flap's far edge, with a
     long way to go in small triangles, couldn't keep up. It may now move 1.5% of the paper's size if that's more:
     the flap turns all the way at any mesh, and the finest got quicker (12 s, from 22). 3% did too, but left the
     taco less exact.
   - **Angles along a crease.** Tried: a crease goal with an angle at each end (a fan's pleat, closed at its pinch,
     open at its far end). It works as code, but paper can only change its angle along a straight crease by
     curving beside it, so the crease curves: a strip two triangles wide can't, and settled on about the average
     angle. Set aside until a fan's pleats are meshed finely enough to curve (a few thousand triangles in its 34
     layers, minutes to solve), which is the fan's real cost.
   - **Paper that starts a little off its shape** (October 2026, working on the boat). With no goals at all, the
     boat's 13-layer diamond ended 9% stretched, and a sheet folded twice 2% on the way. Three causes, all fixed:
     edge lengths were taken from where the mesh starts (folds pushed out round the layers inside them) rather
     than from the sheet, so the distortion stayed for good; points the anchor holds were pushed out too, so the
     paper beside them couldn't take its shape back; and layers were kept a full gap apart even where the mesh
     starts them closer (by a fold, which a coarse mesh can't round off), so keeping them apart and keeping edge
     lengths fought without end. Now lengths come from the sheet, held points sit on their face, each pair of
     paper near each other is kept no further apart than it was first seen (down to a quarter of a gap), and the
     paper settles into shape before anything moves. The boat with no goals stays within 0.03%, and its frames
     cross by at most 1.2 mm, where folds start a hair inside one another.
   - **Speed.** Keeping layers apart was most of the time: every pair near each other, every iteration. Each now
     checks how far apart they are first, in plain numbers, and the search looks only at points in each
     triangle's box, without sorting: the twice-folded sheet went from 19 s to 8 s, and the bending tests from 25 s
     to 10 s, though settling each stage now takes up to 800 passes rather than 400.
   - **The boat's shape** (from origami.me's photos of the last step and the finished boat). The bow and stern
     are the small diamond's side corners, (∓0.25, ±0.25) on the sheet, not the flaps at its top; the sail is its
     top, with the sheet's middle at its tip; the striped brims end up inside the hull. The side corners are
     already as far apart as the paper lets them be (0.5, along the sheet's diagonals), so pulling the ends out
     keeps them taut while the bottom opens. The diamond's faces are triangles cut along its slit (top corner to
     bottom), each pair folded together along a line from a side corner to the bottom one (where the bottom point
     was folded up), and front and back join along its top edges, which meet at the sail. So the hull opens like
     a hat unsquashed, its edge dipping to the sail in the middle, as the photo shows.
   - **Tried.** Turning the front wall's bottom corner up about the bow–stern line, with goals that turn a point
     about a line (on `wip/boat`, as a patch): one way round passes through the paper at once, the other jams at
     about 35°, as nothing in the paper folds along that line.
   - **Third try** (after the solver's fixes for deep stacks). The photos show the boat's walls teal, the paper's
     colour hidden inside the small diamond, so the walls come from inner layers: the last step turns the diamond
     partly inside out. The hat's corners, together at the diamond's top, are likeliest the bow and stern: each
     brim's fold runs straight between two of them, 1.0 long, and would be the gunwale, the striped brim lining the
     hull. Pulled that far apart (0.96 and 0.8), the paper crumples: 4–5% stretched, up to 3.5 cm through itself.
     Step 13's squash, played backwards part way, isn't boat-shaped either (it's staged, a flap lifted then moved).
   - **Next.** Work out where each of the diamond's 28 faces goes in the finished boat (a paper model would settle
     it), then give the opening as those faces' crease angles.
   - **On `dev`** (November 2026: `src/models/recipes/boat.ts`, not yet in the gallery's list, and the collapse
     change, which only acts where a stacking would otherwise fail). With what's come since (paper joined up
     sooner, creases round a point folded in step), the squashes into the diamonds pass paper through paper by
     0.007 and 0.025, not 14 cm and 1.7 cm. The first folds hinged, in step, and grazes only as the strip's ends
     meet, one tucked under the other. The second can't fold in step: kept joined, its creases follow another
     way of folding the paper (some stay put, some turn the wrong way) and jump at the end, and nearly halfway
     it parts by just over the 0.003 allowed. Changing which paper stays put makes no difference (0.029 to
     0.033 whichever face). It would go on `GRAZES` at about 0.025 if the boat went in as it is.
   - **The finished boat, from origami.me's diagrams** (November 2026). Its last diagram is the boat side on: a
     trapezoid hull, the gunwale long and straight from bow point to stern point, the keel half as long, two
     grey creases from the keel's ends up to the gunwale's middle, and a small sail just showing above it there.
     On the sheet that reads as: the gunwales are the brim folds (v = ±0.5, each 1.0 long, the striped brims
     lining the inside); the bow and stern are the hat's corners, (∓0.5, ±0.5); the keel runs between the small
     diamond's side corners (±0.25, v), 0.5 long, the two walls meeting along it; each wall is the trapezoid of
     its quarter between gunwale and keel (0.25 high), the grey creases its edges from the keel's ends to the
     gunwale's middle (0, ±0.5); and the rest of that quarter, past the keel, folds up inside along a new crease
     (v = ±0.25, across two faces) into half the sail, its tip the sheet's middle, 0.25 above the keel, so just
     above gunwales whose walls lean out. The quarters at bow and stern join the walls along the stem.
   - **Why it needs designing, not finding.** At each end of the keel two straight creases cross square (the
     diamond's diagonal and the line from the gunwale's middle to the raw edge's), and such a vertex can't fold
     in 3D, only flat; the bow quarter can't lie flat in the middle either (its corner would land under the
     keel or on the sail's tip). So the paper bends round the keel's ends and the stem, and a guided opening
     needs a shape that keeps the paper's lengths there, worked out as the cup's was, or measured off a paper
     boat face by face.
   - **The shape, nearly rigid.** Each wall is three triangles hinged at the grey creases: the middle one on the
     keel, (±0.25, v) to the gunwale's middle, and one at each end, (∓0.5, v) to (0, v) to the keel's end. Tilt
     the middles out by φ and each end triangle turns about its grey crease until its corner reaches the middle
     plane: at φ = 30° the bow tip is 0.481 along and 0.267 up, both walls' corners meeting there, every length
     kept, the gunwale two straight halves bowed out 0.125 at the middle, which sags to 0.217. The sail halves
     stand on the keel, their tip 0.25 up, just above. The two diamond corners at each end hold one hat corner
     from each wall (the diamond turned about the keel puts each wall's bow at a different end), so the left
     and right quarters each run the boat's length: folded in half along the keel line they stand in the middle
     plane, back to back with the sail halves, their raw edges along the top from tip to tip, 4% longer than
     the 0.962 between the tips, which a little bending takes.
   - **The motion turns it inside out.** In the flat small diamond both walls' middles lie on the keel's one side
     (layers 5 and 11, one on the other) and both sail halves on its other side, each wall bent to its sail
     half across the keel. Stood up, the sail halves meet in the middle and the walls must be either side of
     them: the upper wall folds up onto its sail, the keel closing as usual, but the lower one has to swing
     round under the keel and up the far side, its fold at the keel opening right out and closing the other
     way. On the way it passes the layers under it (the other wall's bow triangle, the quarters, the brims), so
     a guided path needs staging (the sail halves up first, the swing after) and the paper lifted off the
     table (`free`).
   - **Tried: the staged swing** (November 2026, `scripts/boat-opening-lab.ts`, run by `boat-opening-run.ts`).
     Every face's path is a chain of hinged turns: sail halves and the quarters' inner halves up about the keel,
     the upper (starboard) wall up onto its sail, the lower (port) wall round under the keel carrying the
     quarters' outer halves folded inside it, the end triangles turned in about their grey creases until their
     corners reach the middle plane (found by search), the brims folded down inside, and the brims' smaller
     pieces turned on their hinges to where their mirror across the gunwale lands. The end shape holds
     together: every point shared by two faces lands in one place to within 0.026 (the four tips, as above).
     Solved (1840 triangles, 12 or 24 stages, 15–32 s), the path tangles: 8–10% stretched, and up to 300
     triangles flipping right over between stages. It starts where the starboard wall's bow triangle has to
     get past the port wall. The small diamond's halves interlock: that triangle, folded under its wall, wraps
     round the port wall's middle, while the port wall's own bow triangle and brim wrap round it from below,
     like two folders each holding a page of the other. That's what holds the diamond together, and a path
     keeping every face rigid can't take them apart; moving the port wall first only moves the clash. Giving
     the brims their own phase, after their wall is up, cut the flipping early on but not the clash.
   - **Parked** (8 November 2026). The boat stays Coming soon, its recipe and the lab on `dev`. What would
     unpark it: a paper boat opened slowly, watching the starboard wall's bow triangle and the port wall's bow
     brim, to see how real paper unlocks them. Perhaps they stay interlocked in the finished boat (one tucked
     round the other at that end), in which case the end shape here is wrong there, not the path.
   - **The small diamond as paper stacks it** (9 November 2026). The interlock above came partly from the recipe.
     Opening the small hat, its "flat" creases along the hat's sides also opened the corner flaps' middle creases
     and the gunwales, which lie along the same lines. No stacking then kept the layers' order, so the collapse
     quietly kept none, and the diamond came out stacked as paper can't be: each wall's bow at a different end, the
     brims lying open. Now only what joins the hat's front to its back opens (the walls' upper halves, round the
     pocket, and the brims' middle creases), and every layer keeps its order. Each half of the sheet now lies on
     its own side of the slit, the two mirror images. From the table up: S upper, S lower, P lower, Q_p lower, Q_s
     lower, Q_s upper, Q_p upper, P upper (P and S the walls, Q the corner flap, upper and lower either side of
     the fold made by folding the bottom points up), with the brims between. P upper on top and S upper
     underneath are the hat's pocket walls, turned out, as a squash turns them. Both walls' bows are at one end,
     so the bow comes from the left half of the sheet and the stern from the right. The squash passes paper
     through paper by 0.032 (0.025 before). `scripts/boat-opening-lab.ts` was written for the old stacking.
   - **What the opening has to do** (worked out by hand at a side corner, the bow's; the stern mirrors it; not
     yet tried). The flat boat's stacking is forced: walls outside, then sails, the flap's halves in the middle
     (S wall, S sail, Q_s upper, its lower half past the keel, Q_p's, Q_p upper, P sail, P wall). At the bow the
     end pieces stack the same way (S's end, Q_s's, Q_p's, P's), each flat with the piece it hangs from.
     - *The flaps bend.* Each corner flap is reverse-folded inside along the keel, which crosses the flap's
       middle crease square. Four creases meeting at right angles fold rigidly only along one line or the other,
       so the flap has to bend at its middle (the diamond's centre) as it goes in: a place for `crumple`.
     - *The halves still hook each other at the corner.* P lower folds round Q_s (where the bottom points were
       folded up), while S lower and Q_s lower fold round P lower and Q_p lower (at the stem). They unhook in
       this order: S's wall swings down under the keel first, taking S lower with it, which opens the stem fold.
       Then P lower and Q_p lower unfold together round that first fold's edge, turning over as a pair (their
       stem fold the other way up afterwards). Then the keel folds: P's wall up, the flaps' lower halves into
       the middle.
     - *The brims' corners* (folded at the hat corners) also wrap the end pieces at the stem, and have to come
       round with them.
   - **Next.** The end shape rebuilt for this stacking, and guides along that order: the sails standing, S's wall
     under first, the end pieces unfolding, the flaps going in with their middles crumpling.

   **The paper balloon** (October 2026). The gallery's water bomb ends flat, with "blow into the hole" in words;
   blowing it up is a bend of its own (Kids Web Japan's balloon, the same model, ends as a rounded cube with a crease
   round its middle, where the flat outline was).
   - **Air.** `bendFrame` takes `inflate`, a volume: the paper must enclose at least that much round its middle by
     the last stage, a share more each stage, as one constraint pushing every point out along its triangles'
     normals (also in each step solving everything together, or that undoes it). Only the skin is pushed: for
     paper lying flat in layers, a triangle that's the top or bottom layer where it lies. Pushing every layer out
     sent the flaps tucked into pockets out through the paper over them. Blown up, the paper ignores the table and
     each frame is lifted back onto it, so it puffs out both ways, as it does in your hands.
   - **Sides by layer.** For paper lying flat in layers, which side of a triangle a point belongs on now comes from
     the layers of the faces they're on, not where the mesh happens to start them.
   - **Settling without keeping layers apart.** With no creases held, pushing each pair of layers apart in turn,
     pass after pass, ratcheted the water bomb's 24 layers upward off the table (1.4 cm to 4.7 cm, with nothing
     asked of it). Settling now only sets edges; the stages keep layers apart, creases holding. With no air, the
     water bomb then stays within 0.2% and crosses by at most 3.4 mm, where folds start a hair inside one another.
   - **Where it stands.** Blown up to 0.027 (a cube 0.3 across, from the flat outline's length), with creases free
     to turn, it puffs into a lens 16.5 cm tall, stretched 2% and with paper up to 1.9 cm through paper; about
     two minutes to solve (8 s at a mesh of 0.07). `scripts/balloon-lab.ts` tries it.
   - **Why it crosses itself.** At the deepest crossing every corner that lies over the other triangle is on its
     proper side: the triangles interlock edge first, and once they have, keeping them apart only stretches the
     paper. Edge-against-edge contacts (sides from layers too), searching for contacts every iteration, capping
     the step solving everything together, and a short pass keeping layers apart after settling all left it at
     about 1 cm (on `wip/balloon`). And however much air it's asked for, it stops at a pillow about 9 cm tall:
     the cube needs its hexagon outline drawn in to a square belt, which a solver nudging the paper can't find.
   - **Where the air goes** (on `wip/balloon`). Followed in from the hole (the sheet's middle), the pocket the air
     fills lies between layers 9 and 14, the water bomb base's inner walls; the flaps outside and the corners tucked
     inside rest on them. Pushing only those walls keeps the paper within 0.2% and fills it to 20 cm, but it opens
     like a clamshell about the hole's end: the paper at the far tip slides apart, which the tucks' friction stops
     in real paper. Holding points that lie together on the outline from parting stops that, and then it barely
     fills (5 cm): with its outline held, the paper can only bulge by bending. Drawing the outline in to a square
     belt with goals mangles it.
   - **The cube, face by face** (November 2026, `scripts/balloon-cube-lab.ts`). Flat, the water bomb is a cube
     pressed flat, and a smaller one than thought: ¼ across, not 0.3. The paper round the sheet's centre, a plus
     with pointed arms (|u| or |v| under ⅛, inside |u| + |v| = ½), covers it exactly once: the centre square is the
     face at T (the sheet's centre), the arms the four sides, their points the face at the hole (the edge
     midpoints meet in its middle). In the stack, the front and back sides lie flat (layers 8 and 15), the left and
     right sides fold in half between them as a paper bag's gussets do (layers 9 and 14), and both end faces fold
     up as water bomb bases. The flat outline isn't a belt round the middle: it runs from T across its face to a
     corner, down an edge and across the hole's face. So the pocket the air fills is between layers 8 and 9 and
     between 14 and 15, joined in the middle; between 9 and 14 is outside, inside the gussets, where the corners'
     tips are tucked. The corners lie against the outside of the plus, so each point of the flat model goes where
     the face it lies on goes, out from it by as many layers. Guided there, the solver does reach a cube (0.27
     across, its sides clean, the flaps in place but for a corner or two).
   - **The way there.** The front and back sides part (d = ¼ sin θ), the side faces open as gussets and the end
     triangles on the front and back turn up. The end triangles on the sides can't: with every face of the plus
     flat, only the flat stack and the cube fit (worked through for an octagonal box too: the end's eight triangles
     force it back to one or the other), like a paper bag, which can't be opened rigidly either. The line from T
     to the middle of a gusset's edge is shorter in 3D than on the sheet. Two ways tried: bulging those triangles
     out (asks up to 18% stretch of them on the way), and folding each half from its corner to a point on that
     line (exact; the point is level with T and in line with the gusset's edge, t = 1 − cos θ along it), which
     moves the fold across the paper as the balloon opens. A fixed fold fits only at θ = 60°; a cone at the corner
     misses by 1–3 cm.
   - **Why it doesn't solve smoothly yet.** Either way the paper ends at the cube within about 2–3%, but it plays
     at 30% or more: at T and at the hole the end triangles lag behind their guides, folded along the creases
     they have, and then jump, all four together, as a water bomb base pops through (a triangle turning up to
     150° between two frames). Unchanged with exact guides on the plus alone, without the layers' sides, with the
     end faces left unguided, with guides right up to T and the hole, with twice the stages, a finer mesh (0.045)
     or guides held 100 times stiffer. The solver keeps paper folded along creases it has rather than make a fold
     that moves across it. The file was over budget too, 1.2 MB at 12 stages; 312 KB written compactly.
   - **Tried: a rolling fold** (`MODE=roll`). The moving fold is sharp: it starts almost flat on the diagonal
     crease (the path round the corner turning 159°) and eases to the cube's edge from the corner to the middle of
     the gusset's edge (94° near the end), so in effect it rolls from one to the other, passing within a few
     centimetres of T (and the hole) while still folded 120°–160°. Rounded, each half is a cone at its corner, its
     directions turning steadily over a few degrees either side of the fold; solving for how far it turns and
     which way it sets off keeps it exact and ending at the tip, but the front and back halves then miss along
     their shared middle line by up to 13 mm (solving for where the turn is instead moves the miss onto the
     diagonal, 23 mm). Solved: 40% stretch as it plays (rolled over 6°) and 88% (12°), against 29% sharp. With
     triangles 0.02 across in the end triangles (a finer mesh within given regions, tried as a bend option and
     taken out again), worse: 120–135%, the small triangles by T and the hole flipping right over.
   - **Next.** It's the solver, at the ends, that needs to change, or the path found some other way. A real balloon
     blown up slowly would show how the ends open; the end triangles might also take creases where they fold (a fan
     from each corner), which the paper doesn't have.
   - **In the gallery** (8 November 2026). The ends crumple on the way ("Improving the solver", crumpling): guided
     by the cube's map (now `src/models/recipes/balloon-cube.ts`, the lab keeping its other end shapes), folded
     along the cube's edges, in 16 stages, it blows up into the cube without snapping. See below for how it does.

8. **The iris, later.** It needs paper that bends and then lies flat again (a "relax to flat" mode, or using the
   solver to find the crease pattern real paper takes). Revisit once 1–7 are done.

9. **The cup, opened** (October 2026). Squeezed at its sides, the cup's walls bow apart into a mouth; it's stood up on
   its bottom crease as it opens. In the gallery.
   - **First tries.** Goals pushing the rim's corners in, the cup lying on the table: the bottom wall can't go down,
     so the whole stack domed up instead of the mouth opening. Off the table (`free`), with the rim's middles pulled
     apart as well: the mouth opened partway, the flaps peeled off the walls, and the last stage crumpled (4%). As
     for the fan, boat and balloon, a few goals leave the solver to find a shape far from a flat stack, which it
     doesn't.
   - **Guides** (`{ guide: { paper }, path }`). The shape is worked out beforehand and the paper led to it: points
     anywhere on the sheet, each with where it is at every stage, which pull it softly (compliance 1e-2) and give way
     where it can't follow without stretching. They're applied first in each pass, before the edges, so the paper
     follows as it can rather than ending each pass wherever the guides put it; nothing is pinned (a triangle held
     flat where it starts fought the paper curving through it). The cup's guide (`openCup` in its recipe) keeps the
     paper's lengths: each wall's horizontal lines stay as long, bowed into parabolas; its sides stay as long, drawn in
     by a pinch growing as the square of the height; and the line up its middle stays as long, the middle of the rim
     dipping below the corners to allow it. An earlier guide that only bowed the walls was 12% off the paper's shape
     at the corners, and a pinch turning the sides about the bottom corners opened the bottom crease right at them
     (depth as the square root of the height), where four folds meet; both left the paper stretched. Every layer
     goes with the wall on its side of the pocket, as far out as it lies, and the squeeze grows as the square of the
     stage, as the mouth opens as its square root: evenly ramped, the first stage opened it a third of the way, and
     the step stretched 12% as it played. Guides 5 cm apart and within 8 mm of the folds (414 of them) reach the
     narrow corners of the flaps; 7 cm apart and 1.2 cm in, paper passed 6 mm through paper there.
   - **Why the solver stretched paper rather than bending it.** Traced pass by pass, each stage's loop ended up to 94%
     stretched on some edges, put right only by setting lengths at the stage's end. A hinge's fold angle changes by
     the move of a corner divided by the triangle's height, so its gradient is about 1/h (50 for 2 cm triangles), and
     a compliance of 1e-2 in plain angles is nothing beside |∇θ|² ≈ 10⁴: every pass put the hinge right back, and the
     λ that lets it give would take about a million passes to build. Bending was rigid, and the guides (or goals)
     stretched the edges instead. Now a held hinge's compliance is a share of its own stiffness (Σ w|∇θ|²): bending
     1e-2, creases between faces 0.1 (they open as a cup does). Solving together, edges and goals' points get a far
     smaller floor than the rest (1e-8 against 1e-5), as at 1e-5 a hinge on a small triangle outweighed them there
     too. Without guides, hinges are held there at plain angles (1e-2), stiffly, so a crease goal turns a whole flap
     rather than kinking it by the crease; with guides, which carry the paper themselves, as shares of their
     stiffness.
   - **Paper through paper from the start.** Before anything moved, 2000 of the cup's point–triangle pairs were
     already a millimetre or two through each other, by folds and at corners where eight layers' corners meet (one
     point shared by layers 1, 6 and 7 sits mid-stack). Keeping each a gap apart pushed them 2 mm at every pass
     against the edges. Pairs found crossed as the paper starts are now kept no deeper through, not pushed out.
   - **Frames that pass through themselves.** Setting a stage's lengths, all at once or one at a time, ignores layers
     and moved 1600 points through paper by up to 3 mm, which drew as stripes in the viewer (the balloon showed it
     too). Now, where paper has gone through paper, each stage ends by settling the edges with layers kept apart
     (`settleLayers`): bending isn't held (held where the paper was, it pulled it back and stretched it), but faces that
     don't bend and crease goals are. It stops at the last look that found the paper stretched no more than 0.8%:
     interlocked paper, as in the balloon, can't be parted without stretching it, and stretched it 4%. Tried and
     dropped: contacts solved together with the edges (unstable in a deep stack: 20% stretched), lengths set all at
     once along the paper only (too stiff to change curvature, or with any slack across it, 600 points through),
     thinner layers in the solver (no better once the rest was right, and stacked bent layers half a gap apart
     z-fought in the viewer).
   - **Other bends.** The test models still pass, as do the balloon and the tulip bloom, which also bends: the
     balloon blows up about as far (7 cm), within 0.8%. A crease goal's turn needs stiff bending solving together, as
     above; goals' points are put where they end before the last stage's lengths are set, and the last pass holds
     them where it can. Both still show patches of paper through paper, as before: blown up, their layers interlock
     edge first, and settling with layers apart stops at its stretch rather than part them. Guides are the way on
     for them, as for the fan and the boat: the shape worked out face by face, the paper led there.
   - **Tried and dropped.** Turning the cup round as it stood up, to show its front with the flaps: it stretched 9.5%
     as it played, and the guide's arrow looped round it.
   - **Where it stands.** The cup: 1528 triangles (mesh 0.07), eight stages, about 9 s to solve, 860 KB. Its frames
     stretch at most 0.8% and 4.7% as it plays. (November 2026: solved by the energy, in ten stages, it stretches
     0.7% and 3.5% as it plays, and follows its guides to within 0.8 cm; see "Improving the solver", row 6.)
   - **Paper through paper, looked for again.** Inside the open cup, specks of the flaps showed through the front
     wall. In its last frame, 1050 pairs of triangles pass through a wall by more than a tenth of a millimetre (140
     by over 1 mm), mostly the corner flaps through the front wall, which they lie on, and the flaps' tops through
     the wall just under the rim, inside the fold that takes the apex flap round them. Few are there at the start (54,
     all under half a millimetre); they come as the cup opens, from each stage's loop and from setting lengths at
     its end, which moves paper a millimetre or two through layers 0.7 mm apart. Tried, each on the solver, and
     each trading crossings for stretch: finer meshes (no fewer crossings, and 15% stretched as it played); layers
     half as thick, or twice as thick; pushing out the pairs crossed at the start; setting lengths only along the
     paper (a third of the crossings, but 3% stretched at the rim's corners); settling only near what's stretched;
     and settling with layers apart in turns with setting lengths along the paper (a quarter of the crossings, but
     7% stretched under the rim). That last stretch is the fold round the flaps: five gaps out, on a rim turning
     about 1.8 radians, the apex flap needs about 1% more length than the paper has, so either it stretches or
     layers pass through it. In a viewer screenshot, the solver as it was showed the fewest specks.
   - **So the viewer draws bent paper's stacked layers in the order they were stacked** (`FoldedPaper`'s `LIFT`):
     each triangle a little nearer the eye by its layer before the bend, four layer gaps per layer, along the line
     of sight, so nothing moves on screen but which shows where layers meet: the side that faced up in the stack in
     the stack's order, the other side in reverse. Measured, the cup's crossings need under 2.2 mm a layer for 99% of
     them (the balloon 1.0 mm, the tulip bloom 2.6 mm); the cup, the balloon and the tulip bloom now draw clean, but
     for a mark or two at the cup's rim. It assumes paper stays in its stack's order where it meets: two walls facing
     each other across a pocket get an order that needn't be right within a few centimetres of where they meet (none
     shows in these models), and paper that swings past other paper as it bends (a fan's pleats) would need it
     thought about again.

## Improving the solver

Outlined in November 2026, after the boat and the balloon showed its limits (see step 7): paper that falls behind
its guides and then snaps through, playing that stretches wherever a triangle turns a lot relative to its
neighbours, paper through paper (points against triangles only, and only at moments), guides worked out by hand
for each model, finer meshes behaving worse, and no new creases. Tried on the balloon and no help: stiffer guides,
more stages, a finer mesh, no sides kept by layer, creases free to turn (they're held at the angle they start at,
folded flat in a stack), a rolled fold. In order:

| # | Work | Size | Status |
|---|---|---|---|
| 1 | Smaller files: bends' in-between frames and guides written compactly (see Format) | Small | ✅ November 2026 |
| 2 | A report on each bent step: stretch, turns between frames, lag behind guides, crossings, where (see Format) | Small | ✅ November 2026 |
| 3 | Each stage started where the guides put the paper (with dense guides), and the guides moved gradually within a stage rather than all at once, so the paper can't fall behind | Small | Tried November 2026: no help (below) |
| 4 | A stage split where something snaps (a triangle turning further than a limit, or the paper falling behind), keeping only the frames needed | Medium | |
| 5 | Paths found, not designed: from the start and a designed end shape, the in-between shapes that stretch the paper least (each fold's angle interpolated and the points rebuilt, as in Kilian, Mitra and Pottmann, "Geometric modeling in shape space", 2007) | Medium–large | |
| 6 | One energy per stage (stretch, bending, guides, contact) solved to its minimum by Newton's method, in place of passes and three different settlings | Large | ✅ November 2026, for guided bends (below) |
| 7 | Contact paper can't cross: checked continuously between steps, edge against edge too, ideally a barrier (IPC, Li et al. 2020) | Large | |
| 8 | Playing that keeps lengths: a few passes setting edge lengths in the viewer after blending | Small–medium | |
| 9 | A mesh that fits the bend: solved coarsely, refined where any frame bends sharply, coarsened where none does | Medium | Fixed folds ✅ November 2026: `lines` (below); refining where it bends, not yet |
| 10 | Creases that form: a hinge bent past a limit takes its new angle as its rest | Medium | |
| 11 | Paper that crumples for a while: regions where it may draw in, never stretch, exact again by the end | Small–medium | ✅ November 2026: `crumple` (below) |

The balloon's snapping wants 3, 4 and 5; crossings (the cup, the 3D tulip, the balloon) 7; the iris 10.

**Row 3, tried** (November 2026, on the balloon's exact guides). Leading the paper to its guides at each stage's
start (their moves spread over the mesh by its edges, so layers lying over each other aren't dragged along) put it
within 3–12 mm of them; ramping the guides over half a stage, or both, changed nothing either: the paper was as
far behind (1.4, 2.3, 3.5, 3.6 cm at stages 2 to 5) and snapped as before. It isn't falling behind as it goes.
Traced through a stage, the paper ends its passes 10–100% stretched (once 1000%), with bending held or not and
layers kept apart or not; then setting the edges' lengths at the stage's end, which knows nothing of the guides,
moves it 1–5 cm, and that's where it's kept. Setting lengths with the guides held softly as well (`keepLengths`
with guide rows) took the worst of it to 3 cm, no more. Two causes:
- **Guides the mesh can't follow.** Placed exactly where the cube's map puts them (`scripts/balloon-mesh-fit.ts`),
  the mesh's own triangles stretch: 80–135 of the 1400 over 1%, up to 48% on the way and 25% at the cube. Folds of
  the map cross triangles rather than running along their edges: the cube's edges (inside faces of the flat stack:
  in it, all the cube's top and bottom edges lie on two lines across the table), the end triangles' moving folds,
  and flaps wrapped round an edge many layers out (a few millimetres longer than the face under them, which is
  real). Creasing the cube's edges first, across the stack, brought it to 63–120 triangles (9% at most at the cube)
  and the stretch within a stage to 7–24%, but the paper was still as far behind.
- **A stage that doesn't settle.** 120 passes, a step solving everything together every 20 (each limited to a few
  millimetres), and then lengths set alone: where guides and lengths disagree, the paper never reaches a balance
  between them, and whatever the last setting of lengths finds is the frame. That's row 6: one energy, guides
  in it, solved to its minimum. A mesh with edges along the folds a bend makes (row 9; for fixed folds, lines on
  the table cut through every layer before meshing, as the creases above did) would make the guides reachable.

**Row 6** (November 2026). Guided bends now bring each stage to the least of one energy (`src/fold/bend/minimize.ts`): edges kept to their lengths by an augmented
Lagrangian (stiff springs whose rests move by how far each was off, round by round), bending per hinge as the
sheet's triangles weight it (Grinspun et al., "Discrete shells", 2003, so it costs the same however fine the mesh),
guides, goals, contacts and the table, by Newton's method (each step by conjugate gradients, each point's 3 × 3
block as preconditioner) with a line search; then lengths set exactly and layers parted as before. Contacts had to
come in only at half their gap (in a flat stack the least squeeze brings thousands in, and their coming and going
breaks the steps) and leave out points beside the triangle (across a fold lying flat they're almost on it).
- **The balloon.** No snapping: 0.6% stretch in its frames, 4.4% as it plays, at most 46° turned between frames,
  and setting lengths at a stage's end moved it half a centimetre, not five. But its ends never close: it stays as
  long as the flat stack, 15 cm behind its guides by the end. Unchanged with twenty times the steps, a finer mesh
  (0.045), no contacts, no bending, multipliers started afresh each stage, or guides on the plus alone (the passes,
  given the plus's guides alone, do reach the cube, snapping on the way). So the plus itself locks: following the
  cube's path takes the triangles round T and the hole stretching for a moment, which the passes allow (the snap)
  and exact lengths don't. Real paper crumples there.
- **The fan and the cup**, first: not as good. The fan 4–6 cm behind its guides (the passes 1.1), 2.6–9.4% as
  it plays (1.5%); the cup 5.5% as it plays. Tuned (`scripts/energy-tune.ts` solves a model's bend again from its
  file with the weights changed, in seconds), the contacts were holding the paper back from its guides: with the
  guides weighing ten times as much (10 against contacts' 10), bending at 1e-4, and a stage's steps ending once one
  lowers the energy by less than a ten-thousandth, the fan: 0.8% in its frames, 1.2% as it plays (the passes
  1.5%), 0.6–1.2 cm behind its guides (0.7–1.2), paper through paper 0.14 cm (0.25), 13 s to solve (6 s). The
  cup still played at 5.6%, from the flat stack into its first frame, which it now reaches nearer its guides; in
  ten stages rather than eight (270 KB, the files now written compactly): 0.7% in its frames, 3.5% as it plays
  (the passes, in ten, 3.9%), 0.8 cm behind its guides (1.2), 0.47 cm through paper (0.51), 39 s (16 s). Guides
  ten times heavier still (30) made the cup worse (12% as it plays). So guided bends use the energy, and the fan
  and the cup were made again with it. Bends without guides (blown up, goals only) still use the passes. The
  test suite takes 340 s rather than 240, replaying the two.
- **The balloon** with those weights reaches nearly the cube (0.31 long) but snaps on the way again (74% as it
  plays): the guides now outweigh the lock at its ends, which still has to give somewhere.
- **Next.** For the balloon, a few places (T, the hole) where the paper may crumple, its lengths given way for a
  while, if the cube's path is to be followed without snapping (done: row 11); for the rest, the energy taking over
  the bends without guides too, once they're tuned as these were.

**Row 9, fixed folds** (November 2026). A bend can name `lines` on the table it will fold along (`cutAlong` in
`src/fold/bend/frame.ts`): every face a segment crosses, in every layer, is cut along it before meshing, as scissors
would but joined still, and the bent frames' faces point back at the frame's. A fold through the middle of a face
then runs along the mesh's edges: in a test, turning part of one face straight up about a line through it, the
paper ends within a centimetre of the fold's shape, more than twice as near as without. On the balloon, the cube's
top and bottom edges lie on two lines across the flat stack (`CUBE_EDGES`): with them, the triangles that can't
follow the cube's map flat drop from 102 to 76 at the cube (9% at most, from 25%), its frames stretch 0.3% rather
than 0.8%, and it ends 3.1 cm from its guides rather than 6.4. It still snaps on the way (79% as it plays): that's
its ends, which have to crumple (above). Refining the mesh where the paper bends most, for folds that move, isn't
done.

**Row 11, crumpling** (November 2026). A bend can name regions on the table, for paper lying flat, where it may
crumple on the way (`crumple`): in every frame but the last, an edge with only those triangles on it may draw in
shorter than the paper, never stretch. Real paper crumples there (a balloon's ends, where the creases meet at T and
the hole, crinkle as it's blown up); a mesh this coarse can't wrinkle, so it shows as the paper there drawing in. In
the energy (minimize.ts) such an edge has no multiplier and, drawn in, a spring 0.003 as stiff as stretching's: with
none, a few edges took all of it and collapsed (in a test, to nothing), and triangles folded over each other popped up
as the paper opened out again; at 0.01 the balloon fell 1.6 cm behind its guides and snapped a little. Each stage's
end keeps them as short as they've drawn in. Checking a model (validate.ts) and the bend report count only how far
that paper stretches; the report says how far it drew in, separately.
- **The balloon**, its ends past the cube's edges allowed to crumple (`CUBE_ENDS`): no snapping (no triangle turns
  more than 33° between frames, from 152°), within 1.4 cm of its guides throughout (from 7 cm), 0.8% stretch in its
  frames and 4.2% as it plays, paper 4 mm through paper at most (from 1.6 cm), and it ends a cube ¼ across, as the
  map says. The paper by T and the hole draws in by up to a third on the way. 1152 triangles in 16 stages, 325 KB
  of its file, about 40 s to solve (12 stages played at 4.9%, too near the 5% allowed).

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
  Is that enough, or does the fan's twist need a finer mesh near the pinched end? (November 2026: thin faces now
  have their outlines cut evenly, which the fan's strips needed; see step 6.)
- **A bend tool in the Studio.** Worth it only if creators ask for curved finishes.
