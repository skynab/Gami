# Plan: more 3D models

The gallery's new 2D and 3D chips (13 November 2026) show 40 models as 3D and 46 as flat. Many of the 3D ones are
planes, 3D only because their wings end opened out. This plan lists the flat models that could finish in 3D, best
value first. Each one is its own commit, and its catalog entry gains `form: '3d'` (the model check insists on it once
its last step stands up).

## What the engine can do

- **`shape`**: open flaps and turn paper about straight lines (the crane's wings, the plane's wings, the masu box's
  walls). Cheap, and it plays cleanly.
- **`bend`**: paper that curves and puffs up, guided face by face (the balloon, the 3D tulip, the cup, the fan, the
  boat's opening). Powerful, but each model needs its own guides worked out, and the solve takes seconds.
- **`popUp`**: a creased square popped about a point (the fortune teller, the pyramid, the diamond, the 3D
  strawberry). Since 13 November it can leave another sheet alone.
- **`assemble`**: pieces set down anywhere in 3D (the cube, the kusudama, the standing fox). Since 13 November it can
  also move pieces after a pop-up.

## Candidates

### 1. The ones whose last step already says to finish in 3D

Their text tells the folder to blow them up, open them or pull them, but the model stops flat.

| Model | Its last step says | How | Size |
|---|---|---|---|
| Balloon rabbit | "Blow gently into the hole … to puff up the rabbit, then open out the ears" | Blow the body up as the balloon is (`cubeGuides`, a cube, as its water bomb is the balloon's), then open the ears out with `shape`. The ears are extra paper sticking out of one end, which the guides must leave alone | Medium |
| Pirate hat | "Open the bottom and put it on" | Open it out at the bottom with a `bend`, as the boat's opening does: the newspaper hat is where the boat starts | Medium |
| Samurai helmet | "Open the bottom to wear it" | The same: open its bottom out into a helmet you can wear, with a `bend` | Medium |
| Flapping bird | "Pull the tail … the wings flap" | Spread its wings out with `shape`, as the crane's are, so it stands. An animated flap would be a bonus | Small |
| Water bomb | "Blow gently … puffs up into a ball" | It's the balloon without the blow-up, and the balloon is its blown-up self. Either end it blown up too (the same bend), or keep it flat and point to the balloon. **Decide** | Small |

### 2. Animals that could stand up, as the standing fox does

Folded flat from separate pieces, then put together in 3D with `assemble`. That is cheap and reliable.

| Model | How | Size |
|---|---|---|
| Bull | Already a body folded in half with snipped legs, like the standing fox's. Fold its belly strips inside rather than behind, open its sides a little to stand, and set its head facing forwards | Small–medium |
| Squirrel | Three pieces already: stand the body up, raise the tail behind it, turn the head to face forwards | Small |
| T-rex | Two pieces: stand the body on its legs by opening its kite halves a little, and set the head on top | Small |
| Cute cat | Two pieces: the body as a kite stood up as a cone or tent, the face upright on top | Small |

### 3. Smaller touches

| Model | How | Size |
|---|---|---|
| Swan, crow, penguin | Open the body a little underneath with `shape`, so each sits up on the table. The swan's body is a closed tube for rigid paper (its neck already grazes), so it goes last | Medium |
| Turtle | Dome the shell a little with `shape`, the flippers turned down to the table | Small |
| Crown | Curl it into a band with `shape`, as the bracelet is curled | Small |
| Sailboat | Stand it on its hull, its sail upright | Small |

### Staying flat

Faces, bookmarks, hearts, the envelope, the swords and knives, the ninja star, the pinwheel, the fish, the cicada,
the rose, the sunflower, the lizard, the cactus, the peacock and the lessons are flat by nature, or meant to lie flat.

## Order

1. Flapping bird, then squirrel, T-rex and cute cat: one `shape` or `assemble` step each, and they bring the
   animals into 3D.
2. Bull, as the standing fox's body.
3. Balloon rabbit, pirate hat and samurai helmet: bends, a day's work each, guided as the balloon and boat are.
4. The smaller touches, as wanted.

## Open questions

- **The water bomb**: blow it up too, or leave it flat beside the balloon?
- **Planes**: they count as 3D, as their wings end opened. Keep them in the 3D filter, or should "3D" mean models that
  stand up as objects? If the latter, the rule (and the model check) needs a sharper test than "not flat at the end".

## Progress

| Model | Status |
|---|---|
| Flapping bird | Done (13 November): a last step spreads the wings into a V, 50° either way, and stands the bird on its body (`assemble`, one piece bent and posed). The wings can only spread from above the highest of the neck's and tail's paper, which lies between them low down, joined to them along their edges; below that, rigid paper would tear. So the V opens partway up the wings, about two fifths of the way from the body to the tips. |
