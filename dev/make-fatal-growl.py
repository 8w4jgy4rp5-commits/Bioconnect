# Growling "uwaa... uwaa..." for the fatal moment of a staged fail video,
# synthesised from scratch (no TTS, no samples), so it is ours to use.
#   C:/Users/tians/Videos/honeybee/.venv-tts/Scripts/python dev/make-fatal-growl.py
#
# Shape taken from measuring the reference the user pointed at (a big-eater
# monster's wail): voice around 100-140 Hz, a rough gurgle about 20 times a
# second, a slow 4-5 Hz wobble, each "uwaa" 1.6-2 s with the u -> a colour
# rising at the start, repeated. A clean read-out voice was the wrong
# texture; the roughness and the repeat are the point.
import pathlib
import numpy as np, soundfile as sf

SR = 48000
OUT = pathlib.Path(__file__).parent / 'sfx'
rng = np.random.default_rng(7)

# vowel formants (F1, F2, F3) for a large male voice
VOWEL = {'u': (330, 780, 2250), 'w': (420, 900, 2300), 'a': (720, 1180, 2450), 'o': (560, 900, 2400)}

def resonate(x, freqs, bw):
    """Time-varying 2-pole resonator: freqs is a per-sample array."""
    y = np.zeros_like(x); y1 = y2 = 0.0
    r = np.exp(-np.pi * bw / SR)
    c2 = -r * r
    for i in range(len(x)):
        c1 = 2 * r * np.cos(2 * np.pi * freqs[i] / SR)
        v = (1 - r) * x[i] + c1 * y1 + c2 * y2
        y[i] = v; y2 = y1; y1 = v
    return y

def wail(dur, f0, growl, bright, rise=1.15, fall=0.78, end_vowel='o', tail=.2):
    n = int(dur * SR); t = np.arange(n) / SR; pos = t / dur
    # pitch: scoop up into the "wa", hold with a 4.5 Hz wobble, sag at the end
    contour = np.interp(pos, [0, .15, .7, 1], [.85, rise, 1.0, fall])
    jitter = np.convolve(rng.normal(0, .03, n), np.ones(400) / 400, 'same')
    f = f0 * contour * (1 + .045 * np.sin(2 * np.pi * 4.5 * t)) * (1 + jitter)
    phase = np.cumsum(f / SR)
    saw = 2 * (phase % 1) - 1                      # bright buzzy source
    pulse = np.where((phase % 1) < .45, np.sin(np.pi * (phase % 1) / .45), 0) * 2 - .6
    src = .55 * saw + .45 * pulse
    # period doubling: every other cycle quieter -> the throaty sub-octave growl
    src *= np.where((np.floor(phase) % 2) == 0, 1.0, 1 - .45 * growl)
    # the gurgle: ~20 Hz flutter, a little irregular
    flutter = 20 + 3 * np.sin(2 * np.pi * .7 * t)
    src *= 1 - growl * (.5 + .5 * np.sin(2 * np.pi * np.cumsum(flutter / SR)))
    src += rng.normal(0, .12 + .1 * growl, n)       # breath and rasp
    # vowel path u -> w -> a ... -> o
    path = [(0, 'u'), (.12, 'w'), (.25, 'a'), (.75, 'a'), (1, end_vowel)]
    xs = [p for p, _ in path]
    out = 0
    for k, (gain, bw) in enumerate([(1.0, 90), (.7 * bright, 110), (.35 * bright, 160)]):
        fk = np.interp(pos, xs, [VOWEL[v][k] for _, v in path])
        out = out + gain * resonate(src, fk, bw)
    env = np.interp(pos, [0, .06, 1 - tail, 1], [0, 1, .85 if tail >= .2 else 1, 0]) ** 1.2
    out *= env
    return np.tanh(2.2 * out / np.max(np.abs(out)))  # push it into a rough shout

def take(name, parts, gap=.12):
    pieces = []
    for p in parts:
        pieces.append(wail(**p)); pieces.append(np.zeros(int(gap * SR)))
    y = np.concatenate(pieces + [np.zeros(int(.2 * SR))]).astype(np.float32)
    d = int(.05 * SR); y[d:] += .15 * y[:-d]           # small room
    y *= .89 / np.max(np.abs(y))
    sf.write(OUT / f'{name}.wav', y, SR, subtype='PCM_16')
    print(name, round(len(y) / SR, 2), 's')

OUT.mkdir(exist_ok=True)
take('fatal-g1-growl-uwaa-x2', [dict(dur=1.7, f0=115, growl=.75, bright=1.0),
                                dict(dur=1.9, f0=108, growl=.8, bright=.9, fall=.7)])
take('fatal-g2-growl-uwaa-x2-high', [dict(dur=1.6, f0=150, growl=.65, bright=1.2),
                                     dict(dur=1.8, f0=140, growl=.7, bright=1.1, fall=.7)])
take('fatal-g3-growl-uwaa-long', [dict(dur=2.6, f0=125, growl=.8, bright=1.0, rise=1.25, fall=.65)])
take('fatal-g4-growl-uwaa-x3', [dict(dur=1.2, f0=120, growl=.75, bright=1.0),
                                dict(dur=1.2, f0=124, growl=.75, bright=1.0),
                                dict(dur=1.8, f0=112, growl=.85, bright=.9, fall=.65)])

# 2026-11-01: the user wants a raw, HIGHER male scream (not the monster).
# Real male screams sit around 300-450 Hz with a wide-open "a" (high F1),
# so: high pitch, light rasp, bright formants.
VOWEL['A'] = (900, 1350, 2700)    # screamed "a": mouth wide open
VOWEL['W'] = (500, 1000, 2500)
def scream(dur, f0, growl=.3, bright=1.3, rise=1.2, fall=.75, **more):
    saved = dict(VOWEL); VOWEL['u'], VOWEL['w'], VOWEL['a'], VOWEL['o'] = (420, 900, 2400), VOWEL['W'], VOWEL['A'], (700, 1100, 2500)
    try: return wail(dur, f0, growl, bright, rise, fall, **more)
    finally: VOWEL.clear(); VOWEL.update(saved)
def take_s(name, parts, gap=.1):
    pieces = []
    for p in parts: pieces += [scream(**p), np.zeros(int(gap * SR))]
    y = np.concatenate(pieces + [np.zeros(int(.2 * SR))]).astype(np.float32)
    d = int(.04 * SR); y[d:] += .12 * y[:-d]
    y *= .89 / np.max(np.abs(y))
    sf.write(OUT / f'{name}.wav', y, SR, subtype='PCM_16'); print(name, round(len(y) / SR, 2), 's')
take_s('fatal-h1-scream-uwaa', [dict(dur=1.8, f0=330)])
take_s('fatal-h2-scream-uwaa-high', [dict(dur=1.8, f0=420, growl=.25, rise=1.15)])
take_s('fatal-h3-scream-uwaa-x2', [dict(dur=1.2, f0=360), dict(dur=1.7, f0=380, fall=.65)])

# 2026-11-01: the user — the drop at the end of h2 is what sounds wrong.
# Keep the "waaa" HIGH right to the end and let it break off up there:
# no pitch sag, no darkening to "o", full voice until a short cut.
take_s('fatal-h2e-scream-high-end', [dict(dur=1.8, f0=420, growl=.25, rise=1.15, fall=1.0, end_vowel='a', tail=.05)])
take_s('fatal-h2f-scream-rising-end', [dict(dur=1.8, f0=420, growl=.25, rise=1.15, fall=1.12, end_vowel='a', tail=.05)])
