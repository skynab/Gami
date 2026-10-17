# Gami: Implementation Plan

Learn origami by watching each fold happen in 3D, from any angle.

## 1. Product principles

- **One idea per screen.** The gallery is for picking a model. The viewer is for folding it. Every control has to earn its place.
- **The paper is the interface.** Instructions appear on the paper as crease lines, arrows and a "ghost" of the next state. Text only supports them.
- **Never lose your place.** Step position, camera and speed are kept in the URL and in local storage, so a refresh or a shared link opens the same view.
- **Learning is free and needs no account.** Only the advanced Studio needs a sign-in.
- **Works with a mouse or a finger.** Everything uses Pointer Events, and nothing depends on hover or right-click.
- **Styling follows BackSubtract.** Same tokens, top and bottom bars, segmented controls and light/dark theming (see §6).

## 2. Architecture

| Concern | Choice | Why |
|---|---|---|
| Build | **Vite + TypeScript** | Same as BackSubtract: fast builds, static output |
| UI | **React 19** | Shared knowledge with BackSubtract |
| Routing | **React Router** (3 routes) | `/`, `/learn/:modelId`, `/studio/:draftId?` |
| App state | **Zustand** | Easy to share between React and the render loop |
| 3D | **Three.js** via **@react-three/fiber** + **@react-three/drei** | Gives OrbitControls/CameraControls, a view gizmo and smooth camera transitions |
| Model format | **FOLD** (`.fold` JSON) with a small Gami extension | Open standard used by Origami Simulator and others. Import/export come for free |
| Fold engine | Our own TypeScript module, pure functions | Testable, and shared by the viewer and the Studio |
| Auth + data (Studio only) | **Supabase** (Auth, Postgres with row-level security, Storage) | Role gating is enforced on the server. Free tier is enough to start |
| Hosting | Static host (Cloudflare Pages, Netlify or GitHub Pages) | Built-in models ship as static JSON, so learning needs no backend |
| Offline | PWA service worker (later milestone) | Built-in models work offline once visited |

## 3. How a model is represented

This is the core of the project. Both the viewer and the Studio depend on it.

### 3.1 Data model

```ts
interface OrigamiModel {
  id: string;                  // "crane"
  title: string;               // i18n key or plain text
  difficulty: 1 | 2 | 3 | 4 | 5;
  category: 'animal' | 'object' | 'modular' | 'toy' | 'flower';
  minutes: number;
  sheets: Sheet[];             // one for most models, two for the ninja star
  steps: Step[];
}

interface Sheet {
  id: string;
  size: [number, number];      // 1 × 1 square, or 1 × 2 for a ninja star half
  frontColor: string;
  backColor: string;           // usually white
}

interface Step {
  title: string;               // "Fold in half diagonally"
  text?: string;               // optional longer tip
  frame: FoldFrame;            // full paper state AFTER this step (FOLD frame)
  annotations: Annotation[];   // arrows and crease lines shown DURING this step
  camera?: CameraPreset;       // suggested view for this step
  kind?: 'fold' | 'unfold' | 'turn-over' | 'rotate' | 'squash' | 'reverse' | 'petal' | 'sink' | 'assemble';
}
```

`FoldFrame` follows FOLD: `vertices_coords`, `faces_vertices`, `edges_assignment` (M / V / F / B), and `faceOrders` for layering. Topology can change between steps, since each fold splits faces. Each frame therefore stores its own mesh plus a `parentFace` map back to the previous frame so it can be animated.

### 3.2 Animating a step: rigid faces, not vertex blending

Blending vertex positions linearly between two frames makes the paper shrink and warp mid-fold. Instead:

1. Map every face in the new frame to the face it came from in the previous frame.
2. Find each face's rigid transform (rotation + translation) from its start pose to its end pose.
3. Each frame of the animation slerps the rotation and lerps the translation, with easing.

Faces never stretch, and this one method works for every fold type, including squash, reverse, petal and sink. Paper can briefly pass through itself during compound folds. That is acceptable for teaching, and Origami Simulator has the same limitation.

### 3.3 Rendering

