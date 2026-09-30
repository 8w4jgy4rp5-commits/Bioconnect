#!/usr/bin/env python3
"""Measure -- and draw -- what a rig actually puts on a tile.

README says to size a new animal against the rabbit and the fox rather
than guess: match their height and their baseline. This is the thing
that reads those numbers off, so nobody has to squint at a browser or
keep a second copy of them in a document where they can rot.

The rig is not retyped here. SPRITE_FILES and RIG are lifted out of
script.js and parsed, so this reports what the game draws, and moving a
number in script.js moves it here too.

  python measure-rig.py                      # the table
  python measure-rig.py deer=20,0,0.58       # try a size before shipping it
  python measure-rig.py --sheet out.png rabbit fox wolf buffalo bear deer
  python measure-rig.py --sheet out.png --hungry wolf zebra   # fed beside starving

Every percentage is of the TILE -- the square paintAnimal paints into,
whose side is fit.span rig units. That is not the same square as the
cell around it, so these numbers run about 1.21x the ones in PROGRESS.md
for 2026-09-27, which were measured against an 87px cell.
"""
import json, math, os, re, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
IMG = os.path.join(ROOT, 'img')

VISIBLE = 8   # alpha below this is dust; see make-game-asset.py


# ---------- reading the rig out of script.js ----------

def _literal(src, name):
    """The object literal assigned to `name`, as text."""
    start = src.index('const %s = {' % name) + len('const %s = ' % name)
    end = src.index('\n};', start) + 2
    return src[start:end]


def _to_json(text):
    text = re.sub(r'//[^\n]*', '', text)                    # comments
    text = text.replace("'", '"')                           # quotes
    text = re.sub(r'([{,]\s*)([A-Za-z_][\w]*)\s*:', r'\1"\2":', text)
    text = re.sub(r',(\s*[}\]])', r'\1', text)              # trailing commas
    return json.loads(text)


def load_rig(path=None):
    src = open(path or os.path.join(ROOT, 'script.js'), encoding='utf-8').read()
    return _to_json(_literal(src, 'RIG')), _to_json(_literal(src, 'SPRITE_FILES'))


# ---------- geometry, as paintAnimal does it ----------

_cache = {}


def art(fname):
    """The image, and the box its VISIBLE pixels occupy, as fractions."""
    if fname not in _cache:
        im = Image.open(os.path.join(IMG, fname)).convert('RGBA')
        a = im.split()[3].point(lambda v: 255 if v >= VISIBLE else 0)
        b = a.getbbox()
        W, H = im.size
        _cache[fname] = (im, (b[0] / W, b[1] / H, b[2] / W, b[3] / H), H / W)
    return _cache[fname]


def _corners(p, fname):
    _im, (fx0, fy0, fx1, fy1), aspect = art(fname)
    w = p['w']
    h = w * aspect
    x0, y0 = -w * p['px'], -h * p['py']
    rx0, rx1 = x0 + w * fx0, x0 + w * fx1
    ry0, ry1 = y0 + h * fy0, y0 + h * fy1
    if p.get('flip'):
        rx0, rx1 = -rx1, -rx0
    r = math.radians(p.get('r', 0))
    c, s = math.cos(r), math.sin(r)
    return [(p['x'] + X * c - Y * s, p['y'] + X * s + Y * c)
            for X, Y in ((rx0, ry0), (rx1, ry0), (rx1, ry1), (rx0, ry1))]


def measure(rig, files, fed=1):
    fit = rig['fit']
    t = math.radians(fit.get('tilt', 0))
    c, s = math.cos(t), math.sin(t)
    sag = (1 - fed) * 1.1
    xs, ys = [], []
    for name, p, _a in rig['parts']:
        key = (rig['head']['hungry' if fed < 0.34 else 'calm']
               if name == '@head' else name)
        for X, Y in _corners(p, files[key]):
            xs.append(X * c - Y * s)
            ys.append(X * s + Y * c)
    span = fit['span']
    return {
        'top':   0.5 + (fit['oy'] + sag + min(ys)) / span,
        'feet':  0.5 + (fit['oy'] + sag + max(ys)) / span,
        'left':  0.5 - fit['ox'] / span + min(xs) / span,
        'right': 0.5 - fit['ox'] / span + max(xs) / span,
    }


def report(kind, rig, files):
    m = measure(rig, files)
    starved = measure(rig, files, 0)
    print('%-14s height %5.1f%%  width %5.1f%%  feet %5.1f%%  top %5.1f%%'
          '   starving feet %5.1f%%' %
          (kind, (m['feet'] - m['top']) * 100, (m['right'] - m['left']) * 100,
           m['feet'] * 100, m['top'] * 100, starved['feet'] * 100))


