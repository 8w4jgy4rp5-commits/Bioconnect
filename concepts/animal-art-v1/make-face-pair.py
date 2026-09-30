#!/usr/bin/env python3
"""Turn a reviewed calm/hungry concept pair into a matched game-ready pair.

Most animals on this board ship as ONE painting: make-game-asset.py crops
that painting tight to its own visible pixels. Two of them -- the
elephant, and every animal about to get a hungry face -- ship as a PAIR
instead, a calm painting and a hungry painting that the game swaps
between at run time. Cropping each side of a pair to its own bounding box
the way make-game-asset.py does is exactly wrong: the calm and hungry
paintings almost never have the same amount of empty margin around them,
so an independent crop re-centres each file on its own art and the body
jumps sideways the instant the face changes. The elephant pair dodged
this by being cut with one shared frame, done by hand in a browser
canvas. This script is that step, made repeatable: crop both images to
the union of their two bounding boxes, so one rectangle governs both, and
report how much drift is left over once the pair ships.

Usage:  python make-face-pair.py elephant-calm.png elephant-hungry.png \
            ../../img/elephant-calm.png ../../img/elephant-hungry.png [--width 220]
"""
import sys
from PIL import Image

TARGET_W = 220  # source art; script.js halves it down again at load time

# Alpha below this is dust, not art: every painting on this board came
# back from its background removal with a scatter of 1-7 alpha pixels out
# in the margin, invisible on any screen and fatal to a plain getbbox().
# See make-game-asset.py for the deer, which lost a third of its canvas
# to exactly this dust. The crop here is measured on the pixels the eye
# can actually see, and the dust is wiped rather than shipped.
VISIBLE = 8


def visible_bbox(im):
    """Return (box, cleaned_image) where box ignores sub-VISIBLE alpha dust."""
    a = im.split()[3]
    solid = a.point(lambda v: 255 if v >= VISIBLE else 0)
    box = solid.getbbox()
    im = im.copy()
    im.putalpha(a.point(lambda v: v if v >= VISIBLE else 0))
    return box, im


def union_box(a, b):
    return (min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3]))


def main(calm_src, hungry_src, calm_dst, hungry_dst, target_w=TARGET_W):
    calm = Image.open(calm_src).convert('RGBA')
    hungry = Image.open(hungry_src).convert('RGBA')

    if calm.size != hungry.size:
        raise SystemExit(
            '%s is %dx%d but %s is %dx%d -- a shared frame across two '
            'different canvases is meaningless. Re-export both from the '
            'same canvas size before pairing them.'
            % (calm_src, calm.width, calm.height, hungry_src, hungry.width, hungry.height)
        )

    calm_box, calm = visible_bbox(calm)
    hungry_box, hungry = visible_bbox(hungry)
    if calm_box is None:
        raise SystemExit('%s has no visible pixels' % calm_src)
    if hungry_box is None:
        raise SystemExit('%s has no visible pixels' % hungry_src)

    frame = union_box(calm_box, hungry_box)  # one rectangle for both

    calm = calm.crop(frame)
    hungry = hungry.crop(frame)
    h = max(1, round(calm.height * target_w / calm.width))
    calm = calm.resize((target_w, h), Image.LANCZOS)
    hungry = hungry.resize((target_w, h), Image.LANCZOS)

    calm.save(calm_dst, optimize=True)
    hungry.save(hungry_dst, optimize=True)
    print('%s -> %s  %dx%d' % (calm_src, calm_dst, calm.width, calm.height))
    print('%s -> %s  %dx%d' % (hungry_src, hungry_dst, hungry.width, hungry.height))

    report(calm, hungry, frame, target_w, h)


def report(calm, hungry, frame, w, h):
    """Print how far the hungry face's own bbox drifts from the calm one,
    measured inside the shared frame both were cropped to."""
    calm_box = visible_bbox(calm)[0]
    hungry_box = visible_bbox(hungry)[0]

    print()
    print('shared frame: %dx%d (source px)  ->  output %dx%d' % (
        frame[2] - frame[0], frame[3] - frame[1], w, h))
    print('calm   bbox: left=%d top=%d right=%d bottom=%d' % calm_box)
    print('hungry bbox: left=%d top=%d right=%d bottom=%d' % hungry_box)

    calm_cx = (calm_box[0] + calm_box[2]) / 2.0
    hungry_cx = (hungry_box[0] + hungry_box[2]) / 2.0
    centre_drift = hungry_cx - calm_cx
    centre_pct = 100.0 * centre_drift / w

    feet_drift = hungry_box[3] - calm_box[3]
    feet_pct = 100.0 * feet_drift / h

    print('centre drift (hungry - calm): %+.1fpx  (%+.1f%% of width)   [advisory]' % (centre_drift, centre_pct))
    print('feet drift   (hungry - calm): %+.1fpx  (%+.1f%% of height)  [binding]' % (feet_drift, feet_pct))

    # THE FEET ARE THE CHECK. THE CENTRE IS A HINT.
    #
    # Both numbers come off a bounding box, and a bounding box moves
    # whenever the OUTLINE changes, whether or not the animal did. The
    # wolf made that plain: its hungry painting drops the tail and lowers
    # the head, so the box narrows from the left and the centre slides
    # 4.3% right -- while every leg, paw and belly pixel sits exactly
    # where it did. Failing that pair would have been wrong.
    #
    # The bottom edge does not have that problem. It is the ground the
    # animal stands on, it is what `oy` is solved against, and a pair
    # whose bottom edges agree is a pair standing in the same place. So
    # that is the one that fails a pair.
    #
    # Neither number can prove the body held still -- a bbox cannot see
    # inside itself, and on the zebra both boxes filled the canvas and
    # every drift read 0.0 while saying nothing at all. Only the
    # silhouette overlay shows that, which is what check-pair.py draws.
    if abs(feet_pct) > 1.0:
        print('WARNING: the feet moved by more than 1% of the frame. The animal '
              'will visibly hop when the face swaps -- the hungry painting '
              'needs redrawing before it ships.')
    else:
        print('OK: the feet agree, so the pair stands in one place.')
        if abs(centre_pct) > 1.0:
            print('   (the centre moved %+.1f%%, which is normal when the pose '
                  'changes shape -- a dropped tail or a lowered head narrows '
                  'the box without moving the body)' % centre_pct)
    print('Now run check-pair.py and look at the overlay: the legs must be grey.')


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    target_w = TARGET_W
    if '--width' in sys.argv:
        target_w = int(sys.argv[sys.argv.index('--width') + 1])
    if len(args) < 4:
        raise SystemExit(__doc__)
    main(args[0], args[1], args[2], args[3], target_w)