- **Two-sided paper:** one mesh with a shader that picks `frontColor` or `backColor` using `gl_FrontFacing`. Add a subtle paper texture and a soft lighting falloff.
- **Stacked layers:** layers in a flat fold sit in the same plane. Offset each one by a tiny `ε × layerIndex` along the normal, using `faceOrders`, so they don't z-fight.
- **Crease lines:** existing creases are drawn as thin lines on both sides. Valley creases are dashed and mountain creases are dot-dashed, following standard origami diagram notation (Yoshizawa–Randlett).
- **Annotations:** valley and mountain fold arrows, a "turn over" icon, a "push in" arrow for reverse folds, and a translucent ghost of the end state (can be turned off).
- **Background:** `--canvas-bg` from the theme, a soft contact shadow, and no grid in learn mode.

### 3.4 Where the content comes from (biggest risk)

Writing a 20-step crane as raw coordinates by hand is not realistic. **Build the fold engine and a dev-only Studio early (milestone 3) and use it to author the built-in models.** The advanced mode in §5 is that same tool, opened up to approved users. This means the hardest engineering is done once, and it gets proven on real content before anyone outside the team sees it.

## 4. Pages

### 4.1 Gallery (`/`)

```
┌───────────────────────────────────────────────────────────────┐
│ ◇ Gami                          [Search…]   🌐 EN   [Sign in] │  top bar (52px)
├───────────────────────────────────────────────────────────────┤
│  Learn to fold                                                │
│  [All] [Easy] [Medium] [Hard]      [Animals] [Toys] [Modular] │  segmented + chips
│                                                               │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                  │
│  │  🐦    │ │  🐸    │ │  ✦     │ │  ⛵    │                  │  cards: thumbnail,
│  │ Crane  │ │ Frog   │ │ Ninja  │ │ Boat   │                  │  name, difficulty dots,
│  │ ●●●○○  │ │ ●●○○○  │ │ ●●○○○  │ │ ●○○○○  │                  │  steps · minutes
│  │18 steps│ │12 steps│ │14 steps│ │ 8 steps│                  │
│  └────────┘ └────────┘ └────────┘ └────────┘                  │
└───────────────────────────────────────────────────────────────┘
```

- Responsive grid: one column at phone width, up to four on desktop.
- **Thumbnails** are rendered at build time from each model's final frame (a Playwright script, like BackSubtract's golden-image script), so the gallery loads no WebGL at all. On hover or focus a card can play a short looping preview video or WebP.
- "Continue" badge on models the user has started (from local storage).
- Starter set, from easiest to hardest: **paper plane, boat, cup, heart, fortune teller, jumping frog, ninja star (2 sheets), tulip, fox, crane, lily**.
- Signed-in creators also see a **"My models"** tab and a **"New model"** button that leads to the Studio.

### 4.2 Viewer (`/learn/:modelId?step=4`)

```
┌───────────────────────────────────────────────────────────────┐
│ ← Crane                     Step 4 of 18            ⚙   🌐    │  top bar
├───────────────────────────────────────────────────────────────┤
│                                                   ┌───┐       │
│                                                   │cube│      │  view gizmo (click a face
│                     ╱╲                            └───┘       │  to snap to that view)
│                    ╱  ╲   ↶ valley-fold arrow                 │
│                   ╱────╲                                      │
│                                                               │  3D stage
│ ┌────────────────────────────┐                                │
│ │ 4 · Squash fold            │                                │  step card (collapses
│ │ Lift the flap, open it and │                                │  into a bottom sheet
│ │ flatten into a square.     │                                │  on phones)
│ └────────────────────────────┘                                │
├───────────────────────────────────────────────────────────────┤
│ ⏮  ◀  ▶︎/❚❚  ▶  ⏭   ──●──┼──┼──┼──┼──   [Free|Top|Front|Side] 🔒 ↺ │  bottom bar
└───────────────────────────────────────────────────────────────┘
```

**Step controls**
- First, previous, play/pause, next, last.
- A scrubber with one tick per step. Dragging it moves smoothly through the fold, so a user can pause halfway through a fold.
- Playback speed (0.5×, 1×, 2×) and a "repeat this step" toggle, both under ⚙.
- Keys: `←` `→` change step, `Space` plays/pauses, `R` repeats the step, `1`–`4` pick a view, `0` resets the camera.
- `?step=N` is kept in the URL so a link to a step can be shared.

