#!/usr/bin/env python3
"""High-resolution copies of the game's animal art, for the promo video only.

The game keeps each animal at 220px wide (and halves that again when it
loads), which is right for a 44px square and blurry on a 1080px video.
Every one of these came from a bigger painting in concepts/. This puts
that painting back into the exact frame of the game file -- same margins,
same aspect -- at up to 3x, so paintAnimal() and its rig numbers draw it
unchanged. Checked by shrinking the result back and comparing it with the
game file (mean difference printed; 0 is identical).

    python concepts/promo-video-v1/make-hires.py
"""
import os
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
OUT = os.path.join(os.path.dirname(__file__), 'hires')
SOURCES = {   # game file -> the painting it was cut from
    'wolf-calm': 'concepts/animal-art-v1/wolf.png',
    'wolf-howl': 'concepts/animal-life-v1/wolf-howl-source.png',
    'bear-calm': 'concepts/animal-art-v1/bear-brave-parent-cub-v2.png',
    'buffalo-calm': 'concepts/animal-art-v1/buffalo-makeup-v1.png',
    'deer-calm': 'concepts/imported-from-chatgpt/animal-illustrations/deer-timid-20260923.png',
    'zebra-calm': 'concepts/imported-from-chatgpt/zebra-yellow-scarf-single.png',
    'lion-calm': 'concepts/animal-art-v1/lion-crown-yawn-cutout.png',
    'tiger-calm': 'concepts/animal-art-v1/hungry-faces/tiger-calm-padded.png',
    'elephant-calm': 'concepts/animal-art-v1/elephant-ultra-muscle.png',
}
VISIBLE = 8   # same dust threshold as make-game-asset.py


def visible_box(im):
    return im.split()[3].point(lambda v: 255 if v >= VISIBLE else 0).getbbox()


def premul(im):
    x = np.asarray(im).astype(float) / 255
    return x[..., :3] * x[..., 3:], x[..., 3]


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, src in SOURCES.items():
        game = Image.open(os.path.join(ROOT, 'img', name + '.png')).convert('RGBA')
        paint = Image.open(os.path.join(ROOT, src)).convert('RGBA')
        gb, pb = visible_box(game), visible_box(paint)
        art = paint.crop(pb)
        # never enlarge the painting itself
        k = min(3, art.width / (gb[2] - gb[0]))
        k = max(1, int(k))
        out = Image.new('RGBA', (game.width * k, game.height * k), (0, 0, 0, 0))
        art = art.resize(((gb[2] - gb[0]) * k, (gb[3] - gb[1]) * k), Image.LANCZOS)
        out.alpha_composite(art, (gb[0] * k, gb[1] * k))
        back = out.resize(game.size, Image.LANCZOS)
        (r1, a1), (r2, a2) = premul(back), premul(game)
        diff = np.abs(r1 - r2).mean() + np.abs(a1 - a2).mean()
        out.save(os.path.join(OUT, name + '.png'), optimize=True)
        print('%-14s x%d  %dx%d  diff %.4f' % (name, k, out.width, out.height, diff))


if __name__ == '__main__':
    main()
