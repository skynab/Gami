# Plan: fold operations in .fold files

Today a `.fold` file stores what the paper **looks like** after each step, not **how it got there**. That's
enough to play a model back, share it and add steps at the end, but not to go back and change step 5 of an
imported model: the Studio only knows the result of step 5, so the only way to change it is to undo
everything after it.

This plan adds the operation behind each step (`gami:op`) alongside the geometry that's already there. A
file with operations can be replayed from the start, so any step can be edited, inserted or removed and the
steps after it worked out again.

## What we have now

- Every built-in model is a code recipe (`src/models/recipes`) that `npm run models` bakes into
  `public/models/<id>.fold`. The recipe is the only place the operations exist.
- The Studio folds with the same engine, keeps the draft as a `FoldFile` (browser storage and cloud), and
  exports and imports `.fold` files. Steps can only be added or removed at the end.
- Lifts (3D shaping) keep their flat base and bends in a session-only map, so after a refresh or import
  a model that has been lifted can't be lifted further. Operations in the file fix this too.

## Approach

1. **Keep the baked frames.** The viewer, gallery cards, other FOLD tools and older Gami builds read them
   as they do now. They're also what replaying is checked against.
2. **Add `gami:op` to each step**: one JSON object saying which engine call made the step from the frame
   before, with every argument in plain data.
3. **Replay** turns `start` + ops back into frames. The Studio replays from an edited step onwards; the
   tests replay every built-in model and compare with its baked frames.
4. **Points follow the paper.** An op names points the way recipes already do, as a point on the sheet
   (`paper`) or on the table (`table`), so when an earlier step changes, "this corner onto that crease"
   still means the same corner.

## The format

A step in `file_frames` gains one field. Everything else is unchanged.

```json
{
  "frame_title": "Fold the top-left corner to the middle",
  "gami:text": "Line the top edge up with the centre crease.",
  "gami:kind": "fold",
  "gami:op": {
    "op": "fold",
    "line": { "onto": [{ "paper": [-0.35, -0.5] }, { "table": [0, -0.15] }] },
    "kind": "valley"
  },
  "vertices_coords": [...],
  "faces_vertices": [...],
  "gami:vertices_paper": [...]
}
```

The file's top level gains `"gami:ops": 1`, the version of the operation format. A reader that doesn't know
the version ignores every `gami:op` and treats the model as baked, as now.

### Points and lines

```ts
type At = { paper: Vec2 } | { table: Vec2 };

type LineSpec =
  | { onto: [At, At] }                    // fold so the first point lands on the second
  | { edgeOnto: [[At, At], [At, At]] }    // fold one edge onto another line
  | { through: [At, At]; moving?: At | 'smaller' }  // along a line, moving the side `moving` is on (or the smaller side)
  | { line: { p: Vec2; d: Vec2 } };       // a raw line on the table, as a last resort
```

