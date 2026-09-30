#!/usr/bin/env python3
"""Show where a calm painting and its hungry twin actually differ.

make-face-pair.py reports a drift number, and on the zebra that number
was 0.0px and meant NOTHING: both paintings ran to the edge of their
canvas, so the union frame equalled either one's own box and the
comparison had nothing left to measure. A pair can pass that check and
still have the body walk sideways underneath the change.

This is the check that does not lie. It lays the two silhouettes on top
of each other:

    grey   in both          -- the parts that did not move
    red    calm only        -- what the hungry painting dropped
    blue   hungry only      -- what the hungry painting added

Read it by looking at where the colour ISN'T. Red and blue confined to
the thing that was supposed to change, and solid grey through the legs,
the feet and the belly, is a pair that will swap cleanly. Colour down a
leg means the artist moved the animal and the rig will jump.

The per-edge table underneath says the same thing in numbers, and the
bottom edge is the one to read first: that is the feet, and a pair whose
feet agree is a pair standing in the same place.

  python check-pair.py wolf ../wolf.png ../wolf-starving.png
"""
import os
import sys
from PIL import Image, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
VISIBLE = 8  # same dust floor as make-game-asset.py


def silhouette(path):
    im = Image.open(path).convert('RGBA')
    return im, im.split()[3].point(lambda v: 255 if v >= VISIBLE else 0)


def main(name, calm_path, hungry_path):
    calm, ca = silhouette(calm_path)
    hung, ha = silhouette(hungry_path)
    if calm.size != hung.size:
        raise SystemExit('sizes differ: %s is %dx%d, %s is %dx%d -- a shared '
                         'frame across different canvases is meaningless'
                         % (calm_path, calm.width, calm.height,
                            hungry_path, hung.width, hung.height))
    w, h = ca.size
    cb, hb = ca.getbbox(), ha.getbbox()

    print('%s  %dx%d' % (name, w, h))
    print('            left   top  right bottom')
    print('  calm    %6d %5d %6d %6d' % cb)
    print('  hungry  %6d %5d %6d %6d' % hb)
    print('  delta   %6d %5d %6d %6d' % tuple(hb[i] - cb[i] for i in range(4)))
    foot = hb[3] - cb[3]
    print('  FEET: %+d px (%+.2f%% of the canvas) -- %s'
          % (foot, 100.0 * foot / h,
             'standing in the same place' if abs(foot) <= h * 0.005
             else 'THE FEET MOVED, the rig will jump'))

    ov = Image.new('RGB', (w, h), 'white')
    op, cp, hp = ov.load(), ca.load(), ha.load()
    both = only_c = only_h = 0
    for y in range(h):
        for x in range(w):
            c, g = cp[x, y] > 0, hp[x, y] > 0
            if c and g:
                op[x, y] = (150, 150, 150); both += 1
            elif c:
                op[x, y] = (220, 40, 40); only_c += 1
            elif g:
                op[x, y] = (40, 80, 220); only_h += 1
    out = os.path.join(HERE, '%s-overlay.png' % name)
    ov.save(out)
    total = both + only_c + only_h
    print('  shared %.1f%%   calm-only %.1f%%   hungry-only %.1f%%'
          % (100.0 * both / total, 100.0 * only_c / total, 100.0 * only_h / total))
    print('  overlay -> %s' % out)
    print('  Look at the legs and the feet. They must be grey.')


if __name__ == '__main__':
    if len(sys.argv) < 4:
        raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2], sys.argv[3])
