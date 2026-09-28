#!/usr/bin/env python3
"""Turn a reviewed whole-body concept PNG into a game-ready sprite.

The rabbit and the fox were drawn as separate closed shapes, one file per
limb, because their rig poses them. Nothing else needs that: paintAnimal()
in script.js draws a still, and the walk is a CSS animation on the whole
tile. Parts only earn their keep when a kind has a second face to swap in
or a far limb to fade, and these concept paintings already have their far
limbs painted. So a concept animal ships as one image until a hungry face
actually exists for it; splitting earlier would only add seams.

Usage:  python make-game-asset.py wolf.png ../../img/wolf-whole.png
"""
import sys
from PIL import Image

TARGET_W = 220  # source art; script.js halves it down again at load time

# Alpha below this is dust, not art: every one of these paintings came
# back from its background removal with a scatter of 1-7 alpha pixels
# out in the margin, invisible on any screen and fatal to a plain
# getbbox(). The timid deer is the worst of them -- its dust reaches
# 300px further left than the animal does, so an honest crop kept a
# third of the canvas empty and the rig drew the deer at 70% of the
# width it had asked for. So the crop is measured on the pixels the eye
# can actually see, and the dust is wiped rather than shipped.
#
# wolf-whole, bear-whole and buffalo-whole were exported before this
# existed and their rigs were tuned against those crops. Re-exporting
# them would move art inside the frame and quietly invalidate three
# sets of measured numbers, so they stay as they are until someone is
# ready to re-measure them.
VISIBLE = 8


def main(src, dst, target_w=TARGET_W):
    im = Image.open(src).convert('RGBA')
    a = im.split()[3]
    solid = a.point(lambda v: 255 if v >= VISIBLE else 0)
    box = solid.getbbox()              # drop the margin AND the dust
    if box is None:
        raise SystemExit('%s has no visible pixels' % src)
    im.putalpha(a.point(lambda v: v if v >= VISIBLE else 0))
    im = im.crop(box)
    h = max(1, round(im.height * target_w / im.width))
    im = im.resize((target_w, h), Image.LANCZOS)
    im.save(dst, optimize=True)
    print('%s -> %s  %dx%d' % (src, dst, im.width, im.height))


if __name__ == '__main__':
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2])
