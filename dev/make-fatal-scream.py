# A more human version of take h2 (the high male "uwaaa!" the user picked).
#   C:/Users/tians/Videos/honeybee/.venv-tts/Scripts/python dev/make-fatal-scream.py
#
# What made h2 sound like a machine, and what this does instead:
#  1. too regular  -> per-cycle jitter (pitch) and shimmer (loudness), and a
#                     wandering pitch instead of a perfect sine vibrato
#  2. no breath    -> aspiration noise pulsed with each vocal cycle, plus a
#                     breath tail where the voice gives out
#  3. no break     -> a voice crack near the peak, a scoop at the onset
#  4. muffled      -> F4/F5 for the "ring" of a shout, a mic-like presence
#                     lift, a light clip and a small room
import pathlib
import numpy as np, soundfile as sf

SR = 48000
OUT = pathlib.Path(__file__).parent / 'sfx'

def smooth_noise(rng, n, hz, depth):
    """Slow random wander, `hz` = roughly how often it changes direction."""
    k = max(2, int(n / SR * hz) + 2)
    pts = rng.normal(0, depth, k)
    return np.interp(np.linspace(0, k - 1, n), np.arange(k), pts)

def resonate(x, freqs, bw):
    y = np.zeros_like(x); y1 = y2 = 0.0
    r = np.exp(-np.pi * bw / SR); c2 = -r * r
    cos = np.cos(2 * np.pi * freqs / SR)
    for i in range(len(x)):
        v = (1 - r) * x[i] + 2 * r * cos[i] * y1 + c2 * y2
        y[i] = v; y2 = y1; y1 = v
    return y

def scream(seed, dur=1.8, f0=420, crack=True, crack_at=.55, breath=.35, rasp=.25):
    rng = np.random.default_rng(seed)
    n = int(dur * SR); t = np.arange(n) / SR; pos = t / dur
    # pitch: scoop up from below, overshoot, wander, sag and give out
    contour = np.interp(pos, [0, .08, .18, .7, 1], [.72, 1.08, 1.0, .97, .78])
    contour *= 1 + smooth_noise(rng, n, 6, .025) + smooth_noise(rng, n, 1.5, .03)
    if crack:  # the voice flips up for ~70 ms and back
        c = np.exp(-((t - crack_at * dur) / .035) ** 2)
        contour *= 1 + .22 * c
    f = f0 * contour
    phase = np.cumsum(f / SR); cyc = np.floor(phase).astype(int); ph = phase % 1
    ncyc = cyc.max() + 2
    jitter = 1 + rng.normal(0, .012, ncyc)          # each cycle a bit off
    shimmer = 1 + rng.normal(0, .09, ncyc)
    ph = np.clip(ph * jitter[cyc], 0, 1)
    # glottal pulse (open 60%, sharp close) -> derivative gives the "buzz"
    oq = .6
    g = np.where(ph < oq, .5 * (1 - np.cos(np.pi * ph / oq)), np.cos(.5 * np.pi * (ph - oq) / (1 - oq)) ** 2 * (ph < 1))
    src = np.diff(g, prepend=g[0]) * SR / f0 / 4
    src *= shimmer[cyc]
    # rasp: irregular extra pulses (a strained, torn edge)
    src *= 1 + rasp * smooth_noise(rng, n, 60, 1)
    # h2's light ~20 Hz gurgle, kept on purpose: it is the take the user picked
    src *= 1 - .25 * (.5 + .5 * np.sin(2 * np.pi * np.cumsum((20 + smooth_noise(rng, n, 2, 3)) / SR)))
    # breath: noise that puffs with each cycle, louder as the voice gives out
    voice_env = np.interp(pos, [0, .05, .82, 1], [0, 1, .9, .15])
    breath_env = np.interp(pos, [0, .05, .82, 1], [.6, .35, .5, 1.0])
    puff = .4 + .6 * np.sin(np.pi * ph) ** 2
    noise = rng.normal(0, 1, n) * puff * breath * breath_env
    excite = src * voice_env + noise * .5
    # vowel u -> a (screamed, mouth wide), formants drifting a little
    F = [(450, 900, 80), (950, 1450, 110), (2500, 2800, 170), (3300, 3500, 260), (4200, 4300, 320)]
    out = 0
    for k, (fu, fa, bw) in enumerate(F):
        fk = np.interp(pos, [0, .1, 1], [fu, fa, fa * .96]) * (1 + smooth_noise(rng, n, 3, .03))
        gain = [1.0, 1.0, .9, .75, .55][k]
        out = out + gain * resonate(excite, fk, bw)
    out = np.append(out[0], np.diff(out) * 1.5 + out[1:] * .5)   # lips radiate highs
    out *= np.interp(pos, [0, .03, .9, 1], [0, 1, .8, 0])
    return out / np.max(np.abs(out))

def finish(y, double=False, seed=0):
    rng = np.random.default_rng(seed + 99)
    if double:  # a second, slightly detuned throat behind: thicker, less synthetic
        d = int(.018 * SR)
        y = y + .35 * np.concatenate([np.zeros(d), y[:-d]])
    # mic presence: lift 2-5 kHz a touch (difference of two smoothers)
    a = np.convolve(y, np.ones(5) / 5, 'same'); b = np.convolve(y, np.ones(24) / 24, 'same')
    y = y + .8 * (a - b)
    y = np.tanh(1.8 * y / np.max(np.abs(y)))        # mic pushed by a shout
    tail = np.zeros(int(.35 * SR))
    y = np.concatenate([y, tail])
    room = np.zeros_like(y)                            # small room: scattered early echoes
    for _ in range(14):
        d = int(rng.uniform(.008, .09) * SR); gdb = rng.uniform(.03, .1)
        room[d:] += gdb * y[:-d]
    y = y + np.convolve(room, np.ones(12) / 12, 'same')
    return (y * .89 / np.max(np.abs(y))).astype(np.float32)

OUT.mkdir(exist_ok=True)
TAKES = {
    'fatal-h2b-human': finish(scream(3), seed=3),
    'fatal-h2c-human-crack': finish(scream(5, crack_at=.5, breath=.45, rasp=.35), seed=5),
    'fatal-h2d-human-double': finish(scream(8, breath=.4, rasp=.3), double=True, seed=8),
}
for name, y in TAKES.items():
    sf.write(OUT / f'{name}.wav', y, SR, subtype='PCM_16'); print(name, round(len(y) / SR, 2), 's')