**Camera**
- **Free:** orbit (drag), zoom (wheel or pinch), pan (right-drag or two-finger drag). Uses drei `CameraControls` for damped, animated moves.
- **View lock** (segmented control): **Top, Front, Side**, plus an **Auto** option that follows each step's suggested `camera`. Picking a view animates the camera there.
- **🔒 Lock (`L`):** keeps the chosen view. Rotation is turned off, a one-finger or left-button drag pans instead, and zoom still works. This is the "lock to top" behaviour. A small badge says "View locked · drag to pan".
- **Turn-over steps** rotate the model, not the camera, so Top always means "looking down at the table".
- **↺ Reset** fits the model to the screen.

**Other**
- On the final step: confetti-free "Done!" card with "Fold another" and "Start over".
- Reduced motion: when `prefers-reduced-motion` is set, steps cut straight to the end state unless the user presses play.
- Accessibility: the step text sits in an `aria-live` region, and every control has a label and a keyboard shortcut.

## 5. Advanced mode: Studio (`/studio/:draftId?`)

The Studio is the viewer plus editing tools. It reuses the same stage, camera controls and step bar, and adds a tool row and a step list.

### 5.1 Who can use it

| Role | Can do |
|---|---|
| **Guest** (not signed in) | Gallery and viewer |
| **Learner** (signed in) | Same, plus progress synced across devices (optional) |
| **Creator** | Studio: create, save and share drafts by link, submit to the gallery |
| **Admin** | Approve submissions, grant the creator role |

- The role is stored in a Supabase `profiles` table. **Row-level security does the real gating:** only creators can insert into `models`, and only admins can set `status = 'published'`.
- The Studio code is a separate lazy-loaded chunk, and the `/studio` route checks the role. These are UX conveniences, not security. The data rules on the server are what protect the data.
- Creators must sign in, and an admin grants the creator role (§10).

### 5.2 Editing tools (bottom bar, like BackSubtract's tool row)

| Tool | What it does |
|---|---|
| **Fold** | Pick a fold line, valley or mountain, and which side moves. Then choose **all layers** or **top layer only**. |
| **Fold line helpers** | Snap to points and edges. Line through 2 points, point onto point (perpendicular bisector), edge onto edge (angle bisector). These cover the most-used Huzita–Justin axioms. |
| **Unfold** | Reverses a fold but keeps its crease. Used for "pre-crease" steps. |
| **Turn over / Rotate** | Flips or rotates the whole model on the table. |
| **Compound folds** | Presets for inside/outside reverse, squash, petal and rabbit-ear folds. Each one is built from simple folds and recorded as a single step. |
| **Pose** (fallback) | Moves a face group by hand with a rotate gizmo, for 3D finishing steps like "open the wings" or "inflate". |
| **Annotate** | Changes the suggested camera for the step, its title and text, and adjusts the auto-generated arrows. |

The step list is a side panel on desktop and a sheet on phones. Steps can be reordered, duplicated or deleted, and there is undo/redo. Clicking a step previews it in the viewer.

### 5.3 Fold engine scope (in order of difficulty)

1. **Flat fold through all layers:** split every face crossed by the line, reflect the moving side, reverse its layer order and stack it on top. Fully deterministic.
2. **Top layer / selected flaps only:** fold only a chosen subset of faces. Check that it is valid: no tearing, and the moving faces stay connected only along the fold line.
3. **Compound flat folds** (reverse, squash, petal), built from 1 and 2.
4. **3D finishing poses:** free rigid rotations around existing creases, with no flat-foldability check.

Layer order is the hardest part. Version 1 keeps a full stacking order per stack of overlapping faces and updates it per fold rule. A full flat-foldability solver is out of scope.

### 5.4 Saving and sharing

- Drafts auto-save to IndexedDB, and to Supabase when signed in.
- Import and export `.fold` files (the Gami extension lives under `gami:` keys, so other FOLD tools ignore it).
- Every draft can be shared by an unlisted link that opens it read-only in the viewer.
- "Submit to gallery" sends the model to admin review. Published models then appear in the gallery next to the built-in ones.

## 6. Styling (taken from BackSubtract)

