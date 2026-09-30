#!/usr/bin/env python3
"""Drain the colour out of the hungry zebra's scarf.

The SHAPE of the hungry zebra came back from an image edit: the knot lets
go and the two ends hang dead to the knee. The COLOUR is done here
instead, and on purpose.

Asking the image model for shape and colour in one pass is what failed
the first time round -- it reported it could not hold the body still
while doing both. Split in two, each half is easy: the model only has to
move cloth, and the colour becomes a pixel operation that can be dialled
in against a 44px render and re-run, rather than re-rolled and re-checked
for drift.

Selecting the scarf needs no mask file. It is the only saturated yellow
anywhere on this painting -- the body is cream, the mane and hooves are
brown, and both sit outside this hue window or well under its saturation
floor. Printed count and a saved mask are the check that that is still
true if the art is ever redrawn.

Four strengths were rendered on a tile side by side before one shipped:

    soft  S 0.60  V 0.84   still legibly gold; reads as "a bit faded"
    mid   S 0.38  V 0.72   SHIPPED -- reads as drained cloth
    hard  S 0.22  V 0.62   the band all but merges into the body

`mid` is the one that shipped. At 44px what the player actually reads is
the bright gold going out, which is the cleanest signal available at a
size where the animal's head is three pixels across.

Usage:  python fade-zebra-scarf.py            (writes zebra-hungry-final.png)
        python fade-zebra-scarf.py --mask     (also writes the selection mask)
"""
import os
import sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'zebra-yellow-scarf-long-limp.png')
DST = os.path.join(HERE, 'zebra-hungry-final.png')

# the shipped strength -- see the table above
S_MUL, V_MUL, HUE_SHIFT = 0.38, 0.72, 6

# the scarf, and only the scarf
HUE_LO, HUE_HI, SAT_MIN, VAL_MIN = 22, 45, 110, 90

VISIBLE = 8  # same dust floor as make-game-asset.py


def main(src=SRC, dst=DST, write_mask=False):
    img = Image.open(src).convert('RGBA')
    w, h = img.size
    alpha = img.split()[3]
    hsv = img.convert('RGB').convert('HSV')
    hl = hsv.load()
    al = alpha.load()
    mask = Image.new('L', (w, h), 0) if write_mask else None
    ml = mask.load() if mask else None

    n = 0
    for y in range(h):
        for x in range(w):
            if al[x, y] < VISIBLE:
                continue
            hue, sat, val = hl[x, y]
            if HUE_LO <= hue <= HUE_HI and sat >= SAT_MIN and val >= VAL_MIN:
                hl[x, y] = (min(255, hue + HUE_SHIFT), int(sat * S_MUL), int(val * V_MUL))
                if ml:
                    ml[x, y] = 255
                n += 1

    out = hsv.convert('RGB')
    out.putalpha(alpha)
    out.save(dst)
    print('faded %d scarf px -> %s  %dx%d' % (n, dst, w, h))
    if mask:
        p = os.path.join(HERE, 'zebra-scarf-mask.png')
        mask.save(p)
        print('mask -> %s  (should be the two hanging panels and nothing else)' % p)


if __name__ == '__main__':
    main(write_mask='--mask' in sys.argv)
