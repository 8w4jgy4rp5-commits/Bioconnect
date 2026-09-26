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


def main(src, dst, target_w=TARGET_W):
    im = Image.open(src).convert('RGBA')
    box = im.split()[3].getbbox()      # drop the transparent margin
    if box is None:
        raise SystemExit('%s is fully transparent' % src)
    im = im.crop(box)
    h = max(1, round(im.height * target_w / im.width))
    im = im.resize((target_w, h), Image.LANCZOS)
    im.save(dst, optimize=True)
    print('%s -> %s  %dx%d' % (src, dst, im.width, im.height))


if __name__ == '__main__':
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2])
