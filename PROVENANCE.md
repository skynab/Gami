# Where each model comes from

A record of every gallery model's design: who designed it, what Gami followed to make its steps, and whether
it's clear to use. Gallery models must be traditional, openly licensed, or Gami's own (see
`docs/bogota-2013-plan.md`), and this file is where that's checked and kept.

**When you add a model, add its row here before writing the recipe.** A test (`src/gallery/catalog.test.ts`)
fails if a gallery model with steps has no row.

## How Gami's steps are made

Every model is a recipe in `src/models/recipes`: folds described the way a diagram does ("this corner onto
that point"), with the geometry, pictures and animation worked out by the fold engine. No diagram, photo or
video is copied, and step text is written in Gami's own words. Where a recipe follows a published tutorial,
it follows the *sequence of folds*; the wording was spot-checked against the source (heart and fox, October
2026) and doesn't reuse it.

That covers the instructions themselves. Whether a design (the folding sequence and finished form) can be
protected separately is unsettled, so the rule is to stick to designs nobody owns, or whose owner has let
them be shared.

## Status

- **Clear**: traditional (no known designer), a mathematical method, or Gami's own.
- **Unattributed**: no designer found after checking; widely published with no credit. Fine to use, but
  credit and change it if a designer turns up.
- **Kept by decision**: a designer holds the rights and hasn't opened them; kept anyway (see the note).

## Models

Checked 21 October 2026. "Reference" is what the recipe followed; *none recorded* means no source was
noted when it was written, and the model was folded from the common traditional sequence.

| Model | Designer | Licence | Reference | Status | Added |
|---|---|---|---|---|---|
| `basics` | Not a design: fold, unfold, turn over | None needed: nobody owns it | none | Clear | 16 Oct 2026 |
| `paper-plane` | Traditional (the classic dart) | None needed: nobody owns it | none recorded | Clear | 16 Oct 2026 |
| `glider` | Unattributed: the common flat-nosed glider | Unknown: no designer found | none recorded | Unattributed | 18 Oct 2026 |
| `bulldog-dart` | Unattributed: the dart with its point folded back | Unknown: no designer found | none recorded | Unattributed | 18 Oct 2026 |
| `dog-face` | Traditional | None needed: nobody owns it | none recorded | Clear | 18 Oct 2026 |
| `cat-face` | Traditional | None needed: nobody owns it | none recorded | Clear | 18 Oct 2026 |
| `cup` | Traditional | None needed: nobody owns it | none recorded | Clear | 16 Oct 2026 |
| `samurai-helmet` | Traditional (kabuto) | None needed: nobody owns it | none recorded | Clear | 16 Oct 2026 |
| `fortune-teller` | Traditional | None needed: nobody owns it | none recorded | Clear | 16 Oct 2026 |
| `heart` | Unknown: origami.me lists the designer as "Unknown", folded for years without a known source | Unknown: no designer found | [origami.me/heart](https://origami.me/heart/) | Unattributed | 16 Oct 2026 |
| `cicada` | Traditional (Japanese semi) | None needed: nobody owns it | none recorded | Clear | 18 Oct 2026 |
| `jumping-frog` | Traditional (origami.me: "Traditional"; often linked to Lillian Oppenheimer and Shari Lewis, origin unclear) | None needed: nobody owns it | [origami.me/jumping-frog](https://origami.me/jumping-frog/) | Clear | 16 Oct 2026 |
| `ninja-star` | Traditional (origami.me: "Traditional") | None needed: nobody owns it | [origami.me/ninja-star](https://origami.me/ninja-star/) | Clear | 16 Oct 2026 |
| `tulip` | Traditional (the flat two-square tulip) | None needed: nobody owns it | none recorded | Clear | 17 Oct 2026 |
| `fox` | **Mitsuo Okuda** (origami.me: "a simple variation of the model designed by Mitsuo Okuda") | All rights reserved (Mitsuo Okuda) | [origami.me/fox](https://origami.me/fox/) | Kept by decision | 16 Oct 2026 |
| `crane` | Traditional | None needed: nobody owns it | none recorded | Clear | 16 Oct 2026 |
| `swan` | Traditional | None needed: nobody owns it | none recorded | Clear | 18 Oct 2026 |
| `lily` | Traditional (origami.me: "Traditional") | None needed: nobody owns it | [origami.me/lily](https://origami.me/lily/) | Clear | 17 Oct 2026 |
| `sword` | **Gami**, licensed CC BY 4.0 (`DESIGNS-LICENSE.md`) | CC BY 4.0 (Gami) | none: designed for Gami | Clear | 18 Oct 2026 |
| `folding-geometry` | Mathematics: the Huzita–Hatori axioms and Hisashi Abe's angle trisection, after Robert Geretschläger's *Geometric Origami* | None needed: nobody owns it | the book, for the ideas only | Clear | 18 Oct 2026 |
| `boat` | Traditional (origami.me: "Traditional") | None needed: nobody owns it | [origami.me/traditional-boat](https://origami.me/traditional-boat/) | Clear | Coming soon |
| `waterbomb` | Traditional (origami.me: "Traditional") | None needed: nobody owns it | [origami.me/waterbomb](https://origami.me/waterbomb/) | Clear | 21 Oct 2026 |
| `balloon-rabbit` | Traditional (origami.me: "Traditional") | None needed: nobody owns it | [origami.me/balloon-rabbit](https://origami.me/balloon-rabbit/) | Clear | 21 Oct 2026 |
| `flapping-bird` | Traditional (origami.me: "Traditional") | None needed: nobody owns it | [origami.me/bird](https://origami.me/bird/) | Clear | 21 Oct 2026 |
| `frog` | Traditional (origami.me: "Traditional") | None needed: nobody owns it | [origami.me/traditional-frog](https://origami.me/traditional-frog/) | Clear | Coming soon, listed 21 Oct 2026 |
| `penguin` | Traditional (origami.me: "Traditional") | None needed: nobody owns it | [origami.me/penguin](https://origami.me/penguin/) | Clear | 21 Oct 2026 |
| `whale` | Traditional (origami.me: "Traditional") | None needed: nobody owns it | [origami.me/whale](https://origami.me/whale/) | Clear | 21 Oct 2026 |
| `fish` | Traditional (origami.me: "Traditional") | None needed: nobody owns it | [origami.me/fish](https://origami.me/fish/) | Clear | Coming soon, listed 21 Oct 2026 |
| `dolphin` | Traditional (origami.me: "Traditional") | None needed: nobody owns it | [origami.me/dolphin](https://origami.me/dolphin/) | Clear | Coming soon, listed 21 Oct 2026 |
| `crow` | Traditional (origami.me: "Traditional") | None needed: nobody owns it | [origami.me/crow](https://origami.me/crow/) | Clear | 21 Oct 2026 |
| `butterfly` | Traditional (origami.me: "Traditional") | None needed: nobody owns it | [origami.me/butterfly](https://origami.me/butterfly/) | Clear | Coming soon, listed 21 Oct 2026 |
| `pajarita` | Traditional (origami.me: "Traditional") | None needed: nobody owns it | [origami.me/pajarita](https://origami.me/pajarita/) | Clear | Coming soon, listed 21 Oct 2026 |
| `iris` | Traditional (origami.me: "Traditional") | None needed: nobody owns it | [origami.me/iris](https://origami.me/iris/) | Clear | Coming soon, listed 21 Oct 2026 |
| `pinwheel` | Traditional (origami.me: "Traditional") | None needed: nobody owns it | [origami.me/pinwheel](https://origami.me/pinwheel/) | Clear | Coming soon, listed 21 Oct 2026 |
| `fan` | Traditional (origami.me: "Traditional") | None needed: nobody owns it | [origami.me/fan](https://origami.me/fan/) | Clear | Coming soon, listed 21 Oct 2026 |
| `masu-box` | Traditional (origami.me: "Traditional") | None needed: nobody owns it | [origami.me/box](https://origami.me/box/) | Clear | Coming soon, listed 21 Oct 2026 |
| `christmas-tree` | Traditional (origami.me: "Traditional") | None needed: nobody owns it | [origami.me/christmas-tree](https://origami.me/christmas-tree/) | Clear | 21 Oct 2026 |

### Notes

- **Fox.** Okuda's design isn't openly licensed. It was kept on 18 October 2026 because it's very widely
  folded and taught (see the decisions log in `PLAN.md`). The gallery doesn't credit him yet. If the rule
  is tightened, the choices are: ask for permission, swap in a traditional fox, or design Gami's own.
- **Origami.me's [licensing page](https://origami.me/licensing/)** (checked 21 October 2026) says models it
  credits as *Traditional design* are classics where "nobody owns the design", so the jumping frog, ninja star
  and lily are free to fold and teach. The same page keeps its own diagrams, photos and videos under
  copyright even for traditional models (reposting, translating or paid use needs permission), and says
  nothing about Creative Commons or the public domain. So Gami follows only the fold sequence and copies
  nothing. Designs with a named designer belong to that designer: origami.me's permission to publish the
  fox doesn't pass on to Gami. "Designer unknown" models (the heart) get credited if a designer comes
  forward.
- **Folding geometry.** Mathematical facts and methods aren't anyone's to own; the lesson's text is Gami's.
- **Coming soon.** The boat and the models listed on 21 October 2026 are gallery placeholders with no recipe
  yet. Each is credited "Traditional" on origami.me. When one gets a recipe, set its reference to what was
  actually followed and its date to when it shipped. Other traditional models on origami.me that aren't
  listed yet are in `docs/origami-me-candidates.md`.

## Adding a model

1. Check the designer in [Gilad's origami database](https://www.giladorigami.com/origami-database) and in
   the tutorial you plan to follow. A free diagram is not an open licence.
2. Add a row: designer (or "Traditional" with where that's stated), the licence, the reference you follow, the status, the
   date.
3. Write the steps in your own words; don't copy text or pictures.
4. If it's Gami's own design, also list it in `DESIGNS-LICENSE.md`.