These are the recipe helpers (`onto`, `edgeOnto`, `along`) and the Studio's three line tools (`onto`,
`edges`, through two points) — the same three ideas, so both record the same thing. A `through` line with
no `moving` is used as given (a collapse's creases); the Studio's through-two-points tool records
`moving: "smaller"`, as it folds the smaller side over. `flip: true` turns any line round (the Studio's
**F** key).

The Studio picks points from `snapPoints`, which are on the table. When recording, a pick that sits on a
vertex of the topmost face there is stored as that vertex's `paper` point; anything else stays `table`.

### Choosing faces

Recipes pick faces with closures (`only: stem`, `under: behind`, `only: ([u]) => u > 0` — about 40 of them
across the recipes), and closures can't go in a file. A selector is data instead:

```ts
type Faces =
  | { sheet: number }                     // one sheet of a multi-sheet model
  | { top: number }                       // the top N layers on the moving side
  | { inPaper: Vec2[][] }                 // faces whose centre on the sheet is inside one of these outlines
  | { all: Faces[] };                     // every condition at once
```

Recipes don't need to change: when a recipe step runs, its closure is evaluated on the current faces and
recorded as `inPaper` with the outlines of the faces it accepted (what `Recipe.pieces` already does). The
Studio already turns "top N layers" into face outlines in `topLayers`, so it records those the same way,
and `{ sheet }` for its sheet picker.

`inPaper` outlines come from the faces at the time, so if an earlier edit cuts the paper differently, a
selector may no longer match. Replay reports that (below) rather than guessing.

### Operations

| `op` | Arguments | Engine call |
|---|---|---|
| `fold` | `line`, `kind` (valley / mountain), `layers?`, `only?` | `fold` |
| `collapse` | `creases: { line, kind, only? }[]`, `anchor: { paper } \| { auto: true, among? }`, `under?` | `collapse` (squash, petal, sink, reverse, bases) |
| `unfold` | `to?`: the step to open back to (default: the last fold, as now) | `unfoldStep`, which also rebuilds `via` |
| `turnOver` | — | `turnOver` |
| `rotate` | `degrees` | `rotate` |
| `move` | `only`, `to?: At`, `degrees?`, `flip?`, `under?` | `place` |
| `newSheet` | — | the fresh sheet of `Recipe.newSheet` |
| `shape` | `bends: { line, flip?, degrees, segments?, reach?, layers?, only? }[]` | `shape` / `reparent` |
| `popUp` | `centre: At`, `rays: { azimuth, elevation }[]` | `radial` |
| `together` | `ops: Op[]` | several ops merged into one step, as `Recipe.together` |

`anchor: { auto: true }` is what the Studio uses (`anchorFor`, among the faces of the chosen sheet),
worked out again on replay. Recipes give their anchor point. A `shape` step keeps only its own bends: a run
of shaping steps one after another bends the flat state before the run, and replay collects the earlier
steps' bends itself, which is what the session-only map does now. A curl with `reach` spreads out to that
point, as recipes curl; without it, to the farthest paper it turns, as the Studio curls.

`crease` isn't an op: it's a `fold` step followed by an `unfold` step, as in the file today.

## Replaying and editing

`replay(model, from)` in a new `src/fold/ops.ts` keeps steps before `from` as they are and runs each op from
there on the frame before it. Each step comes out as one of:

- **ok**: replayed. Its title, text and section are kept.
- **failed**: the engine threw a `FoldError`, or a point is no longer on the paper, or a selector matches
  nothing. Replay stops here; this step and the ones after it keep their old frames and are shown as
  needing attention.
- **baked**: the step has no op (an older file, or a step from a tool that doesn't write ops). Replay can't
  go past it, so an edit before a baked step is refused with a message saying why.

In the Studio:

- Clicking a step in the step list opens it for editing: the tools are set from its op (line tool, picks,
  kind, layers, sheet, creases) on the frame before it, and **Apply** replaces the op and replays the rest.
- **Insert step here** and **Delete step** work the same way: change the op list, then replay.
- After an edit that leaves failed steps, the Studio says which and offers **Remove from here** or going to
  the failed step to fix it.
- `undo` keeps working on the op list, so an edit can be undone.
- The draft (browser storage and cloud) is a `FoldFile`, so it carries ops with no other change.

## Recording

- **Recipes**: each `Recipe` method records its op in `push`. Values the recipe works out from the paper
  (`sheetAt`, `layerAt`, `stackAt`, measuring `current.vertices_coords` as the paper plane does) end up as
  constants in the op, which is fine: the recipe stays the source for built-in models, and the op is what a
  creator edits after importing one.
- **Studio**: `apply`, `doUnfold`, `doTurnOver` and `doRotate` build the op from the tool state they already
  have and pass it to `addStep` with the frame.

## Checks and safety

Imported and shared files are untrusted data:

- Parse ops with a strict schema check (known `op` names, numbers where numbers go, limits on list sizes),
  and drop `gami:op` from a step that fails it, with a message, keeping the step as baked.
- Replay in the Studio only, never when viewing; viewing a model uses its baked frames.
- Cap replay work (steps, faces) so a hostile file can't hang the tab.
- Run `problems()` (`src/fold/validate.ts`) on the replayed model before showing it, as the follow-up
  "Validate imports" work does for plain files.

## Tests

- **Every built-in model replays to its baked frames** (to the file's 1e-9 rounding), in
  `src/models/models.test.ts`. This proves recipes record everything they do.
- Round trip: `toFoldFile` → `fromFoldFile` keeps ops (in `src/fold/fold-format.test.ts`).
- Editing: change an early fold of the paper plane, replay, and check later steps follow the paper (the
  corner folds still meet the centre crease).
- Failure: an edit that leaves a later selector matching nothing marks that step failed and stops there.
- Files without ops, and with an unknown `gami:ops` version, load as baked models.
- Studio (Playwright): import `crane.fold`, edit step 3, see the steps after it replayed; refresh, then lift
  a shaped model again.

## Order of work

1. ✅ **Format and replay.** `Op` types, `src/fold/ops.ts` with `replay` and `parseOp`, `fold-format.ts`
   reading and writing `gami:op` and `gami:ops`. Tests with hand-written ops (`src/fold/ops.test.ts`),
   including the paper plane replayed to its recipe's frames. The helpers replay shares with the Studio
   and recipes (`locate`, `anchorFor`, `topLayers`, `smallerSideMoves`) moved to `src/fold/select.ts`.
2. ✅ **Recipes record ops.** Every `Recipe` method records its op; tests on faces are recorded by
   `recorder` as the outlines of the faces they picked, rounded like the frames. Every built-in model
   replays from its .fold file to the same frames (`src/models/models.test.ts`), and the frames in
   `public/models` didn't change. The files grew by about a third (the tulip, with many picked faces, by
   about 70%). A `moving` point lying on its own line turns the line round, as `along` always did.
3. **Studio records ops.** Every new Studio step has an op; lifts read their base from ops instead of the
   session map.
4. **Studio editing.** Edit, insert and delete steps, with replay and the failed-step messages.
5. **Translations note.** Step text is translated by its English wording (`src/i18n/steps`), which ops
   don't change. Nothing to do, but worth checking edited built-ins still find their translations.

## Open questions

- **Exact replay across browsers.** Replay uses `Math.sin`, `Math.hypot` and so on, which can differ in the
  last bits between JavaScript engines. Comparing with a tolerance covers the tests; the viewer always uses
  baked frames, so it doesn't matter there.
- **Selectors after big edits.** `inPaper` outlines are the honest record of what a recipe chose, but a
  creator who refolds an early step may have to re-pick faces for later steps. A smarter selector (by
  sheet region, say "the left half of the sheet") would survive more edits; worth adding only if creators
  hit this often.
- **Ops from other tools.** Should a file from another FOLD tool that has only a crease pattern become a
  single baked step, or be refused? Out of scope here; files without `gami:` keys are refused today.
