# Plan: new models, open designs only

The seven designs first picked from the [Bogotá Origami Convention 2013 book](https://www.giladorigami.com/origami-database-book/2291/Bogota-Origami-Convention-2013)
(Ali's dish, Rabbit baby, Den Den Mushi, Elephant, Sword, Iris star, Water dragon) are **set aside**: each is
by a living designer (Nick Robinson, Pere Olivella, Tong Liu, Dáša Ševerová, Brian Chan) and none is openly
licensed.

## The rule for now

New gallery models must be **open designs**:

- **traditional** models with no known designer (the crane, cup, samurai helmet, lily), or
- designs whose designer has released them under an **open licence** (such as CC BY or CC BY-SA), with the
  licence and credit recorded.

A diagram published free online is not the same as an open licence, so it doesn't qualify on its own.
Check each candidate's status (Gilad's database lists a designer where one is known) before writing a
recipe, and record it in `PROVENANCE.md`.

## Open stand-ins for the seven

Where a traditional model covers the same idea, it takes the slot. Each needs its traditional status
confirmed first.

| Instead of | Open candidate | Engine fit |
|---|---|---|
| Ali's dish | **Masu box** (traditional) | Good: flat creasing, then walls stand up and lock. The four walls rising together want a small `shape` addition, several bends at once meeting at the corners. |
| Rabbit baby | **Traditional rabbit** (waterbomb-base rabbit) | Good: the waterbomb base is already in the lily, so this is mostly flat folds plus a little 3D. |
| Elephant | **Traditional elephant** (the simple flat head or the body from a kite) | Good: reverse folds for the trunk, as in the swan. |
| Iris star | **A traditional eight-pointed star** (modular, 8 squares) | Fair: modular assembly works already (ninja star, tulip). An octagon sheet isn't needed. |
| Sword | **Gami's own 1 × 4 sword** (done, milestone 16): no traditional or openly licensed sword exists, so Gami designed one | Flat folds only. |
| Den Den Mushi | Nothing clearly traditional found yet | Keep looking; drop if none. |
| Water dragon | Nothing clearly traditional found yet | Keep looking; drop if none. |

## Order

1. **Check sources**: confirm each candidate is traditional or openly licensed, and pick the reference
   instructions to follow (written fresh in Gami's words, never copied).
2. **Traditional rabbit** and **traditional elephant**: quick wins with moves the engine already has.
3. **Masu box**: with the "walls rise together" shaping step.
4. **Eight-pointed star**: eight units and an assembly.
5. Revisit the snail and dragon if open designs turn up, or design Gami's own as with the sword.

Each model follows the usual routine: recipe in `src/models/recipes`, `npm run models`, `crossings` kept
low, steps translated in `src/i18n/steps`, card in `src/gallery/catalog.ts`, milestone in `PLAN.md`.

## Already in the gallery

Mitsuo Okuda's fox and the ninja star follow free online tutorials rather than open licences. They stay:
both are very widely folded and taught, so the rule applies to new models only.