- **Design tokens:** reuse BackSubtract's `:root` set unchanged: `--bg`, `--fg`, `--muted`, `--line`, `--surface`, `--surface-hover`, `--accent` (#4f46e5 light / #8b85ff dark), `--accent-soft`, `--canvas-bg` and `--radius: 12px`, with the same `prefers-color-scheme: dark` overrides.
- **Font:** `15px/1.45 system-ui, …` with antialiasing, as in BackSubtract.
- **Layout:** `.app` is a 100dvh flex column containing a **52px `.topbar`**, a flex-1 **`.stage`** with `var(--canvas-bg)`, and a **`.bottombar`** with safe-area padding.
- **Controls:** reuse `.tool` (icon above label, `aria-pressed` gives the `--accent-soft` highlight), `.segmented` (the view lock picker), `.primary` and `.icon` buttons, and the toast and modal patterns.
- **New for Gami:**
  - `.card` for the gallery: `--surface` background, `--radius`, and a slight lift on hover.
  - Difficulty dots in `--accent`.
  - A floating step card over the stage, using the `.badge` and toast style with a translucent background.
- **Default paper colour:** `--accent`, with a white back, so the model matches the UI. Each model can override it.
- Also from BackSubtract: an SVG favicon, a PWA manifest and react-i18next, with English first and other languages later.

## 7. Project structure

```
src/
  app/            App.tsx, TopBar, BottomBar, Toast, Modal, icons, app.css (ported from BackSubtract)
  routes/         Gallery.tsx, Learn.tsx, Studio.tsx (lazy)
  gallery/        ModelCard, Filters, catalog.ts
  viewer/         Stage.tsx (R3F Canvas), PaperMesh, Creases, Annotations, Ghost,
                  CameraRig (presets, lock, auto), StepBar, StepCard
  fold/           geometry.ts, fold.ts (split + reflect), layers.ts, frames.ts,
                  animate.ts (rigid face interpolation), fold-format.ts (FOLD I/O)
  studio/         tools/, StepList, FoldLinePicker, snapping.ts, persistence.ts
  auth/           supabase.ts, useRole.ts, RequireRole.tsx
  state/          store.ts (Zustand: step, t, playing, view, lock, speed)
  i18n/, locales/
public/models/    crane.fold.json, frog.fold.json, … (built-in content)
scripts/          render-thumbnails.mjs (Playwright), validate-models.mjs
supabase/         migrations (profiles, models, RLS policies)
```

## 8. Testing

- **Fold engine (Vitest):** these properties must hold after every fold:
  - Every edge keeps its length (the paper never stretches).
  - Total area is unchanged.
  - Flat steps really are flat.
  - No face is lost.
  - Folding and then unfolding gets back the starting state.
- **Model validation script:** runs in CI over every file in `public/models` and checks the same properties step by step.
- **Animation:** halfway through each step, faces have the same shape as at the start and end.
- **Playwright end-to-end:** gallery → model → step through → lock Top → reset. Golden screenshots of selected steps, in the same style as BackSubtract's `golden/`.
- **Role gating:** tests against a local Supabase check that a non-creator's insert fails at the database, not only in the UI.

## 9. Milestones