# ---------- drawing, for looking at rather than reading ----------

SS = 6   # supersample, standing in for the browser's own downscale


def tile(rig, files, px=66, fed=1, bg=(247, 244, 236, 255)):
    D = px * SS
    out = Image.new('RGBA', (D, D), bg)
    fit = rig['fit']
    s = px / fit['span'] * SS
    ox0 = D / 2 - fit['ox'] * s
    oy0 = D / 2 + (fit['oy'] + (1 - fed) * 1.1) * s
    tilt = fit.get('tilt', 0)
    for name, p, alpha in rig['parts']:
        key = (rig['head']['hungry' if fed < 0.34 else 'calm']
               if name == '@head' else name)
        im = art(files[key])[0]
        w = p['w'] * s
        h = w * im.height / im.width
        im = im.resize((max(1, round(w)), max(1, round(h))), Image.LANCZOS)
        if p.get('flip'):
            im = im.transpose(Image.FLIP_LEFT_RIGHT)
        if alpha < 1:
            im.putalpha(im.split()[3].point(lambda v: round(v * alpha)))
        # the layer is the tile itself, so an anchor is absolute and a
        # rotation turns about the point the canvas would turn about
        layer = Image.new('RGBA', (D, D), (0, 0, 0, 0))
        ax, ay = ox0 + p['x'] * s, oy0 + p['y'] * s
        layer.paste(im, (round(ax - w * p['px']), round(ay - h * p['py'])))
        if p.get('r'):
            layer = layer.rotate(-p['r'], center=(ax, ay), resample=Image.BICUBIC)
        if tilt:
            layer = layer.rotate(-tilt, center=(ox0, oy0), resample=Image.BICUBIC)
        out.alpha_composite(layer)
    return out.resize((px, px), Image.LANCZOS)


def sheet(entries, files, path, px=66, scale=4, hungry=False):
    """One tile per entry, on a shared baseline.

    With `hungry`, each animal is drawn twice -- fed, then starving -- so
    a new hungry painting can be read against its own calm one rather
    than against a memory of it. That pairing is the only way to tell
    whether a hunger cue survives the trip down to tile size: at 44px a
    face is three or four pixels across, and what actually reads is the
    outline, which cannot be judged from the full-size art at all.
    """
    from PIL import ImageDraw
    if hungry:
        entries = [(lbl + s, rig, f)
                   for lbl, rig in entries
                   for s, f in (('', 1), (' hungry', 0))]
    else:
        entries = [(lbl, rig, 1) for lbl, rig in entries]
    pad, cell = 6, px + 12
    img = Image.new('RGBA', (cell * len(entries), cell + 14), (255, 255, 255, 255))
    d = ImageDraw.Draw(img)
    for i, (label, rig, fed) in enumerate(entries):
        img.paste(tile(rig, files, px, fed=fed), (i * cell + pad, pad))
        d.text((i * cell + pad, cell + 1), label, fill=(60, 50, 45))
        # one shared baseline, so feet are compared by eye and not by trust
        d.line([(i * cell, pad + px), (i * cell + cell, pad + px)],
               fill=(220, 120, 120))
    img = img.resize((img.width * scale, img.height * scale), Image.NEAREST)
    img.save(path)
    print('%s  %dx%d' % (path, img.width, img.height))


def main(argv):
    rigs, files = load_rig()
    out = None
    hungry = '--hungry' in argv
    argv = [a for a in argv if a != '--hungry']
    if '--sheet' in argv:
        i = argv.index('--sheet')
        out = argv[i + 1]
        argv = argv[:i] + argv[i + 2:]
    trials = []
    for a in argv:                    # deer=20,0,0.58 -- a size not yet shipped
        if '=' in a:
            kind, nums = a.split('=', 1)
            w, ox, oy = (float(v) for v in nums.split(','))
            base = rigs[kind]
            name = kind + ' ' + nums
            rigs[name] = {
                'fit': dict(base['fit'], ox=ox, oy=oy),
                'parts': [['@head', dict(base['parts'][0][1], w=w), 1]],
                'head': base['head']}
            trials.append(name)
    order = [a for a in argv if '=' not in a] or [k for k in rigs if k not in trials]
    order += trials
    for kind in order:
        report(kind, rigs[kind], files)
    if out:
        sheet([(k, rigs[k]) for k in order], files, out, hungry=hungry)


if __name__ == '__main__':
    main(sys.argv[1:])
