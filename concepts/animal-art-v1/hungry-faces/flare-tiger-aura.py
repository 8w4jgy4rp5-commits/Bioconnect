#!/usr/bin/env python3
"""Make the tiger's aura flare, without touching the tiger.

The tiger does not get a hungry FACE. Eight attempts at a fiercer tiger
were thrown away before this painting was accepted, and what carries it
is a quiet, cold half-lidded stare -- bare the teeth and it becomes a
different animal. hungry-faces/README.md settles the question: when this
one starves, the four gold spikes struck around its head burn harder and
reach further, and the face is left exactly as it is.

That makes it the one hungry pair on the board that needs no image
model at all. The aura is already in the painting; it only has to grow.
So this is a pixel operation, like fade-zebra-scarf.py: re-runnable,
dialled in against a 44px render, and guaranteed not to move the body,
because the body is never written to.

HOW IT GROWS. The gold is lifted out by hue (it is the only saturated
yellow in the painting -- the fur is orange at hue 20, the muzzle and
paws are white), its hollow centres are filled so a spike travels as a
solid needle rather than an outline, and that layer is scaled outward
about the centre of the aura and laid UNDERNEATH the original. Every
spike therefore keeps its own direction and its own shape and simply
reaches further out; the part that ends up behind the head is covered by
the head, and the part that ends up behind the original spike is covered
by the spike. Nothing is drawn on top of the animal.

NO HAZE. The wide soft glow these spikes were drawn inside did not
survive the original crop, and RIG says that was the outcome we wanted:
at 44px a haze is dirt on the screen while the spikes stay clean marks.
So this brightens and lengthens the spikes and adds no glow.

WHY THE SIDES ARE CLIPPED. The tiger is drawn at 134% of the tile's
width and is already cut by it -- the outer tips of the right-hand
spikes fall off the edge. Aura allowed to grow sideways would widen the
shared frame, which shrinks the whole painting inside the tile, which
costs body size to buy tips nobody can see. Growth is therefore clipped
to the calm painting's own left and right edges and allowed only
upward, into the 13% of empty tile above the tiger's back. The frame
gets taller, the frame does not get wider, so `w` is untouched and only
`oy` is re-solved. See the usage note at the bottom.

Usage:  python flare-tiger-aura.py              (writes the pair's two sources)
        python flare-tiger-aura.py --spread 1.4 (try another reach)
        python flare-tiger-aura.py --mask       (also writes the gold selection)
"""
import os
import sys
from collections import deque
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.normpath(os.path.join(HERE, '..'))
SRC = os.path.join(ART, 'tiger-face-aura-v4.png')
CALM_DST = os.path.join(HERE, 'tiger-calm-padded.png')
HUNGRY_DST = os.path.join(HERE, 'tiger-hungry-flare.png')

# How far the aura reaches when it starves, as a multiple of its
# distance from the centre of the aura. See the table in the comment at
# the bottom for what was rendered before this one shipped.
SPREAD = 1.50
VAL_MUL = 1.10   # the gold burns a little brighter too
STEP = 0.06      # how finely the copies are stacked on the way out

# The gold, and only the gold. The fur is orange (hue ~20 of 360) and
# well below this window; the muzzle, chest and paws are white and well
# below the saturation floor.
HUE_LO, HUE_HI, SAT_MIN, VAL_MIN = 33, 70, 0.30, 0.50

# Room added above the canvas so a lengthened spike has somewhere to go
# before the shared frame is cut. Nothing but air; it costs nothing.
PAD_TOP = 400

# The painter flicked a few gold specks onto the fur itself. They belong
# to the face, not to the aura, and scaled outward they land beside the
# animal as grit. Anything smaller than this many pixels is not a spike.
MIN_BLOB = 150

VISIBLE = 8  # same dust floor as make-game-asset.py


def gold_mask(img):
    """The aura as a solid shape: the gold outlines, plus what they enclose."""
    w, h = img.size
    hsv = img.convert('RGB').convert('HSV').load()
    alpha = img.split()[3].load()
    mask = Image.new('L', (w, h), 0)
    ml = mask.load()
    n = 0
    for y in range(h):
        for x in range(w):
            if alpha[x, y] < VISIBLE:
                continue
            hue, sat, val = hsv[x, y]
            hue = hue * 360.0 / 255.0
            if HUE_LO <= hue <= HUE_HI and sat >= SAT_MIN * 255 and val >= VAL_MIN * 255:
                ml[x, y] = 255
                n += 1

    # A spike is drawn as an outline around a pale core, and an outline
    # scaled on its own would travel as a hollow V. Everything the gold
    # encloses is filled in by flooding the OUTSIDE and keeping what the
    # flood could not reach.
    outside = Image.new('L', (w + 2, h + 2), 0)
    outside.paste(mask, (1, 1))
    outside = outside.point(lambda v: 0 if v else 255)   # 255 = not gold
    ImageDraw.floodfill(outside, (0, 0), 128)
    holes = outside.crop((1, 1, w + 1, h + 1)).point(lambda v: 255 if v == 255 else 0)
    filled = Image.new('L', (w, h), 0)
    filled.paste(255, (0, 0), mask)
    filled.paste(255, (0, 0), holes)
    return mask, drop_specks(filled), n


def drop_specks(mask, floor=MIN_BLOB):
    """Keep the spikes and the sparkles; throw away the flecks on the fur."""
    w, h = mask.size
    ml = mask.load()
    out = Image.new('L', (w, h), 0)
    ol = out.load()
    seen = bytearray(w * h)
    for sy in range(h):
        for sx in range(w):
            if not ml[sx, sy] or seen[sy * w + sx]:
                continue
            blob, q = [], deque([(sx, sy)])
            seen[sy * w + sx] = 1
            while q:
                x, y = q.popleft()
                blob.append((x, y))
                for nx, ny in ((x+1, y), (x-1, y), (x, y+1), (x, y-1)):
                    if 0 <= nx < w and 0 <= ny < h and ml[nx, ny] and not seen[ny * w + nx]:
                        seen[ny * w + nx] = 1
                        q.append((nx, ny))
            if len(blob) >= floor:
                for x, y in blob:
                    ol[x, y] = 255
    return out


