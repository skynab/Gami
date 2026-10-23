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
7. **The boat.** Pulling the diamond's points apart, as a bend from the small diamond. Done as for the fan.

   **Started; not reachable yet.** What the first try found (on `wip/boat`):
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
   - **Next.** Work out where each of the diamond's 28 faces goes in the finished boat (a paper model would settle
     it), then give the opening as those faces' crease angles.

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
   - **Next.** Build the blown-up shape first (where each of the flat water bomb's faces goes on the cube) and let
     the solver settle it, as for the boat. A real balloon, blown up and looked at face by face, would settle where
     the hole, the tucked corners and the outline end up.

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
