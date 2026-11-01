# Male "uwaaa!" takes for the fatal moment of a staged fail video.
# Kokoro (local, free, Apache-2.0) from the honeybee video's venv; no network.
#   C:/Users/tians/Videos/honeybee/.venv-tts/Scripts/python dev/make-fatal-voice.py
# writes dev/sfx/fatal-*.wav. Pick one and point the preset's fatalSound at it.
#
# Direction (2026-11-01, the user's words): not low and tragic, but a big
# comic glutton's "uwaaa!" — so the takes are pitched UP, wobble, and the
# end slides down like a wail running out of breath.
import pathlib
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

TTS = pathlib.Path('C:/Users/tians/Videos/honeybee/tts-models')
OUT = pathlib.Path(__file__).parent / 'sfx'
SR = 48000
# (file, voice, text, lang, tts speed, pitch x, wobble depth, end slide)
#   pitch  > 1 raises the voice (stretch() first gives back most of the length)
#   wobble  vibrato depth (0.06 = +-6% at 6.5 Hz), the comic "trembling" wail
#   slide   how far the pitch falls over the last 40% (0.25 = down 25%)
TAKES = [
    ('fatal-a-kumo-uwaa', 'jm_kumo', 'うわああああああああああああっ！', 'ja', 0.5, 2.0, 0.06, 0.25),
    ('fatal-b-kumo-uwaa-high', 'jm_kumo', 'うわああああああああああああっ！', 'ja', 0.5, 2.6, 0.08, 0.30),
    ('fatal-c-puck-uwaa', 'am_puck', 'Uwaaaaaaaaaaaah!', 'en-us', 0.5, 1.8, 0.06, 0.25),
    ('fatal-d-santa-waaa', 'am_santa', 'Waaaaaaaaaah!', 'en-us', 0.6, 1.30, 0.07, 0.30),
    ('fatal-e-echo-uwaa', 'am_echo', 'Uwaaaaaaaaaaah!', 'en-us', 0.5, 2.0, 0.05, 0.35),
    ('fatal-f-eric-noooo', 'am_eric', 'Nooooooooo!', 'en-us', 0.6, 1.30, 0.07, 0.30),
]

def stretch(s, sr, factor):
    """Make the take `factor` times longer without changing its pitch.
    WSOLA: each 30 ms grain is taken from near where it should be, shifted
    to line up with the waveform already laid down, so the voice stays
    clean instead of buzzing."""
    if factor <= 1: return s
    g = int(.03 * sr); hop = g // 2; tol = int(.012 * sr)
    win = np.hanning(g).astype(np.float32)
    n = int((len(s) - g - tol) * factor / hop)
    out = np.zeros(n * hop + g, np.float32); norm = np.zeros_like(out)
    prev = 0
    for i in range(n):
        nominal = int(i * hop / factor)
        if i == 0: a = 0
        else:
            want = s[prev + hop: prev + hop + g]          # natural continuation
            lo = max(0, nominal - tol); hi = min(len(s) - g, nominal + tol)
            if hi <= lo or len(want) < g: a = min(nominal, len(s) - g)
            else:
                best, a = -1e9, lo
                for c in range(lo, hi, 2):
                    v = float(np.dot(want, s[c:c + g]))
                    if v > best: best, a = v, c
        b = i * hop
        out[b:b + g] += s[a:a + g] * win; norm[b:b + g] += win
        prev = a
    return out / np.maximum(norm, 1e-3)

def reshape(s, sr, pitch, wobble, slide):
    """Read through the take at a varying rate: faster = higher pitch.
    Vibrato wobbles the rate; the slide drops it near the end."""
    n_out_guess = int(len(s) / sr * SR / pitch * 1.6) + SR
    t = np.arange(n_out_guess) / SR
    dur = len(s) / sr / pitch
    pos = np.clip(t / dur, 0, 1)
    curve = 1 - slide * np.clip((pos - 0.6) / 0.4, 0, 1) ** 1.5
    rate = pitch * curve * (1 + wobble * np.sin(2 * np.pi * 6.5 * t)) * sr / SR
    ptr = np.cumsum(rate)
    ptr = ptr[ptr < len(s) - 1]
    return np.interp(ptr, np.arange(len(s)), s).astype(np.float32)

k = Kokoro(str(TTS / 'kokoro-v1.0.onnx'), str(TTS / 'voices-v1.0.bin'))
OUT.mkdir(exist_ok=True)
for name, voice, text, lang, speed, pitch, wobble, slide in TAKES:
    s, sr = k.create(text, voice=voice, speed=speed, lang=lang)
    loud = np.nonzero(np.abs(s) > 0.01)[0]
    s = s[max(0, loud[0] - int(.01 * sr)): loud[-1] + int(.05 * sr)]
    s = stretch(s, sr, pitch * 0.8)   # most of the length back
    s = reshape(s, sr, pitch, wobble, slide)
    fade = min(len(s), int(.08 * SR))
    s[-fade:] *= np.linspace(1, 0, fade)
    # a small room, not a hall: comic, close to the mic
    out = np.concatenate([s, np.zeros(int(.25 * SR), np.float32)])
    d = int(.06 * SR)
    out[d:d + len(s)] += s * .18
    out *= 0.89 / np.max(np.abs(out))
    sf.write(OUT / f'{name}.wav', out, SR, subtype='PCM_16')
    print(name, round(len(out) / SR, 2), 's')
