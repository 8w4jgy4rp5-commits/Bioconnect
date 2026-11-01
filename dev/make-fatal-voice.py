# Male "nooo!" candidates for the fatal moment of a staged fail video.
# Kokoro (local, free, Apache-2.0) from the honeybee video's venv; no network.
#   C:/Users/tians/Videos/honeybee/.venv-tts/Scripts/python dev/make-fatal-voice.py
# writes dev/sfx/fatal-*.wav. Pick one and point the preset's fatalSound at it.
import pathlib
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

TTS = pathlib.Path('C:/Users/tians/Videos/honeybee/tts-models')
OUT = pathlib.Path(__file__).parent / 'sfx'
CANDIDATES = [  # (file, voice, text, speed)
    ('fatal-1-onyx-noooo', 'am_onyx', 'Noooooooo!', 0.7),
    ('fatal-2-fenrir-ohno', 'am_fenrir', 'Oh noooooo!', 0.75),
    ('fatal-3-michael-waaah', 'am_michael', 'Waaaaaah!', 0.7),
    ('fatal-4-puck-nonono', 'am_puck', 'No, no, NOOOO!', 0.85),
]
SR = 48000
k = Kokoro(str(TTS / 'kokoro-v1.0.onnx'), str(TTS / 'voices-v1.0.bin'))
OUT.mkdir(exist_ok=True)
for name, voice, text, speed in CANDIDATES:
    s, sr = k.create(text, voice=voice, speed=speed, lang='en-us')
    loud = np.nonzero(np.abs(s) > 0.01)[0]
    s = s[max(0, loud[0] - int(.01 * sr)): loud[-1] + int(.05 * sr)]
    # a touch deeper (played 8% slower) so it reads as anguish, not narration
    s = np.interp(np.arange(0, len(s), sr / SR * 0.92), np.arange(len(s)), s).astype(np.float32)
    # a short hall echo for the "tragedy" feel
    out = np.concatenate([s, np.zeros(int(.6 * SR), np.float32)])
    for delay, gain in ((0.09, .35), (0.17, .22), (0.29, .12)):
        d = int(delay * SR)
        out[d:d + len(s)] += s * gain
    out *= 0.89 / np.max(np.abs(out))
    sf.write(OUT / f'{name}.wav', out, SR, subtype='PCM_16')
    print(name, round(len(out) / SR, 2), 's')