| # | Milestone | Outcome |
|---|---|---|
| 0 ✅ | **Scaffold** | Vite, React, TypeScript and the router, with BackSubtract's tokens, bars and buttons ported. Empty gallery and an empty stage. |
| 1 ✅ | **Stage + camera** | A flat square in the R3F stage with two-sided paper. Orbit, zoom and pan, the gizmo, Top/Front/Side presets, lock and reset. |
| 2 ✅ | **Playback** | The step format and rigid-face animation. The step bar, scrubber, keys and URL step. A hand-written 4-step "Folding basics" model (fold, unfold, turn over, fold) proves it works. |
| 3 ✅ | **Fold engine + dev Studio** | Flat folds through all layers or the top layer, fold line snapping, unfold, turn over. A dev-only Studio route that exports `.fold`. |
| 4a ✅ | **Content pipeline + gallery** | Models written as code recipes (`src/models/recipes`) and built by `npm run models` into `public/models/<id>.fold` plus an SVG thumbnail. Paper plane, cup, samurai helmet and fortune teller. Thumbnails, "coming soon" cards, and resuming where you left off. **First public release** (learning only). |
| 4b-1 ✅ | **Compound folds + crane** | A layer-order solver (crease directions, taco–taco, taco–tortilla, tortilla–tortilla, transitivity) and a collapse operation for squash, petal and reverse folds and collapsing into bases. The traditional crane (29 steps). |
| 4b-2 ✅ | **Jumping frog + multiple sheets** | The jumping frog (15 steps, from a 3 × 5 card). Models can have several sheets, each with its own colours and patch of sheet coordinates. |
| 5 ✅ | **Polish** | Fold guides (dashed valley / dotted mountain creases and an arrow along the paper's path), the camera framing each step, speed control, a "Done!" card, keyboard shortcuts dialog, screen-reader labels, PWA/offline with generated icons (`npm run icons`). Translations are moved to a later milestone. |
| 6 ✅ | **Accounts + roles** | Supabase schema (profiles, creator requests, models) with row-level security tested in PGlite; emailed sign-in links; account menu; asking to become a creator; an admin page to approve requests; `/studio` opens the editor for creators. See `docs/accounts.md`. |
| 7a ✅ | **Cloud Studio** | Creators save models to the cloud, reopen them from "My models", share a private link (`/s/<token>`), and submit for the gallery. Admins preview, publish or send back with a note. Published models appear under "From the community" in the gallery (`/m/<id>`). |
| 7b ✅ | **Studio folding tools** | Reverse folds (inside/outside), Collapse (add valley, mountain or open creases, then apply together, for squash, petal and sink folds or bases) and Lift (turn part of the paper up by an angle for 3D finishing), each limitable to the top layers. |
| 7c | **Ninja star** | Following [origami.me/ninja-star](https://origami.me/ninja-star/): moving or turning over a single sheet, and tucking a flap into another sheet's pocket. |

Milestones 0–4 deliver everything except advanced mode. Advanced mode then gets the dev Studio from milestone 3 almost for free.

## 10. Decisions log

- **Studio access needs a login.** Creators sign in through Supabase Auth, and an admin grants the creator role. No payments are planned for now.
- **Sharing:** creators can always share a draft by private (unlisted) link. Getting into the public gallery needs **admin approval** (`status`: `draft` → `submitted` → `published` / `rejected`).
- **Built-in models are code, not hand-made files** (decided in milestone 4a). Recipes describe folds the way a diagram does ("this corner onto that point") and the engine works out the geometry, so they can be regenerated whenever the engine improves. Tests check every step of every model is physically valid and that the generated files are current. Studio exports use the same `.fold` format.
- **Compound folds moved up from milestone 7 to 4b**, because the crane, frog and ninja star can't be made without them.
- **Compound folds are crease changes plus a solver** (milestone 4b). A collapse step lists which creases fold, open or reverse; positions follow by reflecting across creases from an anchor face, and stacking comes from a flat-folding layer solver. The square base and petal fold were found by searching crease assignments with the solver, and every step is checked by the model validator.
- **The crane ends with its wings up**, with "fold the wings down and spread them" in the last step's text. After narrowing, the narrowing flaps lie over the wings and are joined to the legs, so the engine can't fold the wings flat. Revisit when 3D finishing poses arrive.
- **The jumping frog has no separate back-leg folds.** The folded-up bottom serves as the back legs, which is common in simple versions; the leg folds tried either turned inward or would tear.
- **The ninja star follows [origami.me/ninja-star](https://origami.me/ninja-star/)**, chosen as the reference because written instructions elsewhere disagree on the folds.
- **Translations are deferred** (milestone 5). Most of the text is model instructions, which would each need translating; better done once the content settles.
- **The camera frames each step automatically**, keeping whatever angle you're looking from; only the distance and centre change.
- **Security rules are tested without Docker** (milestone 6). The migrations run in PGlite (Postgres in-process) with a small stand-in for Supabase's `auth` schema and roles, and the tests act as guest, learner, creator and admin.
- **Sign-in is by emailed link**, with no passwords to store or reset. The first admin is made by hand in SQL; after that, admins approve creators at `/admin`.
- **Accounts are optional per deployment.** Without Supabase settings the site hides sign-in and the Studio; the Supabase library is only downloaded when they're set.
- **Paper may pass through itself in v1** during complex 3D steps. Collision-free animation is a later goal, not a launch blocker.
- **Dev Studio** lives at `/studio/dev` in development builds only (left out of production). It folds through all layers or the top 1–3, snaps fold lines to corners and edge midpoints (point-to-point and through-2-points), and can unfold, turn over, rotate and undo. The edge-to-edge (angle bisector) helper is deferred until a model needs it.

## 11. Open questions

1. **Target devices:** is a mid-range phone a must for the viewer? That affects shader and texture budgets.
2. **Name and brand:** is "Gami" final? It drives the favicon, colours and domain.
