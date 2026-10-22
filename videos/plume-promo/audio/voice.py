"""Lecture ElevenLabs de la scène « livre audio » : placement + enveloppe.

Entrées : assets/audio/voice-p0.mp3, voice-p1.mp3 (générées par l'API PLUME
/api/tts, voix ElevenLabs de l'app) et voice-words.json (horodatage mot à mot).
Sortie : assets/audio/voice.json (lu par build.py → timeline, et compose.py).
"""
import io
import json
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
SR = 44100
VS = [45.25, 52.6]          # début de chaque clip sur la timeline (s)
ENV_START, ENV_END, FPS = 45.0, 55.3, 30


def load(p):
    wav = subprocess.run(["ffmpeg", "-v", "error", "-i", str(p), "-f", "wav", "-ac", "1", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    x, _ = sf.read(io.BytesIO(wav))
    return x


words = json.loads((ROOT / "assets/audio/voice-words.json").read_text(encoding="utf-8"))
clips = [load(ROOT / f"assets/audio/voice-p{i}.mp3") for i in (0, 1)]
n = int((ENV_END - ENV_START) * SR)
track = np.zeros(n)
for vs, c in zip(VS, clips):
    i0 = int((vs - ENV_START) * SR)
    m = min(len(c), n - i0)
    track[i0:i0 + m] += c[:m]
hop = SR // FPS
env = np.array([np.sqrt(np.mean(track[k:k + hop] ** 2)) for k in range(0, n - hop, hop)])
env = env / max(env.max(), 1e-9)
env = np.convolve(env, np.ones(3) / 3, "same")
data = {
    "vs": VS,
    "dur": [round(len(c) / SR, 3) for c in clips],
    "words": [[w[0], round(w[1], 3), round(w[2], 3)] for w in words["p0"]],
    "words1": [[w[0], round(w[1], 3), round(w[2], 3)] for w in words["p1"] if any(ch.isalpha() for ch in w[0])],
    "envStart": ENV_START,
    "fps": FPS,
    "env": [round(float(v), 3) for v in env],
}
(ROOT / "assets/audio/voice.json").write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
print("voice.json :", len(data["env"]), "échantillons, durées", data["dur"])
