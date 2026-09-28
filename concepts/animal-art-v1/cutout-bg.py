#!/usr/bin/env python3
"""Lift a painting off a flat background and give it an alpha channel.

Most of the concept art arrived already cut out. The crown lion did not:
it came back as a JPEG on a sheet of cream paper, and a JPEG has no
alpha to crop against, so `make-game-asset.py` has nothing to measure.
This is the step before that one.

It does not threshold on colour, because the lion's own muzzle, teeth
and belly are nearly the same cream as the paper and a threshold would
punch holes through all three. It floods inward from the four edges
instead, so only paper that the frame can actually reach is removed --
then makes a second pass for the pockets of paper the animal encloses
but the frame cannot reach (the hole inside a curled tail, the gap
between two paws). Those are found as their own islands and cleared,
above a size floor so that JPEG speckle inside the art is left alone.

Edges are the reason for the two tolerances. Under TOL a pixel is paper.
Between TOL and SOFT, and touching paper, it is the anti-aliased rim
where the outline meets the page: it keeps its colour and gets partial
alpha, so the sprite does not ship a one-pixel cream halo that lights up
the moment it is drawn on grass.

Usage:  python cutout-bg.py lion-crown-yawn-gemini-v1.jpg lion-cutout.png
"""
import sys
from collections import deque
from PIL import Image

TOL = 26      # at or under this distance from the paper colour, it is paper
SOFT = 60     # between TOL and this, touching paper: an anti-aliased rim
POCKET = 200  # an enclosed island of paper smaller than this is speckle

NEIGHBOURS = ((1, 0), (-1, 0), (0, 1), (0, -1))
AROUND = NEIGHBOURS + ((1, 1), (-1, -1), (1, -1), (-1, 1))


def main(src, dst):
    im = Image.open(src).convert('RGB')
    w, h = im.size
    px = im.load()

    # the paper colour, read off the four corners rather than assumed
    corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    bg = tuple(sum(c[i] for c in corners) // 4 for i in range(3))

    def dist(c):
        return max(abs(c[0] - bg[0]), abs(c[1] - bg[1]), abs(c[2] - bg[2]))

    paper = bytearray(w * h)

    def flood(seeds):
        q = deque()
        for x, y in seeds:
            i = y * w + x
            if not paper[i] and dist(px[x, y]) <= TOL:
                paper[i] = 1
                q.append((x, y))
        while q:
            x, y = q.popleft()
            for dx, dy in NEIGHBOURS:
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h:
                    j = ny * w + nx
                    if not paper[j] and dist(px[nx, ny]) <= TOL:
                        paper[j] = 1
                        q.append((nx, ny))

    # from the frame inward
    flood([(x, y) for x in range(w) for y in (0, h - 1)] +
          [(x, y) for y in range(h) for x in (0, w - 1)])

    # then the pockets the frame could not reach
    seen = bytearray(paper)
    pockets = 0
    for sy in range(h):
        for sx in range(w):
            i = sy * w + sx
            if seen[i] or dist(px[sx, sy]) > TOL:
                continue
            q = deque([(sx, sy)])
            seen[i] = 1
            island = [(sx, sy)]
            while q:
                x, y = q.popleft()
                for dx, dy in NEIGHBOURS:
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h:
                        j = ny * w + nx
                        if not seen[j] and dist(px[nx, ny]) <= TOL:
                            seen[j] = 1
                            q.append((nx, ny))
                            island.append((nx, ny))
            if len(island) >= POCKET:
                pockets += 1
                for x, y in island:
                    paper[y * w + x] = 1

    out = Image.new('RGBA', (w, h))
    op = out.load()
    rim = 0
    for y in range(h):
        for x in range(w):
            c = px[x, y]
            if paper[y * w + x]:
                op[x, y] = (c[0], c[1], c[2], 0)
                continue
            d = dist(c)
            touching = any(0 <= x + dx < w and 0 <= y + dy < h
                           and paper[(y + dy) * w + x + dx] for dx, dy in AROUND)
            if d < SOFT and touching:
                rim += 1
                op[x, y] = (c[0], c[1], c[2], int(255 * (d - TOL) / (SOFT - TOL)))
            else:
                op[x, y] = (c[0], c[1], c[2], 255)
    out.save(dst)
    print('%s -> %s  paper %s  pockets %d  rim %d px'
          % (src, dst, bg, pockets, rim))


if __name__ == '__main__':
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2])
