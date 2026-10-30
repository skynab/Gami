# Plan: the Studio for everyone

Status: **steps 1 to 4 done** (29 October 2026): the local library, the open Studio, tape, and the first fold presets. Swivel and open sink presets, bend and submissions not started.

The Studio today is for approved creators only (`docs/accounts.md`): it needs Supabase, a sign-in and the creator
role, keeps one draft in the browser, and saves to the cloud, where a model can be shared by link and submitted for
the gallery. This plan opens it to everyone and fills in the folds it can't make yet:

1. **Anyone can use the Studio, and their designs are kept in their own browser.** No account, no server.
2. **Every standard fold type is a tool**, so a design never needs hand-placed creases for a squash or a petal fold.
3. **Bend**, the hard one: paper that curves rather than creasing.
4. **Later: submitting a design of your own** to the gallery, certifying it's yours. Deliberately left out of the
   first pass: it needs a review process, licensing and moderation (part 4 sketches it).

## Where the Studio is now

| | Today |
|---|---|
| Who | Creators and admins, signed in (`/studio`); a dev-only Studio at `/studio/dev` |
| Saving | One draft in `localStorage` (`gami.studio.draft`), plus cloud models for creators |
| Sharing | Private links (`/s/<token>`), submit for the gallery, admin review (`/admin`) |
| Tools | Fold (valley, mountain; onto, through, edge to edge; top N layers or picked faces), Reverse (inside, outside), Collapse (crease by crease), Lift and curl, Pop up, Cut, Draw, Move a sheet, Unfold, Turn over, Rotate, Fresh sheet, Add to step, Change a step |
| Missing | Bend, Tape, and one-step tools for the named compound folds (squash, petal, rabbit ear, sink, crimp, pleat, swivel) |

Every operation is already recorded in `.fold` files (`gami:op`) and replays when an earlier step changes, so new
tools only need to make operations; saving, replaying and viewing come for free.

## Part 1: open the Studio, keep designs locally

### Who can use it

- `/studio` opens for everyone, on every deployment, with or without Supabase settings.
- The cloud panel (save, share link, submit) shows only to signed-in creators, as now. Nothing in it changes, but it's
  no longer what gates the Studio. Until part 4 is designed, consider hiding **Submit for the gallery** even for
  creators: today's submission has no ownership certification or licence (see part 4).
- The gallery's **Studio** button stops saying "creators only".

### My designs: a local library

Today there's one draft. Instead, a list of designs, each a `.fold` file plus a little about it:

```ts
interface LocalDesign {
  id: string;            // random, never reused
  file: FoldFile;        // the model, exactly as it would be exported
  created: number;
  updated: number;
  thumbnail?: string;    // the finished model from above (thumbnail.ts), for the list
}
```

- **Stored in IndexedDB**, not `localStorage`. A design with a bend step carries its solved frames and can run to
  megabytes; `localStorage` stops at about 5 MB for the whole site. One small wrapper (`src/studio/library.ts`) with
  `list`, `get`, `put`, `remove`; every call allowed to fail quietly, as progress and favourites are.
- **Ask the browser to keep it** (`navigator.storage.persist()`) the first time a design is saved, so it isn't
  cleared when the device runs low on space.
- **Saved as you go**: every change writes the open design (debounced), as the draft does today. Undo history stays
  per visit.
- **The Studio's front page** (`/studio`) lists designs as cards (thumbnail, title, steps, last changed), with New,
  Open, Duplicate, Rename, Delete (with a confirmation that names the design), Export `.fold` and Import `.fold`.
  `/studio/<id>` edits one.
- **Folding your own design**: each card has **Fold it**, opening it in the ordinary viewer (`/mine/<id>`), with
  progress and favourites working as for gallery models.
- **Moving from the single draft**: on first load, an existing `gami.studio.draft` becomes the first design in the
  library, and the key is removed once that's written.
- **Saying where it lives**: a line on the library page that designs are kept in this browser only, and that
  exporting is the way to back one up or move it to another device.

