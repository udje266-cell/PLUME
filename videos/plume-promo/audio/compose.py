"""PLUME promo — bande-son originale (musique synthétisée + SFX), 92 s, 120 BPM.

Usage : python3 audio/compose.py   → assets/audio/soundtrack.mp3

Tout est déterministe (graine fixe). La grille musicale (1 mesure = 2 s) est
calée sur les coupes de la vidéo ; la liste SFX reprend les temps du timeline.
"""
import io
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve

SR = 44100
DUR = 100.0
D = 8.0  # la scène « livre audio » a été rallongée de 8 s pour la voix ElevenLabs


def S(t):
    """Temps d'origine (vidéo de 92 s) → temps réel : tout ce qui suit 47,3 s est décalé de D."""
    return t + D if t >= 47.3 else t
N = int(SR * DUR)
BEAT = 0.5
BAR = 2.0
ROOT = Path(__file__).resolve().parent.parent
rng = np.random.default_rng(7)


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def tt(n):
    return np.arange(n) / SR


def lp(x, fc, order=2):
    return sosfilt(butter(order, min(fc, SR * 0.45), "low", fs=SR, output="sos"), x)


def hp(x, fc, order=2):
    return sosfilt(butter(order, fc, "high", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def add(bus, sig, t0, gain=1.0):
    i0 = int(round(t0 * SR))
    if i0 >= len(bus):
        return
    if i0 < 0:
        sig = sig[-i0:]
        i0 = 0
    n = min(len(sig), len(bus) - i0)
    bus[i0 : i0 + n] += sig[:n] * gain


# ---------------------------------------------------------------- harmonie
CH = {
    "Am": dict(bass=45, pad=[57, 60, 64, 69], arp=[69, 72, 76, 81]),
    "F": dict(bass=41, pad=[53, 57, 60, 65], arp=[65, 69, 72, 77]),
    "C": dict(bass=48, pad=[55, 60, 64, 67], arp=[67, 72, 76, 79]),
    "G": dict(bass=43, pad=[55, 59, 62, 67], arp=[67, 71, 74, 79]),
}
LOOP = ["Am", "F", "C", "G"]
NBARS = 50
chords = [LOOP[i % 4] for i in range(NBARS)]
chords[46], chords[47], chords[48], chords[49] = "F", "G", "C", "C"


def chord_at(t):
    return chords[min(NBARS - 1, int(t // BAR))]


# sections (début, fin) en secondes
def in_range(t, ranges):
    return any(a <= t < b for a, b in ranges)


DRUMS = [(8, 14), (14, 38), (56, 85.5), (86, 92)]
HATS = [(14, 38), (56, 85.5), (86, 92)]
SHAKER = [(24, 38), (66, 85.5), (86, 92)]
CLAP = [(56, 85.5), (86, 92)]
BASS8 = [(14, 38), (56, 85.5), (86, 92)]
ARP16 = [(14, 38), (56, 85.5), (86, 92)]
LEAD = [(72, 78), (86, 92)]
BREAK_PULSE = []

# ---------------------------------------------------------------- instruments


def saw_partial_sum(f, n, maxh=40, cutoff=5000.0):
    t = tt(n)
    out = np.zeros(n)
    for h in range(1, maxh + 1):
        if f * h > cutoff:
            break
        out += np.sin(2 * np.pi * f * h * t) / h
    return out


def pad_note(m, dur, att=0.35, rel=0.8):
    n = int((dur + rel) * SR)
    f = mtof(m)
    sig = np.zeros(n)
    for det in (-0.09, 0.0, 0.08):
        sig += saw_partial_sum(f * 2 ** (det / 12), n, cutoff=3200)
    env = np.ones(n)
    a = int(att * SR)
    env[:a] = np.linspace(0, 1, a) ** 1.5
    r0 = int(dur * SR)
    env[r0:] = np.linspace(1, 0, n - r0) ** 2
    return lp(sig * env, 1800) * 0.08


def piano_note(m, dur=2.2, vel=1.0):
    n = int(dur * SR)
    t = tt(n)
    f = mtof(m)
    sig = np.zeros(n)
    for k, (amp, dec) in enumerate([(1.0, 1.6), (0.45, 0.9), (0.22, 0.6), (0.12, 0.35), (0.06, 0.25)]):
        fk = f * (k + 1) * (1 + 0.0004 * (k + 1) ** 2)
        sig += amp * np.sin(2 * np.pi * fk * t) * np.exp(-t / dec)
    att = np.minimum(1, t / 0.004)
    hammer = bp(rng.standard_normal(n), 1500, 6000) * np.exp(-t / 0.012) * 0.12
    return (sig * att + hammer) * 0.22 * vel


def pluck(m, dur=0.45, vel=1.0, bright=4000):
    n = int(dur * SR)
    t = tt(n)
    f = mtof(m)
    sig = np.zeros(n)
    for h in range(1, 12):
        if f * h > 9000:
            break
        sig += np.sin(2 * np.pi * f * h * t) / h * np.exp(-t * (6 + h * 3.2))
    sig *= np.minimum(1, t / 0.002)
    return lp(sig, bright) * 0.16 * vel


def bell(m, dur=2.6, vel=1.0):
    n = int(dur * SR)
    t = tt(n)
    f = mtof(m)
    ratios = [(1, 1.0, 1.8), (2.76, 0.5, 0.9), (5.4, 0.25, 0.5), (8.9, 0.12, 0.3)]
    sig = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / d) for r, a, d in ratios)
    return sig * np.minimum(1, t / 0.003) * 0.12 * vel


def bass_note(m, dur, vel=1.0):
    n = int((dur + 0.05) * SR)
    t = tt(n)
    f = mtof(m)
    sub = np.sin(2 * np.pi * f * t)
    tri = 2 / np.pi * np.arcsin(np.sin(2 * np.pi * f * 2 * t))
    sig = np.tanh(1.6 * (sub + 0.35 * tri))
    env = np.minimum(1, t / 0.008) * np.exp(-t / (dur * 1.4))
    env[int(dur * SR):] *= np.linspace(1, 0, n - int(dur * SR))
    return lp(sig * env, 900) * 0.32 * vel


def kick(vel=1.0):
    n = int(0.55 * SR)
    t = tt(n)
    fr = 46 + 110 * np.exp(-t / 0.045)
    ph = 2 * np.pi * np.cumsum(fr) / SR
    body = np.sin(ph) * np.exp(-t / 0.32)
    click = bp(rng.standard_normal(n), 2000, 8000) * np.exp(-t / 0.004) * 0.35
    return np.tanh(1.8 * (body + click)) * 0.62 * vel


def snare(vel=1.0):
    n = int(0.35 * SR)
    t = tt(n)
    noise = bp(rng.standard_normal(n), 1200, 7500) * np.exp(-t / 0.09)
    body = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.06)
    return (noise * 0.6 + body * 0.5) * 0.4 * vel


def clap(vel=1.0):
    n = int(0.4 * SR)
    t = tt(n)
    env = np.zeros(n)
    for d in (0, 0.011, 0.023):
        i = int(d * SR)
        env[i:] += np.exp(-(t[: n - i]) / (0.012 if d < 0.02 else 0.14))
    return bp(rng.standard_normal(n), 900, 5200) * env * 0.26 * vel


def hat(open_=False, vel=1.0):
    n = int((0.3 if open_ else 0.07) * SR)
    t = tt(n)
    return hp(rng.standard_normal(n), 7500) * np.exp(-t / (0.09 if open_ else 0.018)) * 0.16 * vel


def shaker(vel=1.0):
    n = int(0.09 * SR)
    t = tt(n)
    env = np.minimum(1, t / 0.012) * np.exp(-t / 0.03)
    return bp(rng.standard_normal(n), 5000, 11000) * env * 0.09 * vel


def lead_note(m, dur, vel=1.0):
    n = int((dur + 0.25) * SR)
    t = tt(n)
    f = mtof(m) * (1 + 0.004 * np.sin(2 * np.pi * 5.2 * t) * np.minimum(1, t / 0.4))
    ph = 2 * np.pi * np.cumsum(f) / SR
    sig = sum(np.sin(k * ph) / k for k in (1, 3, 5, 7)) + 0.4 * np.sin(2 * ph)
    env = np.minimum(1, t / 0.02) * np.exp(-t / 3.0)
    r0 = int(dur * SR)
    env[r0:] *= np.linspace(1, 0, n - r0)
    return lp(sig * env, 3200) * 0.075 * vel


def riser(dur):
    n = int(dur * SR)
    t = tt(n)
    x = t / dur
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    # filtre qui monte : par blocs
    blocks = 40
    for b in range(blocks):
        a, z = b * n // blocks, (b + 1) * n // blocks
        fc = 400 + 9000 * (b / blocks) ** 2
        out[a:z] = bp(noise[a:z], fc * 0.7, min(fc * 1.4, 18000))
    sweep = np.sin(2 * np.pi * np.cumsum(180 + 900 * x**2) / SR) * 0.25
    return (out * 0.5 + sweep) * (x**2.2) * 0.35


def impact():
    n = int(2.5 * SR)
    t = tt(n)
    boom = np.sin(2 * np.pi * np.cumsum(38 + 60 * np.exp(-t / 0.08)) / SR) * np.exp(-t / 0.7)
    crash = hp(rng.standard_normal(n), 4000) * np.exp(-t / 0.3) * 0.1
    return np.tanh(2.0 * boom) * 0.7 + crash


def reverse_swell(dur):
    n = int(dur * SR)
    t = tt(n)
    return hp(rng.standard_normal(n), 2500) * (t / dur) ** 3 * 0.22


# ---------------------------------------------------------------- arrangement
music_L = np.zeros(N)
music_R = np.zeros(N)
drums = np.zeros(N)
bass_bus = np.zeros(N)
verb_send = np.zeros(N)


def mus(sig, t0, gain=1.0, pan=0.0, send=0.25):
    gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    add(music_L, sig, t0, gain * gl * 1.41)
    add(music_R, sig, t0, gain * gr * 1.41)
    add(verb_send, sig, t0, gain * send)


# pads (sauf silence avant le drop final)
for b in range(NBARS):
    t0 = b * BAR
    if 85.5 <= t0 < 86:
        continue
    c = CH[chords[b]]
    g = 0.55 if t0 < 8 else (0.7 if 38 <= t0 < 56 else 0.9)
    durb = BAR if b < 48 else 4.0
    if b == 49:
        continue
    for k, m in enumerate(c["pad"]):
        mus(pad_note(m, durb + 0.05), t0, g, pan=[-0.5, -0.15, 0.15, 0.5][k], send=0.4)

# piano : intro + pont (lecture) + outro, croches douces
for b in range(NBARS):
    t0 = b * BAR
    if not (t0 < 8 or 38 <= t0 < 56 or t0 >= 92):
        continue
    c = CH[chords[b]]
    notes = [c["pad"][0] - 12, c["pad"][1], c["pad"][2], c["pad"][3], c["pad"][2], c["pad"][1], c["pad"][3], c["pad"][2]]
    for i, m in enumerate(notes):
        t = t0 + i * BEAT / 2 * 2  # croches (0,25 s) sur 2 s → 8 notes
        t = t0 + i * 0.25
        if t >= 96.0:
            break
        mus(piano_note(m, vel=0.75 if i % 2 else 0.95), t, 0.8, pan=-0.2 + 0.4 * (i % 2), send=0.35)
# accord final
for m in [48, 55, 60, 64, 67, 72]:
    mus(piano_note(m, dur=4.5, vel=1.0), 96.0, 0.9, pan=(m - 60) / 30, send=0.6)
    mus(pad_note(m, 3.2, att=0.2, rel=1.0), 96.0, 0.6, pan=(m - 60) / 30, send=0.5)

# motif de cloche (la plume écrit)
for t, m in [(1.0, 76), (2.0, 81), (2.5, 79), (3.0, 76), (4.2, 72), (4.7, 76), (5.2, 84), (6.2, 83)]:
    mus(bell(m), t, 0.9, pan=0.3, send=0.6)

# arpège pincé en doubles-croches
for b in range(NBARS):
    t0 = b * BAR
    c = CH[chords[b]]
    pat = [0, 1, 2, 3, 2, 1, 2, 3]
    for i in range(16):
        t = t0 + i * 0.125
        if not in_range(t, ARP16):
            continue
        m = c["arp"][pat[i % 8]]
        acc = 1.0 if i % 4 == 0 else 0.7
        bright = 4200
        mus(pluck(m, vel=acc, bright=bright), t, 0.75, pan=0.45 if i % 2 else -0.45, send=0.3)

# lead (refrain)
LEADPAT = {
    "Am": [(0, 76, 1.5), (1.5, 74, 0.5), (2, 72, 1), (3, 74, 1)],
    "F": [(0, 72, 1.5), (1.5, 69, 0.5), (2, 72, 1), (3, 77, 1)],
    "C": [(0, 79, 1.5), (1.5, 76, 0.5), (2, 74, 1), (3, 72, 1)],
    "G": [(0, 74, 2), (2, 71, 1), (3, 74, 1)],
}
for b in range(NBARS):
    t0 = b * BAR
    if not in_range(t0, LEAD):
        continue
    for off, m, ln in LEADPAT[chords[b]]:
        mus(lead_note(m, ln * BEAT * 0.95), t0 + off * BEAT, 1.0, pan=0.1, send=0.45)

# basse
for b in range(NBARS):
    t0 = b * BAR
    c = CH[chords[b]]
    if 8 <= t0 < 14:  # logo : notes longues
        add(bass_bus, bass_note(c["bass"], 1.9), t0)
        continue
    for i in range(8):
        t = t0 + i * 0.25
        if in_range(t, BASS8):
            m = c["bass"] + (12 if i in (3, 7) else 0)
            add(bass_bus, bass_note(m, 0.22, vel=1.0 if i % 2 == 0 else 0.75), t)
    if in_range(t0, BREAK_PULSE):
        add(bass_bus, bass_note(c["bass"], 0.9, vel=0.8), t0)
        add(bass_bus, bass_note(c["bass"], 0.9, vel=0.7), t0 + 1.0)

# batterie
kick_times = []
for i in range(int(DUR / BEAT)):
    t = i * BEAT
    if in_range(t, DRUMS):
        if 8 <= t < 14 and (i % 2):  # logo : demi-temps
            continue
        kick_times.append(t)
        add(drums, kick(), t)
    if in_range(t, BREAK_PULSE) and i % 2 == 0:
        kick_times.append(t)
        add(drums, kick(0.7), t)
    if in_range(t, CLAP) and i % 2 == 1:
        add(drums, clap(), t)
        add(verb_send, clap(), t, 0.3)
    if in_range(t + 0.25, HATS):
        add(drums, hat(open_=(i % 4 == 3), vel=0.9), t + 0.25)
for i in range(int(DUR / 0.125)):
    t = i * 0.125
    if in_range(t, SHAKER):
        add(drums, shaker(1.0 if i % 2 else 0.6), t)
# claps du slogan + slams finaux
for t in (10.0, 10.5, 11.0, 86.5, 87.0, 87.5, 94.0, 94.5, 95.0):
    add(drums, clap(1.3), t)
    add(verb_send, clap(), t, 0.5)
# roulement de caisse claire (montée 74 → 77,5)
t = 82.0
while t < 85.5:
    span = (t - 82.0) / 3.5
    step = 0.25 if span < 0.4 else (0.125 if span < 0.75 else 0.0625)
    add(drums, snare(0.35 + 0.65 * span), t)
    t += step
# montées, impacts
add(verb_send, reverse_swell(2.0), 6.0, 0.5)
for t0, d in [(5.6, 2.4), (12.4, 1.6), (36.0, 2.0), (53.4, 2.0), (82.0, 3.95), (90.0, 2.4)]:
    sig = riser(d)
    add(music_L, sig, t0, 0.8)
    add(music_R, sig, t0, 0.8)
for t in (8.0, 86.0, 92.45):
    add(drums, impact(), t, 0.9)
    add(verb_send, impact(), t, 0.08)

# side-chain : la basse et les pads respirent avec la grosse caisse
duck = np.ones(N)
for t in kick_times:
    i0 = int(t * SR)
    n = int(0.28 * SR)
    seg = 1 - 0.55 * np.exp(-np.arange(n) / (0.07 * SR))
    end = min(N, i0 + n)
    duck[i0:end] = np.minimum(duck[i0:end], seg[: end - i0])
bass_bus *= duck
music_L *= 0.55 + 0.45 * duck
music_R *= 0.55 + 0.45 * duck

# réverbération (IR synthétique stéréo)
irn = int(2.4 * SR)
irt = tt(irn)
ir_l = rng.standard_normal(irn) * np.exp(-irt / 0.55)
ir_r = rng.standard_normal(irn) * np.exp(-irt / 0.55)
ir_l = lp(ir_l, 6000)
ir_r = lp(ir_r, 6000)
ir_l /= np.sqrt(np.sum(ir_l**2))
ir_r /= np.sqrt(np.sum(ir_r**2))
send = hp(verb_send, 250)
rev_l = fftconvolve(send, ir_l)[:N] * 0.9
rev_r = fftconvolve(send, ir_r)[:N] * 0.9

L = music_L + bass_bus + drums * 0.95 + rev_l
R = music_R + bass_bus + drums * 0.95 + rev_r

# ---------------------------------------------------------------- voix ElevenLabs
import json as _json
VOICE = _json.loads((ROOT / "assets" / "audio" / "voice.json").read_text(encoding="utf-8"))


def load_mono(p):
    wav = subprocess.run(["ffmpeg", "-v", "error", "-i", str(p), "-f", "wav", "-ac", "1", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    x, _ = sf.read(io.BytesIO(wav))
    return x


vduck = np.ones(N)
vtrack = np.zeros(N)
for i, vs in enumerate(VOICE["vs"]):
    v = load_mono(ROOT / "assets" / "audio" / f"voice-p{i}.mp3")
    v = hp(v, 80)
    add(vtrack, v, vs)
    a0, a1 = int((vs - 0.35) * SR), int((vs + len(v) / SR + 0.15) * SR)
    vduck[a0:a1] = 0.36  # ≈ -9 dB sous la voix
# lissage du ducking (attaque/relâche)
k = int(0.25 * SR)
vduck = np.convolve(vduck, np.ones(k) / k, "same")
L *= vduck
R *= vduck
vrms = np.sqrt(np.mean(vtrack[vtrack != 0] ** 2))
vtrack *= 0.22 / max(vrms, 1e-6)
rv = fftconvolve(vtrack, ir_l)[:N] * 0.06
L += vtrack + rv
R += vtrack + rv

# ---------------------------------------------------------------- SFX
SFX_DIR = ROOT / "assets" / "sfx"
_cache = {}


def load(name):
    if name not in _cache:
        wav = subprocess.run(
            ["ffmpeg", "-v", "error", "-i", str(SFX_DIR / f"{name}.mp3"), "-f", "wav", "-ac", "2", "-ar", str(SR), "-"],
            capture_output=True, check=True,
        ).stdout
        x, _ = sf.read(io.BytesIO(wav))
        w = int(0.02 * SR)
        env = np.sqrt(np.convolve(x.mean(axis=1) ** 2, np.ones(w) / w, "same"))
        x = x * (0.5 / max(env.max(), 1e-6))  # normalisation RMS de crête ≈ -6 dB
        onset = int(np.argmax(env > 0.1 * env.max()))
        _cache[name] = (x, onset)
    return _cache[name]


def sfx(name, t, gain=0.5, peak_align=False):
    x, onset = load(name)
    t0 = S(t) - onset / SR
    add(L, x[:, 0], t0, gain)
    add(R, x[:, 1], t0, gain)


EVENTS = []
E = EVENTS.append
# S1
E(("sparkle", 0.25, 0.30)); E(("whoosh-short", 2.0, 0.22)); E(("whoosh", 3.65, 0.32)); E(("sparkle", 4.2, 0.28))
E(("whoosh", 6.15, 0.28)); E(("whoosh-cinematic", 7.0, 0.45))
# S2
E(("chime", 8.05, 0.32))
for k in range(5):
    E(("click-soft", 8.55 + k * 0.075, 0.18))
E(("sparkle", 12.0, 0.3)); E(("whoosh-cinematic", 13.2, 0.4)); E(("pop", 14.55, 0.42)); E(("chime", 14.6, 0.22))
# S3
E(("whoosh-short", 15.15, 0.18))
for k in range(3):
    E(("whoosh-short", 16.5 + k * 0.16, 0.26))
E(("pop", 17.4, 0.36)); E(("whoosh-short", 18.3, 0.14)); E(("notification", 19.4, 0.26)); E(("whoosh-short", 20.7, 0.12))
E(("whoosh", 23.72, 0.4))
# S4
for k in range(7):
    E(("key-press", 24.7 + k * 0.13, 0.32))
for k in range(4):
    E(("pop", 24.9 + k * 0.1, 0.16))
E(("click", 26.2, 0.42)); E(("whoosh-short", 26.6, 0.18))
for k in range(6):
    E(("pop", 27.5 + k * 0.07, 0.18))
E(("click", 31.05, 0.42)); E(("whoosh", 31.45, 0.38))
# S5
E(("pop", 32.05, 0.26)); E(("whoosh-short", 32.9, 0.26)); E(("pop", 33.7, 0.3))
E(("click-soft", 34.3, 0.24)); E(("click-soft", 34.46, 0.24)); E(("click", 36.55, 0.45)); E(("whoosh", 37.25, 0.42))
# S6
E(("click", 39.4, 0.38)); E(("whoosh-short", 39.55, 0.2)); E(("click", 40.1, 0.38)); E(("click", 40.9, 0.38))
E(("whoosh-short", 41.5, 0.16)); E(("sparkle", 42.25, 0.26)); E(("pop", 42.7, 0.26)); E(("click", 43.1, 0.38))
E(("pop", 43.35, 0.3)); E(("whoosh-short", 44.4, 0.24)); E(("click", 44.95, 0.45)); E(("whoosh-cinematic", 47.4, 0.42))
# S7
for k in range(22):
    E(("key-press", 48.6 + k * 0.059, 0.2 + 0.08 * ((k * 7) % 3) / 2))
E(("click", 50.15, 0.4)); E(("click", 50.45, 0.4))
for k in range(37):
    E(("key-press", 50.8 + k * 0.06 + 0.012 * ((k * 5) % 3), 0.18 + 0.06 * ((k * 3) % 4) / 3))
E(("click", 53.4, 0.48)); E(("pop", 53.55, 0.45)); E(("sparkle", 53.6, 0.42)); E(("chime", 53.8, 0.3))
E(("whoosh", 54.9, 0.4)); E(("sparkle", 55.7, 0.2)); E(("pop", 56.6, 0.3)); E(("whoosh", 57.55, 0.4))
# S8
for t in (58.5, 59.3, 60.1):
    E(("pop", t, 0.34))
E(("click", 61.2, 0.4)); E(("sparkle", 61.3, 0.3)); E(("pop", 62.0, 0.34)); E(("pop", 62.5, 0.26))
E(("pop", 63.3, 0.34)); E(("whoosh-short", 63.75, 0.14)); E(("pop", 64.2, 0.26)); E(("pop", 64.9, 0.24))
E(("notification", 65.8, 0.32)); E(("pop", 66.0, 0.26))
for k in range(8):
    E(("pop", 66.35 + k * 0.06, 0.14))
E(("whoosh", 69.45, 0.4))
# S9
for k in range(6):
    E(("pop", 70.75 + k * 0.08, 0.14))
E(("impact-bass-1", 72.05, 0.35)); E(("chime", 72.1, 0.34)); E(("pop", 72.2, 0.32)); E(("whoosh-short", 72.9, 0.22))
E(("sparkle", 73.7, 0.36))
for k in range(3):
    E(("whoosh-short", 74.0 + k * 0.12, 0.22))
E(("whoosh-cinematic", 77.55, 0.42))
# S10
for t in (78.5, 79.0, 79.5):
    E(("pop", t, 0.3))
E(("whoosh-cinematic", 83.45, 0.42)); E(("chime", 84.5, 0.34))
for k in range(5):
    E(("click-soft", 85.0 + k * 0.07, 0.16))
for t in (86.0, 86.5, 87.0):
    E(("pop", t, 0.26))
E(("pop", 87.5, 0.32)); E(("sparkle", 88.2, 0.32))

for name, t, g in EVENTS:
    sfx(name, t, g)

# ---------------------------------------------------------------- master
mix = np.stack([L, R], axis=1)
mix = hp(mix.T, 28).T
# fondu de fin
fade0 = int(98.3 * SR)
mix[fade0:] *= np.linspace(1, 0, N - fade0)[:, None] ** 1.5
mix[: int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))[:, None]
# compression douce + limiteur
peak = np.max(np.abs(mix))
mix = mix / peak * 1.25
mix = np.tanh(mix) * 0.89
out_wav = ROOT / "assets" / "audio" / "soundtrack.wav"
out_mp3 = ROOT / "assets" / "audio" / "soundtrack.mp3"
out_wav.parent.mkdir(parents=True, exist_ok=True)
sf.write(out_wav, mix.astype(np.float32), SR, subtype="PCM_16")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(out_wav), "-codec:a", "libmp3lame", "-b:a", "256k", str(out_mp3)], check=True)
out_wav.unlink()
rms = 20 * np.log10(np.sqrt(np.mean(mix**2)))
print(f"soundtrack.mp3 écrit — {DUR:.0f} s, RMS {rms:.1f} dBFS, {len(EVENTS)} SFX")
