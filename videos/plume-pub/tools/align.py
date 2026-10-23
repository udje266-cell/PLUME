"""Aligne le texte exact de VOIX-OFF.txt sur les temps mot à mot de la
transcription (assets/audio/transcript.json) -> assets/audio/words.json.
Orthographe du script, temps mesurés dans la voix fournie."""
import json
import re
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path

root = Path(__file__).resolve().parent.parent
script = (root / 'VOIX-OFF.txt').read_text(encoding='utf-8').split('---', 1)[1]
asr = json.loads((root / 'assets/audio/transcript.json').read_text(encoding='utf-8'))

NUM = {'13': 'treize', '8': 'huit'}


def norm(t):
    t = NUM.get(t.strip('.,;:!?…'), t)
    t = unicodedata.normalize('NFD', t.lower())
    t = ''.join(c for c in t if unicodedata.category(c) != 'Mn')
    return re.sub(r"[^a-z0-9]", '', t)


# Mots du script, en gardant la ponctuation attachée (pour les sous-titres).
words = [w for w in re.split(r'\s+', script.strip()) if w and w not in ('…', '—', ':')]
# Rattache la ponctuation isolée au mot précédent.
merged = []
for w in re.split(r'\s+', script.strip()):
    if not w:
        continue
    if re.fullmatch(r"[…:;!?.,]+", w) and merged:
        merged[-1] += ' ' + w if w in (':', ';', '!', '?') else w
    else:
        merged.append(w)
words = merged
# Le texte parlé « l'interligne » est transcrit en deux mots ; on aligne mot à mot.
a = [norm(w) for w in words]
b = [norm(x['text']) for x in asr]
sm = SequenceMatcher(a=a, b=b, autojunk=False)
times = [None] * len(words)
for tag, i1, i2, j1, j2 in sm.get_opcodes():
    if tag == 'equal':
        for k in range(i2 - i1):
            times[i1 + k] = (asr[j1 + k]['start'], asr[j1 + k]['end'])
    elif tag == 'replace':
        # Répartit la plage ASR sur les mots du script.
        s, e = asr[j1]['start'], asr[j2 - 1]['end']
        n = i2 - i1
        for k in range(n):
            times[i1 + k] = (s + (e - s) * k / n, s + (e - s) * (k + 1) / n)
# Interpole les mots sans correspondance.
for i, t in enumerate(times):
    if t is None:
        prev = next((times[j][1] for j in range(i - 1, -1, -1) if times[j]), 0.0)
        nxt = next((times[j][0] for j in range(i + 1, len(times)) if times[j]), prev + 0.3)
        times[i] = (prev, max(prev + 0.05, nxt))
out = [{'text': w, 'start': round(s, 3), 'end': round(e, 3)} for w, (s, e) in zip(words, times)]
(root / 'assets/audio/words.json').write_text(json.dumps(out, ensure_ascii=False, indent=0), encoding='utf-8')
matched = sum(1 for tag, i1, i2, *_ in sm.get_opcodes() if tag == 'equal' for _ in range(i2 - i1))
print(f'{len(words)} mots du script, {matched} appariés directement')