Done when: someone with no account can make two designs, reload, find both, fold one in the viewer, export one,
delete it, import it again and get the same model back (the `.fold` round trip, tested as the gallery's are).

## Part 2: every standard fold type as a tool

Compound folds are all collapses underneath. The recipes already work out their creases from a few picks
(`squashEnd` in `windmill.ts`, the petal fold in `bird-base.ts`, `Recipe.swivel`); the Studio makes you place each
crease of a collapse yourself. The plan: move that geometry into shared **fold presets** (`src/fold/presets.ts`),
each taking the picks a person would naturally make and returning an ordinary operation. Recipes and the Studio both
use them, and the step is saved as the collapse it makes, so it replays and opens in **Change** like any other.

| Fold | Made today | The tool would ask for | Notes |
|---|---|---|---|
| Valley, mountain | Fold | (as now) | Done |
| Inside, outside reverse | Reverse | (as now) | Done |
| Squash | Collapse, by hand | The flap, and the line it opens along (usually its middle) | Creases: the flap's spine opens flat, its sides fold out. From `squashEnd` |
| Petal | Collapse, by hand | The flap's free corner, and the line it lifts on | Kite creases found from the flap's edges. From `bird-base.ts` |
| Rabbit ear | Collapse, by hand | The corner, and the two edges that fold to the bisector | The folds-lesson's rabbit ear, generalised |
| Crimp | Collapse, by hand | Two parallel lines across a point or strip | Two reverse folds made together; inside or outside |
| Pleat | Two folds in one step | Two parallel lines | Valley then mountain, made together (`together`) |
| Swivel | Recipes only (`Recipe.swivel`) | The pivot, the hinge, and the angle | Stored as a collapse already |
| Open sink | Collapse, by hand | The point and the line it sinks to | Works where the paper can open flat. **Closed sinks aren't possible in the engine** (it can't re-stack layers inside a closed point): offer the open sink and say so |
| Tape | Recipes only (`Recipe.tape`) | The two ends of the strip | New in October 2026; needs a Studio tool and showing on the 2D editor |
| Bend | Recipes only | See part 3 | |

Each preset tool:

- shows the creases it worked out on the 2D editor before it's applied, so the result is never a surprise;
- explains, in the hint line, why it can't be made (no flap there, the flap would tear), as collapse errors do today;
- can be opened in **Collapse** afterwards to adjust a crease, for anything the preset gets nearly right.

Done when: the common-folds lesson (`folds-lesson.ts`) can be remade in the Studio with one tool use per fold, and a
test makes each preset on the lesson's paper and compares the frame with the recipe's.

## Part 3: bend in the Studio

The engine side is done (`docs/bending-plan.md`): `bend` operations, the solver, meshing, baked frames and the
viewer. What's missing is a way for a person to say what should bend and where it goes, and to wait for the solver
without the page freezing.

### What a bend step needs from the person

