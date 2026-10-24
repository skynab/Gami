---
name: record-model-licence
description: Check and record the designer and licence of an origami model in PROVENANCE.md. Use whenever a new gallery model is added (a new recipe in src/models/recipes, a new .fold file in public/models, or a new entry in src/gallery/catalog.ts), before writing its recipe, and when a model's source or credit changes.
---

# Record a model's licence

Every gallery model has a row in `PROVENANCE.md` saying who designed it, what licence it's under, what
Gami followed to make its steps, and whether it's clear to use. `src/gallery/catalog.test.ts` fails if a
model with steps has no row. Gallery models must be traditional, openly licensed, or Gami's own.

## Steps

1. **Find the designer.** Look the model up in Gilad's origami database
   (search results are at https://www.giladorigami.com/origami-database/<model name>, e.g. `/origami-database/fish`; the bare `/origami-database` page shows "404 Not Found", though its search box works) and on the tutorial you'll follow. Note exactly what each
   says ("Traditional", "Unknown", or a name).
2. **Find the licence.**
   - Traditional, no known designer: nobody owns the design. Licence: `None needed: nobody owns it`.
     (origami.me's licensing page says the same of models it credits as *Traditional design*.)
   - Mathematical method (axioms, trisections): `None needed: nobody owns it`.
   - Gami's own design: `CC BY 4.0 (Gami)`, and add it to the table in `DESIGNS-LICENSE.md`.
   - A named designer who released it under an open licence: name the licence and link where they say so
     (e.g. `CC BY-SA 4.0 (Jane Doe)`).
   - No designer found anywhere: `Unknown: no designer found`, status `Unattributed`.
   - A named designer with no open licence: **stop and ask the user.** A free online diagram is not an open
     licence. Offer a traditional stand-in or a Gami design instead.
3. **Add the row** to the Models table in `PROVENANCE.md`, in gallery order:
   `| \`<id>\` | <designer, with where that's stated> | <licence> | <reference link, or none recorded> | <Clear / Unattributed / Kept by decision> | <date added, e.g. 21 Oct 2026> |`
   Use the model's catalog id in backticks; the test matches on it.
4. **Note anything unusual** under "Notes" (a variation of a named design, sources that disagree, a user
   decision to keep something).
5. **Copy nothing.** Follow only the order of folds; write step text in Gami's own words; never reuse a
   tutorial's diagrams, photos or wording (origami.me keeps those under copyright even for traditional models).
6. Run `npx vitest run src/gallery/catalog.test.ts` to confirm the row is picked up.

Tell the user the designer and licence you recorded, and flag anything that isn't `Clear`.
