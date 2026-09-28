# Bioconnect animal art concepts v1

Generated on 2026-09-22 for review and future implementation.

## Contents

- `deer.png`
- `zebra.png`
- `buffalo.png`
- `wolf.png`
- `bear.png`
- `lion.png`
- `tiger.png`
- `elephant.png`
- `all-8-review.png`: labeled review sheet
- `all-8-at-44px.png`: recognition check at approximate in-game size
- `deer-size-check.png`: the deer sized beside the five animals already on the board
- `measure-rig.py`: reads the shipped rig out of `script.js` and reports, or draws,
  what it puts on a tile

## Art direction

- Match the existing rabbit and fox: thin dark reddish-brown outline, simple flat color, subtle pale shading, soft hand-painted edges, and a friendly understated expression.
- One complete animal in side profile, facing right with the tail on the left.
- Strong species-specific features that remain recognizable around 44 px.
- Transparent PNG with no scene, text, frame, floor, or cast shadow.

## Status

**In the game: wolf, bear, buffalo, deer.** Each exported with `make-game-asset.py` and
given a rig in `script.js`. Three of the four do not ship from the file you would guess:
the bear from `bear-brave-parent-cub-v2.png`, not the single brown `bear.png` in this
folder; the buffalo from `buffalo-makeup-v1.png`, not from the one whose name says game;
the deer from `../imported-from-chatgpt/animal-illustrations/deer-timid-20260923.png`,
the frightened redraw, not the calm `deer.png` here. The other four -- zebra, lion,
tiger, elephant -- are approved-review candidates only and still fall back to their
inline SVG silhouettes.

### The buffalo, and why the flat one won

Five files, and three of them are traps. `buffalo.png` lost its legs to whatever removed
its background -- the hooves are white ghosts. `buffalo-long-lashes-v3.png` was never cut
out at all; its background is still black. `buffalo-game-transparent-v4.png` is the one
with game in its name, and it is not the one that shipped: it is a fur-rendered painting
with no outline on it, and every other animal on this board has a dark outline. At 44px
the fur closes up and it reads as a brown lump, while the flat `buffalo-makeup-v1.png`
keeps its horns, its hump and its black hooves. A name is not a decision.

The framing is the bear problem again, worse: 220x122 is the widest art here (the wolf is
220x184). Fitted by width it stands 44% of the cell against the wolf 59.4%, which is too
small for the rung below a wolf. So `w` 50 against a span of 38, `ox` 2.5 to run the rump
and the tail tuft off the left edge, and `oy` 6.7 solved -- not nudged -- to put the
hooves on the wolf baseline. Measured in the browser at an 87px cell: 53.3% tall to the
wolf 59.4% and the bear 65.6%, all three on their proper rungs. `w` 54 was tried and
dropped; it cut the front legs off at the right edge.

### The deer, and the dust that nearly halved it

`make-game-asset.py` cropped this one wrong, and the reason was invisible. Every painting
here came back from its background removal with a scatter of alpha 1-7 pixels out in the
margin -- nothing any screen will ever show. A plain `getbbox()` sees them anyway, and on
the timid deer that dust reaches some 300px further left than the animal does. So the
crop kept a third of the file empty, the deer sat off-centre inside it, and the rig drew
it at 70% of the width it had asked for. The fix is in the export: crop on the pixels
above alpha 8, and wipe the rest rather than ship them. Re-exported, the deer went from
220x251 to 220x369 -- the only portrait art on the board.

`wolf-whole`, `bear-whole` and `buffalo-whole` still carry their old, loose crops. Their
rigs were tuned against those crops, so re-exporting them would move art inside the frame
and invalidate three sets of measured numbers. That is a separate job, on a day someone
is ready to re-measure all three.

Sizing it was the bear's problem inverted. A wide painting fitted by its width comes out
short; a tall one comes out narrow, and fitted to the tile like the wolf this deer would
have stood 45% of the tile with air on both sides. `w` 20 instead: 88.3% of the tile tall
and 52.6% wide, the tallest animal after the rabbit and by far the thinnest. It does not
read as the biggest animal, because height is not what mass looks like -- it reads as the
leggy one, which is the character the redraw was made for. `oy` 0.58 is solved rather
than nudged: it puts the hooves at 95.7%, the wolf and buffalo baseline, with the 1.1
units of `sag` still somewhere to go. `deer-size-check.png` is that, beside the five
animals already on the board.

### The bear, and what a wide painting costs

A mother and her cub is a wide picture, and a wide picture fitted to the tile by its
width comes out short: at 44px the pair stood 29px tall against the wolf's 35, and the
cub -- 15px, overlapping its mother's flank in the same near-black -- stopped reading
as a cub and became a lump on her side. Measured, in `bear-size-check.png`.

So the bear's rig does not fit the painting to the tile. It draws it wider than the
tile is (`w` 47 against a span of 38) and pushes it left (`ox` 5.2), so the mother's
rump falls off the edge and what stays inside the square is her head, her shoulder and
the cub against the pale blaze on her chest. `bear-crop-check.png` is the three framings
that were compared; `bear-rig-preview.png` is the numbers that shipped, replayed at 44
and 57px. Nothing is cut from the file -- the crop is only where the canvas ends, so the
framing is two numbers and can be moved again.

### Shipping one of these

Not by splitting it. The rabbit and the fox are cut into limbs because their art was
drawn that way, one closed shape per file; these are finished paintings, and a cut
through a painting leaves an edge with no outline on it. Nothing pays for that cost:
`paintAnimal` draws the rig once and holds it, the walk is a CSS animation on the whole
tile, and the far legs are already painted in. So:

1. `python make-game-asset.py <animal>.png ../../img/<animal>-whole.png`
2. add it to `SPRITE_FILES`, and a one-part rig to `RIG`
3. size it against the rabbit and the fox instead of guessing — `measure-rig.py` reads
   the painted bounding box as a share of the tile for every kind at once, so match
   their height and their baseline off that table rather than off a browser window.
   `--sheet` draws the same thing if it needs looking at

Split the head off only once a hungry face for that animal actually exists. With both
faces in hand the cut can follow the neck fur and the two silhouettes can be made to
agree; done earlier it is a seam bought for nothing.

The images were produced with the built-in ImageGen workflow. Buffalo and tiger required post-generation background cleanup to obtain transparent review assets.