def main(spread=SPREAD, write_mask=False):
    src = Image.open(SRC).convert('RGBA')
    w, h = src.size

    # the calm painting's own edges -- the box growth is not allowed past
    visible = src.split()[3].point(lambda v: 255 if v >= VISIBLE else 0).getbbox()
    left, _, right, bottom = visible
    right, bottom = right - 1, bottom - 1   # getbbox's right/bottom are exclusive

    raw, filled, n = gold_mask(src)
    box = filled.getbbox()
    if box is None:
        raise SystemExit('no gold found in %s -- has the painting changed?' % SRC)
    cx, cy = (box[0] + box[2]) / 2.0, (box[1] + box[3]) / 2.0

    # the aura on its own, brightened, on a canvas with room above it
    aura = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    aura.paste(src, (0, 0), filled)
    aura = brighten(aura)

    calm = Image.new('RGBA', (w, h + PAD_TOP), (0, 0, 0, 0))
    calm.paste(src, (0, PAD_TOP))

    # Scale the aura about its own centre, so every spike keeps its own
    # direction and only reaches further out. One scaled copy on its own
    # is not enough: past about 1.4 its inner end clears the original
    # spike's outer end and the aura breaks into a ring of marks hanging
    # off the tiger. So the copies are stacked in small steps instead,
    # which closes the gap and makes each spike one continuous needle.
    flare = Image.new('RGBA', (w, h + PAD_TOP), (0, 0, 0, 0))
    steps = max(1, int(round((spread - 1.0) / STEP)))
    for i in range(steps, 0, -1):
        f = 1.0 + (spread - 1.0) * i / steps
        big = aura.resize((round(w * f), round(h * f)), Image.LANCZOS)
        at = (round(cx - cx * f), round(cy - cy * f) + PAD_TOP)
        flare.paste(big, at, big)   # paste, not alpha_composite: the offsets go negative

    # sideways growth buys tips the tile cannot show, so clip it off
    keep = Image.new('L', (w, h + PAD_TOP), 0)
    ImageDraw.Draw(keep).rectangle([left, 0, right, bottom + PAD_TOP], fill=255)
    flare.putalpha(mul(flare.split()[3], keep))

    hungry = flare                      # the longer aura, underneath...
    hungry.alpha_composite(calm)        # ...and the untouched tiger on top

    calm.save(CALM_DST)
    hungry.save(HUNGRY_DST)
    print('gold px %d (filled %d)   aura centre %.0f,%.0f   spread %.2f'
          % (n, count(filled), cx, cy, spread))
    print('%s  %dx%d' % (CALM_DST, calm.width, calm.height))
    print('%s  %dx%d' % (HUNGRY_DST, hungry.width, hungry.height))
    cb = calm.split()[3].point(lambda v: 255 if v >= VISIBLE else 0).getbbox()
    hb = hungry.split()[3].point(lambda v: 255 if v >= VISIBLE else 0).getbbox()
    print('calm   visible box %s' % (cb,))
    print('hungry visible box %s   (taller by %dpx, same width and floor)'
          % (hb, cb[1] - hb[1]))
    if hb[0] != cb[0] or hb[2] != cb[2] or hb[3] != cb[3]:
        print('WARNING: the hungry box grew sideways or downward. The clip '
              'did not hold, and the shared frame will shrink the tiger.')
    if write_mask:
        p = os.path.join(HERE, 'tiger-aura-mask.png')
        filled.save(p)
        print('mask -> %s  (should be the spikes and sparkles, nothing else)' % p)
    print()
    print('Next: make-face-pair.py on these two, then re-solve RIG.tiger oy.')


def brighten(img):
    hsv = img.convert('RGB').convert('HSV')
    hl = hsv.load()
    alpha = img.split()[3]
    al = alpha.load()
    for y in range(img.height):
        for x in range(img.width):
            if al[x, y] < VISIBLE:
                continue
            hue, sat, val = hl[x, y]
            hl[x, y] = (hue, sat, min(255, int(val * VAL_MUL)))
    out = hsv.convert('RGB')
    out.putalpha(alpha)
    return out


def mul(a, b):
    """Per-pixel alpha multiply -- Pillow has no plain L*L here."""
    out = Image.new('L', a.size)
    al, bl, ol = a.load(), b.load(), out.load()
    for y in range(a.height):
        for x in range(a.width):
            ol[x, y] = al[x, y] * bl[x, y] // 255
    return out


def count(mask):
    return sum(mask.point(lambda v: 1 if v else 0).getdata())


if __name__ == '__main__':
    spread = SPREAD
    if '--spread' in sys.argv:
        spread = float(sys.argv[sys.argv.index('--spread') + 1])
    main(spread, write_mask='--mask' in sys.argv)

# SPREAD, rendered at a true 44px before one shipped (the sheet is kept
# as hungry-faces/tiger-spread-choice.png):
#
#   1.20   the gold thickens into a fringe around the head; read side by
#          side it is plain, read on its own it is still the same aura
#   1.30   the first spike clears the ears
#   1.50   SHIPPED -- gold horns stand clear above the tiger's back, and
#          the shape of the aura changes, not just its weight
#   1.70   bigger again, but the spikes fatten into wedges and start to
#          read as antlers the animal owns rather than an aura