1. **The paper that may bend**: pick faces, as other tools do (Pick faces), or a whole flap.
2. **What stays put**: an anchor on the paper (the Lift tool's anchor picking already does this).
3. **Where it goes**, either:
   - **crease goals**: pick an existing crease and give it an angle (a number or a slider). This is the easy form,
     needs no 3D picking, and covers opening a fan or a boat's sides; or
   - **point goals**: drag a point of the paper to a new place in 3D. This needs a handle in the 3D view (a point
     moved along the plane facing the camera, as other 3D editors do), and is the hard form. Leave it until crease
     goals have been used on real designs.
4. Optional: **mesh size** (finer bends look smoother but take longer), and **blow it up** (the balloon's inflate).

### Solving without freezing

- Run the solver in a **Web Worker**, with a progress bar and **Cancel**. Only the end result and the in-between
  frames come back.
- **Preview coarse, then bake fine**: a quick solve on a coarse mesh while settings change, the full one on **Add
  step**.
- **Keep the baked frames** when the design is saved, and re-solve only when an earlier step changes (the bending
  plan's open question, settled this way so opening a design never waits on the solver).
- Phones: cap the mesh, and say when a bend will be slow before starting it.

### Limits to keep, and say

- Paper that has bent can't be folded again (the engine's rule today); the tool says so, and offers to make bending
  the last steps of a design.
- A solver finds *a* shape, not necessarily the one real paper takes: the preview is there so people can adjust.

Done when: the boat's or the fan's last step (on the `wip/boat` and `wip/fan` branches) can be made in the Studio with crease goals, saved,
reloaded without re-solving, and changed (an earlier step edited) with a re-solve that finishes or can be cancelled.

## Part 4 (later): submitting your own designs

Not in the first pass. When it comes, it builds on the cloud Studio that exists (milestone 7a: saving, review,
publishing), and adds what an open gallery needs:

- **Ownership**: on submitting, the person certifies the design is their own (or traditional, with no known
  designer), names how they'd like to be credited, and says where it was first published, if anywhere. Kept with the
  model and shown on its page, like `PROVENANCE.md` records the built-in models.
- **A licence**: the gallery takes only open designs (traditional, openly licensed, or Gami's own under CC BY 4.0,
  `DESIGNS-LICENSE.md`). A submission is published under an open licence the person chooses at submission (CC BY 4.0
  by default), so anyone can fold and teach it. They're told this before they submit.
- **Review**: the existing admin queue, with the certification shown, a check against known copyrighted designs
  (Gilad's database), and reasons to send back.
- **Takedown**: a way to report a design that isn't the submitter's, and to unpublish it.
- **Accounts**: submitting needs a sign-in (designing doesn't). Local designs move to the cloud only when submitted.

## Order of work

| # | Work | Size |
|---|---|---|
| 1 | Local library: IndexedDB wrapper, list page, autosave, import/export, moving the old draft | Medium |
| 2 | Open `/studio` to everyone; cloud panel for creators only; "Fold it" in the viewer | Small |
| 3 | Tape tool, and tape on the 2D editor | Small |
| 4 | Presets: pleat, crimp, squash, petal, rabbit ear (shared with recipes) | Medium |
| 5 | Presets: swivel, open sink | Medium |
| 6 | Bend with crease goals, solved in a worker, baked on save | Large |
| 7 | Bend with point goals (3D handles) | Large, and only if 6 shows the need |
| 8 | Submissions with ownership and licence (part 4) | Large; needs decisions first |

1 and 2 together make a useful release on their own. Each later row ships separately.

## Progress

| # | Status |
|---|---|
| 1. Local library | Done. `src/studio/library.ts` keeps designs in IndexedDB (`list`, `get`, `put`, `remove`, all failing quietly) with each one's title, step count and thumbnail beside its `.fold` file, so the list reads no models. The draft store (`studio/draft.ts`) edits one design at a time and writes it 400 ms after each change, and on leaving the page. The old `gami.studio.draft` becomes the first design, its key removed only once that's written. `navigator.storage.persist()` is asked once a visit. |
| 2. Open the Studio | Done. `/studio` is the library for everyone (New, Import, and on each card Fold it, Duplicate, Rename, Export, Delete), `/studio/<id>` the editor, `/mine/<id>` the viewer (progress kept as `mine-<id>`). `/studio/dev` is gone. Signed-in creators get the cloud panel in the editor as before; opening a cloud model makes it a design of its own, or reopens the one made from it. People who aren't creators see how to ask on the library page. Submit is still shown to creators (the open question below). Favourites aren't offered for designs: the gallery's favourites list only shows gallery models. Tested end to end in `e2e/studio.e2e.ts`. |
| 3. Tape | Done. **Tape** is an action beside Cut: pick its two ends, anywhere on the paper, and a width (narrow, normal or wide; a step made with another width keeps it). The strip about to be laid shows outlined on the 2D editor, and laid tape shows there from then on, drawn with the face it's stuck to so the paper above covers it (`tapeOnFace` in `studio/editor.ts`). Change opens a tape step with its ends and width. |
| 4. Presets: pleat, crimp, squash, petal, rabbit ear | Done. `src/fold/presets.ts` turns a few picks into an ordinary collapse: a pleat or crimp from its two crease lines; a squash from the flap's corner (where its hinge and folded edge meet) and a point on the line the folded edge lands on; a petal from the flap's free corner alone (the kite creases halve the angles at it and run to the far edges); a rabbit ear from the corner that stands up and the other two (its creases meet at the triangle's incentre). Which paper each crease folds comes from the stack: each face's rank (how many faces lie over it), which faces are joined along a folded edge, and for a rabbit ear, the sector round the middle point a face lies in. Where a crease's kind depends on the layers, each way is tried and the first that folds flat is kept (Other way picks the next). `presets.test.ts` makes each one on the common-folds lesson's paper and finds the lesson's own frame, every sample point in the same place and the layers stacked the same; the petal also matches the crane's second petal fold, turned over. In the Studio it's one action, **Named fold**, its creases shown on the paper before it's made; the step is saved as a collapse titled after the fold, so it opens in Collapse to adjust. The recipes still make these folds their own way; they could call the presets, which would change no frame (the tests show the same paper). The Studio's actions now wrap on a phone, where Draw and Move had run off the screen. |

## Open questions

- **Keep the cloud Studio during the first pass?** Creators could keep cloud saving and share links while everyone
  else saves locally, or the cloud panel could be hidden for everyone until part 4. Leaning: keep save and share
  links for creators, hide Submit.
- **Sharing without accounts.** Exporting a `.fold` file works today. A share link without a server could carry
  the design in the address itself (compressed), which is fine for small designs and can't hold a bend's frames.
  Worth it?
- **A tour for first-timers.** The Studio has many tools. A short "make your first fold" walkthrough, like the
  Basics lesson does for the viewer?
- **Phones.** The 2D editor works with a finger, but picking small faces is fiddly. Is the Studio a desktop-first
  tool for now?
