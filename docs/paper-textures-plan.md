# Patterned paper

A hidden choice in the menu behind the Gami name (on the gallery, `Brand` in `src/app/TopBar.tsx`): fold every model
on patterned paper instead of plain coloured paper. Like real patterned origami paper (chiyogami, washi), the pattern
is printed on one side and the other side stays plain white.

**Built (15 November 2026), as an experiment:** steps 1–4 below. The Gami menu has a *Paper* row (marked
experimental) of swatches: plain and the eight patterns. The choice is kept in this browser and prints the pattern on
each sheet's coloured side wherever the viewer folds a model (`src/viewer/patterns.ts` draws the tiles,
`pattern-texture.ts` makes them textures, `FoldedPaper.tsx` puts them on the side `printedSide` picks). The cards'
pictures stay plain (step 5), and the seam test (step 6) isn't written: canvas drawing doesn't run in the unit
tests, so the tiles were checked by eye, tiled 2×2 in three colours. The questions under "To decide" are still open.

## What's there to build on

- **The viewer's paper already has texture coordinates, and they're the sheet's own.** `FoldedPaper.tsx` sets each
  corner's `uv` to its point on the unfolded sheet, plus ½ (`uvs[...] = u + 0.5`), so a texture mapped on them is
  printed on the sheet and folds with it: a pattern runs on across a crease, and a flap folded over shows the pattern
  turned over, as real paper does. The paper's grain (`paperGrain`) already uses them, repeated twice across the sheet.
- **Each side has its own material.** The front and back are drawn as separate materials (`FrontSide` and
  `BackSide`, coloured `sheet.front` and `sheet.back`), so a pattern goes on one side without touching the other.
- **Each model chooses which of its sides is coloured.** Most start white side up (`front: '#f6f3ec'`) and colour
  the back; some the other way round. "The coloured side" is whichever of `front` and `back` isn't near-white.
- **Pictures on the cards are SVGs drawn without a browser** (`src/fold/thumbnail.ts`), with flat fills.

## The plan

1. **The setting.** `useSettings` (`src/state/settings.ts`) gets `paper: 'plain' | <pattern id>`, and the Gami menu
   gets a second entry under "Play the cards' folds": *Patterned paper*, opening a row of swatches (plain, then each
   pattern). It's kept in this browser like the other setting, and applies everywhere a model is folded: the
   viewer, the Studio's preview and the finished-model dialog.
2. **The patterns.** About eight, each a square tile that repeats without a seam, in the colours of the model's
   coloured side so each model keeps its look. A pattern is drawn in two colours (the model's colour and a lighter
   or darker shade of it, or gold), so one tile serves every model, recoloured. Traditional motifs, all free of
   anyone's rights (geometric, centuries old):
   - asanoha (hemp leaf: six-pointed stars of lines),
   - seigaiha (overlapping waves of arcs),
   - shippō (interlocking circles),
   - ichimatsu (checks),
   - kikkō (hexagons, tortoiseshell),
   - same komon (fine dots in arcs, like shark skin),
   - sakura (a scatter of five-petal blossoms),
   - plain washi (fibres and flecks, no motif).
3. **How the tiles are made: drawn in code, not stored as images.** Each motif is a small function drawing one tile
   onto a canvas (`src/viewer/patterns.ts`), at 512 px, in the two colours it's given. That keeps them sharp at any
   zoom, recolourable per model, a few kilobytes in all, and ours to licence (DESIGNS-LICENSE.md). Washi's fibres
   use a seeded random, so it's the same every time. A Node script can render each tile to a PNG for a look at all
   of them side by side while they're tuned (`scripts/patterns.ts`), but nothing generated is shipped.
4. **Into the viewer.** For the coloured side's material: `map` becomes the pattern tile (a `CanvasTexture`,
   `RepeatWrapping`, repeated so a tile is about a fifth of a 15 cm sheet), with the material's `color` set to white
   so the tile's own colours show; the grain is multiplied in by the shader the material already patches
   (`onBeforeCompile`), so it still looks like paper. The plain side keeps its colour and grain. Models of several
   sheets (modular ones) pattern each sheet in its own colour.
5. **What stays plain.** The cards' pictures and previews (generated SVGs, flat fills) at first. Then, if wanted, the
   same tile as an SVG `<pattern>` clipped to the sheet's coordinates, which the SVGs can do since each face knows
   its corners on the sheet. Marks (drawn eyes), tape and the paper's edges look as now.
6. **Checks.** A unit test that every pattern tiles without a seam (its left column matches its right, top its
   bottom), and an end-to-end screenshot of one model folded on patterned paper.

## To decide

- **Which side.** Always the coloured side, or should the menu offer "both sides" (some papers, duo washi, are
  printed on both)?
- **Per model or everywhere.** One setting for the whole site (as planned), or a pattern picked on each model's page?
- **The motifs, and how bold.** Small and subtle so the creases still read, or large and decorative? A first batch of
  tiles rendered side by side, on two or three models, would settle it.
- **Cards.** Plain pictures on the cards (simplest, and they load fastest), or patterned too (step 5)?
- **Hidden or not.** It's behind the Gami name for now, as asked. If people like it, it could move to the viewer's
  own controls.
