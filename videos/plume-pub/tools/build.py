#!/usr/bin/env python3
"""Génère index.html + compositions/*.html de la pub PLUME « Prends la plume ».

Tout est calé sur la voix (assets/audio/words.json) et sur les positions réelles
des éléments de l'interface relevées pendant les captures (assets/boxes/*.json).
Relancer après toute modification : python3 tools/build.py
"""
import json
import re
import unicodedata
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
W, H, TOTAL = 1080, 1920, 127.5
WORDS = json.loads((ROOT / 'assets/audio/words.json').read_text(encoding='utf-8'))

# ---------------------------------------------------------------- temps voix
def _n(t):
    t = unicodedata.normalize('NFD', t.lower())
    t = ''.join(c for c in t if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]', '', t)

WN = [_n(w['text']) for w in WORDS]


def at(phrase, occ=0, end=False):
    toks = [_n(x) for x in phrase.split()]
    hits = [i for i in range(len(WN) - len(toks) + 1) if WN[i:i + len(toks)] == toks]
    if len(hits) <= occ:  # mots élidés (« l'archipel ») : le premier mot peut finir par le jeton
        hits = [i for i in range(len(WN) - len(toks) + 1) if WN[i].endswith(toks[0]) and WN[i + 1:i + len(toks)] == toks[1:]]
    if len(hits) <= occ:
        raise KeyError(f'phrase introuvable : {phrase!r}')
    i = hits[occ]
    return WORDS[i + len(toks) - 1]['end'] if end else WORDS[i]['start']

# ------------------------------------------------------------- boîtes écran
_BOX = {}


def box(shot, pat, nth=0):
    if shot not in _BOX:
        _BOX[shot] = json.loads((ROOT / f'assets/boxes/{shot}.boxes.json').read_text(encoding='utf-8'))
    rx = re.compile(pat, re.I)
    m = [b for b in _BOX[shot] if any(rx.search(str(b[k])) for k in ('id', 'text', 'label') if b.get(k))]
    if len(m) <= nth:
        raise KeyError(f'{shot}: aucun élément pour {pat!r}')
    b = m[nth]
    return (b['x'], b['y'], b['w'], b['h'])


def union(*bs):
    x0 = min(b[0] for b in bs); y0 = min(b[1] for b in bs)
    x1 = max(b[0] + b[2] for b in bs); y1 = max(b[1] + b[3] for b in bs)
    return (x0, y0, x1 - x0, y1 - y0)


def pad(b, px=24, py=None):
    py = px if py is None else py
    return (max(0, b[0] - px), max(0, b[1] - py), b[2] + 2 * px, b[3] + 2 * py)

# ---------------------------------------------------------- téléphone (SPEC)
CAPW, CAPH = 1170, 2532
SH = 900.0
K = SH / CAPH
SW = CAPW * K
BZ = 13.0
PW, PH = SW + 2 * BZ, SH + 2 * BZ
PX, PY = (W - PW) / 2, 392.0
SX, SY = PX + BZ, PY + BZ
FOCUS_Y = 880.0   # où la caméra pose le contrôle visé (milieu de la bande utile)

GROUNDS = {'day': '#F4F0FB', 'sepia': '#EFE2CC', 'night': '#0F0A1C', 'brand': '#7C3AED', 'white': '#FFFFFF', 'oled': '#000000'}
INK, ACCENT = '#181224', '#7C3AED'

FONT_FACE = """@font-face{font-family:'Source Serif 4';src:url('assets/fonts/source-serif-4-var.woff2') format('woff2');font-weight:200 900;font-style:normal}
@font-face{font-family:'Source Serif 4';src:url('assets/fonts/source-serif-4-italic-var.woff2') format('woff2');font-weight:200 900;font-style:italic}"""

BASE_CSS = """#root{position:absolute;inset:0;overflow:hidden;font-family:'Inter',sans-serif}
.ground{position:absolute;inset:0}
.glow{position:absolute;left:50%;top:44%;width:1500px;height:1500px;margin:-750px 0 0 -750px;border-radius:50%;pointer-events:none}
.cam{position:absolute;left:0;top:0;width:1080px;height:1920px;transform-origin:0 0}
.phone{position:absolute;border-radius:70px;background:#17141F;box-shadow:0 46px 90px rgba(24,18,36,.30),0 0 0 2px #2a2533 inset}
.phone.dark{box-shadow:0 46px 90px rgba(0,0,0,.55),0 0 0 2px #3a3446 inset}
.screen{position:absolute;overflow:hidden;border-radius:56px;background:#fff}
.scr{position:absolute;left:0;top:0;width:100%;height:auto;display:block}
.island{position:absolute;left:50%;top:22px;width:118px;height:34px;margin-left:-59px;border-radius:20px;background:#0b0910}
.lift{position:absolute;overflow:hidden;border-radius:26px;background:#fff;box-shadow:0 40px 80px rgba(24,18,36,.35),0 0 0 1px rgba(124,58,237,.12)}
.lift img{position:absolute;max-width:none}
.kin{position:absolute;left:70px;right:70px;text-align:center;font-family:'Source Serif 4',serif;font-weight:700;letter-spacing:-.03em;line-height:1.0}
.kin span.w{display:inline-block;white-space:pre}
.cover{position:absolute;border-radius:10px;box-shadow:0 30px 60px rgba(24,18,36,.32);overflow:hidden}
.cover img{width:100%;height:100%;object-fit:cover;display:block}"""


def r(v):
    return round(v, 3)


def cam_x(b, zoom):
    """Centre horizontal visé : l'écran entier tant qu'il tient dans le cadre,
    sinon l'élément, borné pour ne jamais montrer de vide à côté du téléphone."""
    sc = SX + SW / 2
    if zoom * SW <= 1040:
        return sc
    ex = SX + (b[0] + b[2] / 2) * K
    half = 540 / zoom
    return min(max(ex, SX + half - 6), SX + SW - half + 6)


class Scene:
    def __init__(self, sid, t0, t1, ground='day', glow=True, phone=True, first=None, dark_phone=False):
        self.sid, self.t0, self.t1 = sid, t0, t1
        self.ground, self.glow = ground, glow
        self.back, self.front, self.css, self.js = [], [], [], []
        self.phone = phone
        self.dark_phone = dark_phone
        self.scr = []          # ids d'écrans dans le téléphone
        self.hidden = set()    # éléments cachés au départ (style CSS, pas de set à 0)
        self.cur = None
        self.n = 0
        if phone and first:
            self.screen(first, 0, 'none')

    def L(self, t):
        return r(t - self.t0)

    def uid(self, kind):
        self.n += 1
        return f'{self.sid}-{kind}{self.n}'

    def add(self, line):
        self.js.append(line)

    # --- écrans dans le téléphone -------------------------------------
    def screen(self, img, t, how='slide', dur=None, local=False):
        i = self.uid('s')
        self.scr.append((i, img))
        lt = r(t) if local else self.L(t)
        prev = self.cur
        self.cur = i
        if how == 'none':
            return i
        self.hidden.add(i)
        if how == 'slide':
            d = dur or 0.42
            self.add(f"tl.fromTo('#{i}',{{opacity:1,xPercent:100}},{{opacity:1,xPercent:0,duration:{d},ease:'power3.out',immediateRender:false}},{lt});")
            if prev:
                self.add(f"tl.to('#{prev}',{{xPercent:-28,filter:'brightness(.72)',duration:{d},ease:'power3.out'}},{lt});")
                self.add(f"tl.set('#{prev}',{{opacity:0}},{r(lt + d + .02)});")
        elif how == 'back':
            d = dur or 0.42
            self.add(f"tl.fromTo('#{i}',{{opacity:1,xPercent:-28,filter:'brightness(.72)'}},{{opacity:1,xPercent:0,filter:'brightness(1)',duration:{d},ease:'power3.out',immediateRender:false}},{lt});")
            if prev:
                self.add(f"tl.fromTo('#{prev}',{{zIndex:5}},{{xPercent:100,duration:{d},ease:'power3.out'}},{lt});")
                self.add(f"tl.set('#{prev}',{{opacity:0}},{r(lt + d + .02)});")
        elif how == 'sheet':
            d = dur or 0.5
            self.add(f"tl.fromTo('#{i}',{{opacity:1,clipPath:'inset(100% 0% 0% 0%)'}},{{opacity:1,clipPath:'inset(0% 0% 0% 0%)',duration:{d},ease:'expo.out',immediateRender:false}},{lt});")
            if prev:
                self.add(f"tl.set('#{prev}',{{opacity:0}},{r(lt + d + .02)});")
        elif how == 'fade':
            d = dur or 0.3
            self.add(f"tl.fromTo('#{i}',{{opacity:0}},{{opacity:1,duration:{d},ease:'power2.inOut',immediateRender:false}},{lt});")
            if prev:
                self.add(f"tl.set('#{prev}',{{opacity:0}},{r(lt + d + .02)});")
        elif how == 'cut':
            self.add(f"tl.set('#{i}',{{opacity:1}},{lt});")
            if prev:
                self.add(f"tl.set('#{prev}',{{opacity:0}},{lt});")
        return i

    def scroll(self, img, t, dy_cap, dur=2.6):
        """Défilement : l'écran courant monte de dy (px capture), le suivant prend le relais."""
        i = self.uid('s')
        self.scr.append((i, img))
        lt, prev, self.cur = self.L(t), self.cur, i
        dy = r(dy_cap * K)
        self.hidden.add(i)
        self.add(f"tl.fromTo('#{prev}',{{y:0}},{{y:{-dy},duration:{dur},ease:'none'}},{lt});")
        self.add(f"tl.fromTo('#{i}',{{opacity:0,y:{dy}}},{{opacity:1,y:0,duration:{dur},ease:'none',immediateRender:false}},{lt});")
        self.add(f"tl.set('#{prev}',{{opacity:0}},{r(lt + dur)});")

    # --- caméra ------------------------------------------------------
    def cam(self, t, b, zoom=1.9, dur=0.6, ease='power2.inOut', fy=FOCUS_Y, fx=540, local=False):
        cx = cam_x(b, zoom)
        cy = SY + (b[1] + b[3] / 2) * K
        tx, ty = fx - zoom * cx, fy - zoom * cy
        lt = r(t) if local else self.L(t)
        self.add(f"tl.to('#{self.sid}-cam',{{x:{r(tx)},y:{r(ty)},scale:{zoom},duration:{dur},ease:'{ease}',overwrite:'auto'}},{lt});")

    def cam_set(self, b, zoom=1.9, fy=FOCUS_Y, fx=540):
        cx = cam_x(b, zoom)
        cy = SY + (b[1] + b[3] / 2) * K
        self.add(f"tl.set('#{self.sid}-cam',{{x:{r(fx - zoom * cx)},y:{r(fy - zoom * cy)},scale:{zoom}}},0);")

    def home(self, t, dur=0.5, local=False):
        lt = r(t) if local else self.L(t)
        self.add(f"tl.to('#{self.sid}-cam',{{x:0,y:0,scale:1,duration:{dur},ease:'power2.inOut',overwrite:'auto'}},{lt});")

    # --- découpe soulevée ---------------------------------------------
    def lift(self, img, b, t, t_out=None, scale=1.7, to=(540, 900), radius=26, local=False, out='fade'):
        i = self.uid('l')
        x, y, w, h = b
        fw, fh = w * K * scale, h * K * scale
        left, top = to[0] - fw / 2, to[1] - fh / 2
        iw = CAPW * K * scale
        self.front.append(
            f'<div class="lift" id="{i}" style="opacity:0;left:{r(left)}px;top:{r(top)}px;width:{r(fw)}px;height:{r(fh)}px;border-radius:{radius}px">'
            f'<img src="assets/screens/{img}.png" alt="" style="width:{r(iw)}px;left:{r(-x * K * scale)}px;top:{r(-y * K * scale)}px"></div>')
        sx, sy = SX + (x + w / 2) * K, SY + (y + h / 2) * K
        lt = r(t) if local else self.L(t)
        self.add(f"tl.fromTo('#{i}',{{opacity:1,x:{r(sx - to[0])},y:{r(sy - to[1])},scale:{r(1 / scale)},boxShadow:'0 0 0 rgba(24,18,36,0)'}},"
                 f"{{opacity:1,x:0,y:0,scale:1,boxShadow:'0 40px 80px rgba(24,18,36,.35)',duration:.6,ease:'expo.out',immediateRender:false}},{lt});")
        if t_out is not None:
            lo = r(t_out) if local else self.L(t_out)
            if out == 'back':
                self.add(f"tl.to('#{i}',{{x:{r(sx - to[0])},y:{r(sy - to[1])},scale:{r(1 / scale)},boxShadow:'0 0 0 rgba(24,18,36,0)',duration:.35,ease:'power3.in'}},{lo});")
                self.add(f"tl.set('#{i}',{{opacity:0}},{r(lo + .36)});")
            else:
                self.add(f"tl.to('#{i}',{{opacity:0,scale:.94,filter:'blur(6px)',duration:.25,ease:'power3.in'}},{lo});")
        return i

    # --- mots cinétiques ---------------------------------------------
    def words(self, items, top, size, color='#fff', t_out=None, cls='', italic_words=(), align='center', local=False, lh=1.0, style=''):
        """items : liste de (mot, temps) ; '\\n' force une ligne."""
        i = self.uid('k')
        spans = []
        for j, (wd, t) in enumerate(items):
            if wd == '\n':
                spans.append('<br>')
                continue
            sid = f'{i}w{j}'
            it = ' font-style:italic;font-weight:600;' if wd.strip(' .,…') in italic_words else ''
            spans.append(f'<span class="w" id="{sid}" style="{it}">{escape(wd)}</span>')
            if t is None:
                continue
            lt = r(t) if local else self.L(t)
            self.add(f"tl.fromTo('#{sid}',{{opacity:0,filter:'blur(8px)'}},{{opacity:1,filter:'blur(0px)',duration:.16,ease:'power2.out'}},{max(0, lt - .04)});")
        self.front.append(f'<div class="kin {cls}" id="{i}" style="top:{top}px;font-size:{size}px;color:{color};text-align:{align};line-height:{lh};{style}">{" ".join(spans)}</div>')
        if t_out is not None:
            lo = r(t_out) if local else self.L(t_out)
            self.add(f"tl.to('#{i}',{{opacity:0,filter:'blur(8px)',duration:.22,ease:'power3.in'}},{lo});")
        return i

    def flood(self, t, color, dur=0.4, local=False):
        lt = r(t) if local else self.L(t)
        self.add(f"tl.to('#{self.sid}-ground',{{backgroundColor:'{color}',duration:{dur},ease:'power2.inOut'}},{lt});")

    # --- rendu -------------------------------------------------------
    def html(self):
        g = GROUNDS.get(self.ground, self.ground)
        glow = ''
        if self.glow:
            gc = 'rgba(255,255,255,.75)' if self.ground in ('day', 'sepia', 'white') else 'rgba(76,40,140,.45)'
            glow = f'<div class="glow" id="{self.sid}-glow" style="background:radial-gradient(circle,{gc} 0%,rgba(255,255,255,0) 62%)"></div>'
        phone = ''
        if self.phone:
            hid = ' style="opacity:0"'
            imgs = ''.join(f'<img class="scr" id="{i}" src="assets/screens/{img}.png" alt=""{hid if i in self.hidden else ""}>' for i, img in self.scr)
            phone = (f'<div class="cam" id="{self.sid}-cam"><div class="phone{" dark" if self.dark_phone else ""}" id="{self.sid}-phone" '
                     f'style="left:{r(PX)}px;top:{r(PY)}px;width:{r(PW)}px;height:{r(PH)}px">'
                     f'<div class="screen" style="left:{BZ}px;top:{BZ}px;width:{r(SW)}px;height:{r(SH)}px">{imgs}</div>'
                     f'<div class="island"></div></div></div>')
        dur = r(self.t1 - self.t0)
        js = '\n    '.join(self.js)
        return f"""<template id="{self.sid}-template">
  <style>
{FONT_FACE}
{BASE_CSS}
{chr(10).join(self.css)}
  </style>
  <div id="root" data-composition-id="{self.sid}" data-width="{W}" data-height="{H}" data-duration="{dur}" data-layout-allow-overflow>
    <div class="ground" id="{self.sid}-ground" style="background:{g}"></div>
    {glow}
    {''.join(self.back)}
    {phone}
    {''.join(self.front)}
  </div>
  <script>
    const tl = gsap.timeline({{ paused: true }});
    {js}
    window.__timelines["{self.sid}"] = tl;
  </script>
</template>
"""


def phone_in(s, t=0.0, frm='bottom', dur=0.75, local=True):
    lt = r(t) if local else s.L(t)
    if frm == 'bottom':
        s.add(f"tl.fromTo('#{s.sid}-phone',{{y:1250}},{{y:0,duration:{dur},ease:'expo.out'}},{lt});")
    elif frm == 'scale':
        s.add(f"tl.fromTo('#{s.sid}-phone',{{scale:.82,opacity:0}},{{scale:1,opacity:1,duration:{dur},ease:'expo.out'}},{lt});")


def phone_out(s, t, to='top', dur=0.4, local=False):
    lt = r(t) if local else s.L(t)
    if to == 'top':
        s.add(f"tl.to('#{s.sid}-phone',{{y:-1400,duration:{dur},ease:'power3.in'}},{lt});")
    elif to == 'left':
        s.add(f"tl.to('#{s.sid}-phone',{{x:-1100,duration:{dur},ease:'power3.in'}},{lt});")
    elif to == 'right':
        s.add(f"tl.to('#{s.sid}-phone',{{x:1100,duration:{dur},ease:'power3.in'}},{lt});")


def cover_html(sid, k, left, top, w, rot, z=1, extra=''):
    h = w * 1.5
    return (f'<div class="cover" id="{sid}" style="left:{r(left)}px;top:{r(top)}px;width:{r(w)}px;height:{r(h)}px;'
            f'transform:rotate({rot}deg);z-index:{z};{extra}"><img src="assets/demo/cover-{k}.{"jpg" if k == "hostel" else "png"}" alt=""></div>')


# ======================================================================
SCENES = []
SFX = []        # (temps absolu, fichier, volume)


def sfx(t, name, vol=0.5):
    SFX.append((round(t, 3), name, vol))


def T(p, occ=0, end=False):
    return at(p, occ, end)

T_ILS = at("Il s'écrit")
T_EDIT = at("l'éditeur immersif")

# ---------------------------------------------------------------- 01 accroche
s = Scene('s01', 0.0, 7.15, 'day', phone=True, first='editor')
s.back.append('')
covers = ['cartographe', 'nuit', 'chambre', 'hostel', 'lunes', 'dakar', 'lettres']
fan = []
for j, k in enumerate(covers):
    off = j - 3
    left = 540 + off * 128 - 120
    top = 1010 + abs(off) * 34
    s.back.append(cover_html(f's01-c{j}', k, left, top, 240, off * 7, z=10 - abs(off)))
# Titre présent dès l'image 0 (vignette TikTok), puis « n'est pas encore en librairie ».
s.words([('Ton', None), ('prochain', None), ('\n', 0), ('livre', None), ('préféré…', None)], top=360, size=132, color=INK, t_out=T('Il s\'écrit'))
s.words([('n’est', T("n'est")), ('pas', T('pas encore')), ('encore', T('encore en')), ('\n', 0), ('en', T('en librairie')), ('librairie.', T('librairie'))],
        top=700, size=76, color=ACCENT, t_out=T("Il s'écrit"))
# Les couvertures attendent, puis s'écartent quand le téléphone monte.
for j in range(len(covers)):
    off = j - 3
    s.add(f"tl.to('#s01-c{j}',{{x:{off * 260},y:{420 + abs(off) * 60},rotation:{off * 16},opacity:0,duration:.55,ease:'power3.in'}},{s.L(T_ILS - .45 + abs(off) * .03)});")
s.add(f"tl.set('#s01-phone',{{y:1700}},0);")
s.add(f"tl.to('#s01-phone',{{y:0,duration:.8,ease:'expo.out'}},{s.L(T_ILS - .1)});")
sfx(T("Il s'écrit") - .2, 'whoosh', .45)
# Les mots apparaissent dans l'éditeur (« Il s'écrit en ce moment »).
s.cam(T_ILS + .45, box('editor-written', r'Nadia ouvrit|Cette nuit'), zoom=2.0, dur=.7, fy=760)
ew = s.screen('editor-written', T('en ce moment'), 'cut')
s.add(f"tl.fromTo('#{ew}',{{clipPath:'inset(0% 0% 92% 0%)'}},{{clipPath:'inset(0% 0% 0% 0%)',duration:1.1,ease:'power1.inOut'}},{s.L(T('en ce moment'))});")
s.home(T('chapitre après') - .35, .4)
s.screen('workshop', T('chapitre après'), 'slide')
s.cam(T('chapitre après') + .35, box('workshop', r'CHAPITRES RÉDIGÉS|Chapitres rédigés'), zoom=1.55, dur=.7, fy=760)
SCENES.append(s)

# --------------------------------------------------------------- 02 « Sur PLUME »
s = Scene('s02', 7.15, 8.35, 'brand', glow=False, phone=False)
s.words([('Sur', T('Sur PLUME'))], top=640, size=64, color='#E9DDFF')
s.words([('PLUME', T('PLUME', 0) - .02)], top=730, size=230, color='#FFFFFF', style='letter-spacing:.02em')
s.add("tl.fromTo('#s02-ground',{clipPath:'circle(0% at 50% 62%)'},{clipPath:'circle(150% at 50% 62%)',duration:.45,ease:'power3.out'},0);")
sfx(7.15, 'whoosh-cinematic', .35)
SCENES.append(s)

# ------------------------------------------------------------ 03 la mission
s = Scene('s03', 8.35, 16.05, 'day', first='home')
# Le mot PLUME (aplat violet) rétrécit vers le logo de l'en-tête pendant que l'accueil se construit.
s.front.append('<div id="s03-flood" style="position:absolute;inset:0;background:#7C3AED"></div>')
s.front.append('<div id="s03-word" class="kin" style="top:730px;font-size:230px;color:#fff;letter-spacing:.02em">PLUME</div>')
hb = box('home', r'Accueil PLUME|PLUME')
hx, hy = SX + (hb[0] + hb[2] / 2) * K, SY + (hb[1] + hb[3] / 2) * K
s.add("tl.to('#s03-flood',{opacity:0,duration:.45,ease:'power2.inOut'},0.05);")
s.add(f"tl.to('#s03-word',{{x:{r(hx - 540)},y:{r(hy - 845)},scale:.12,opacity:0,duration:.55,ease:'power3.inOut'}},0.0);")
phone_in(s, 0.0, 'scale', .7)
s.cam(T('archipel') - .1, box('home', r'Bonjour'), zoom=1.6, dur=.7, fy=820)
s.cam(T('lire', 0) - .2, box('home', 'resume-reading-card'), zoom=1.6)
s.cam(T('écrire', 0) - .2, box('home', 'nav-tab-write'), zoom=2.3, dur=.5)
s.cam(T('partager', 0) - .2, box('home', 'nav-tab-messages'), zoom=2.3, dur=.45)
s.home(T('les histoires qui') - .1, .6)
s.cam(T('font vibrer') - .3, box('home', r'^section.*À la une|À la une'), zoom=1.45, dur=.7)
sfx(T('écrire', 0) - .1, 'click-soft', .35)
sfx(T('partager', 0) - .1, 'click-soft', .35)
SCENES.append(s)

# ------------------------------------------------------------ 04 découvrir
s = Scene('s04', 16.05, 27.15, 'day', first='home')
gen = [('Romance', 'nuit', T('Romance')), ('Fantasy', 'cartographe', T('fantasy')), ('Thriller', 'chambre', T('thriller')), ('Huis clos', 'hostel', T('huis clos'))]
s.add("tl.to('#s04-phone',{x:300,scale:.86,duration:.6,ease:'power3.inOut'},0);")
for j, (label, k, t) in enumerate(gen):
    left, top = 70 + (j % 2) * 250, 470 + (j // 2) * 420
    cid = f's04-c{j}'
    s.front.append(cover_html(cid, k, left, top, 210, (-4, 3, 2, -3)[j], z=5))
    s.front.append(f'<div class="kin" id="s04-g{j}" style="left:{left - 30}px;right:auto;width:270px;top:{top + 322}px;font-size:40px;color:{INK}">{label}</div>')
    s.add(f"tl.fromTo('#{cid}',{{opacity:0,y:120,scale:.8}},{{opacity:1,y:0,scale:1,duration:.55,ease:'expo.out'}},{s.L(t) - .05});")
    s.add(f"tl.fromTo('#s04-g{j}',{{opacity:0,filter:'blur(8px)'}},{{opacity:1,filter:'blur(0px)',duration:.16}},{s.L(t)});")
    sfx(t, 'pop', .3)
gout = T("L'accueil")
for j in range(4):
    s.add(f"tl.to(['#s04-c{j}','#s04-g{j}'],{{opacity:0,x:260,scale:.6,duration:.4,ease:'power3.in'}},{s.L(gout) - .3 + j * .04});")
s.add(f"tl.to('#s04-phone',{{x:0,scale:1,duration:.6,ease:'power3.inOut'}},{s.L(gout) - .25});")
s.screen('home-scroll', gout + .1, 'fade', .35)
s.cam(T('des pépites') - .2, box('home-scroll', r'^section.*Pour vous|Pour vous'), zoom=1.45, dur=.7)
s.home(T('Cherche un titre') - .3)
s.screen('home-search', T('Cherche un titre'), 'fade', .25)
s.cam(T('Cherche un titre') + .2, union(box('home-search', r'Rechercher un livre|lune'), box('home-search', 'Neuf Lunes')), zoom=1.75)
s.home(T('filtre par genre') - .45)
s.screen('explorer-fantasy', T('filtre par genre') - .2, 'slide')
s.cam(T('filtre par genre') + .3, box('explorer-fantasy', r'Genre littéraire'), zoom=1.75, fy=760)
s.home(T('en un geste') + .2, .6)
sfx(T('filtre par genre') - .2, 'click-soft', .3)
SCENES.append(s)

# ------------------------------------------------------------ 05 la fiche
s = Scene('s05', 27.15, 33.55, 'day', first='explorer-fantasy')
s.screen('detail', T('Ouvre une fiche'), 'slide')
sfx(T('Ouvre une fiche'), 'click-soft', .3)
s.cam(T('le synopsis') - .15, box('detail', '^Synopsis$'), zoom=1.55, fy=700)
s.cam(T('les chapitres') - .15, box('detail', '^Chapitres$'), zoom=1.55, fy=700)
s.cam(T('le temps de lecture') - .1, union(box('detail', '8 chapitre'), box('detail', '~4 min')), zoom=2.1)
s.home(T('Un toucher') - .1, .45)
# « tu plonges » : la couverture grandit jusqu'à devenir la page (objet -> monde).
cv = box('detail', r'^img$|Cartographe', 0)
cb = (cv[0], cv[1], cv[2], cv[3])
cvx, cvy = SX + (cb[0] + cb[2] / 2) * K, SY + (cb[1] + cb[3] / 2) * K
cw = cb[2] * K
s.front.append(f'<div class="cover" id="s05-cv" style="opacity:0;left:{r(cvx - cw / 2)}px;top:{r(cvy - cw * .75)}px;width:{r(cw)}px;height:{r(cw * 1.5)}px;border-radius:6px"><img src="assets/demo/cover-cartographe.png" alt=""></div>')
s.front.append(f'<div id="s05-page" style="opacity:0;position:absolute;inset:0;background:{GROUNDS["sepia"]}"></div>')
tp = s.L(T('tu plonges'))
s.add(f"tl.set('#s05-cv',{{opacity:1}},{tp - .35});")
s.add(f"tl.to('#s05-cv',{{x:{r(540 - cvx)},y:{r(960 - cvy)},scale:{r(2100 / (cw * 1.5))},duration:.75,ease:'power3.in'}},{tp - .35});")
s.add(f"tl.to('#s05-page',{{opacity:1,duration:.3,ease:'power2.in'}},{tp + .15});")
sfx(T('tu plonges') - .3, 'whoosh', .4)
SCENES.append(s)

# ------------------------------------------------------------ 06 lire
s = Scene('s06', 33.55, 46.10, 'sepia', first='reader')
phone_in(s, 0.0, 'scale', .6)
s.cam(T('à ta façon') - .4, box('reader', r'La carte qui respirait'), zoom=1.6, dur=.7, fy=820)
s.home(T('Huit thèmes') - .45, .4)
s.screen('reader-settings', T('Huit thèmes') - .15, 'sheet')
th = box('reader-settings', r'^Thème$')
s.lift('reader-settings', (30, th[1] - 24, 1110, 2380 - th[1]), T('Huit thèmes') + .05, T('la taille') - .1, scale=1.3, to=(540, 880))
s.cam(T('la taille') + .1, box('reader-settings', r'Taille du texte'), zoom=1.8, fy=820)
s.home(T('Lis en clair') - .35, .35)
s.screen('reader-clair', T('Lis en clair'), 'fade', .2)
s.flood(T('Lis en clair'), GROUNDS['white'], .25)
s.screen('reader-sepia', T('en sépia'), 'fade', .2)
s.flood(T('en sépia'), GROUNDS['sepia'], .25)
s.screen('reader-oled', T('dans le noir'), 'fade', .25)
s.flood(T('dans le noir'), GROUNDS['oled'], .3)
s.add(f"tl.to('#s06-glow',{{opacity:0,duration:.3}},{s.L(T('dans le noir'))});")
s.screen('reader-sepia', T('Et laisse le défilement') - .1, 'fade', .3)
s.flood(T('Et laisse le défilement') - .1, GROUNDS['sepia'], .35)
s.add(f"tl.to('#s06-glow',{{opacity:1,duration:.3}},{s.L(T('Et laisse le défilement'))});")
s.cam(T('défilement automatique') - .3, box('reader-sepia', r'Lancer le défilement'), zoom=2.3, dur=.5, fy=760)
s.home(T('tourner les pages') - .45, .45)
a0 = box('reader-sepia', 'p-idx-1'); a1 = box('reader-autoscroll', 'p-idx-1')
s.scroll('reader-autoscroll', T('tourner les pages') - .1, a0[1] - a1[1], dur=2.2)
sfx(T('Lis en clair'), 'click-soft', .3)
sfx(T('dans le noir'), 'click-soft', .3)
SCENES.append(s)

# ------------------------------------------------------------ 07 écouter
s = Scene('s07', 46.10, 53.27, 'night', first='reader-oled', dark_phone=True)
s.add("tl.fromTo('#s07-ground',{backgroundColor:'#EFE2CC'},{backgroundColor:'#0F0A1C',duration:.5,ease:'power2.inOut'},0);")
s.cam(T('Écoute ton livre') - .3, union(box('reader-oled', r'Lecture audio'), box('reader-oled', r'Écouter ce chapitre', 1)), zoom=2.0, fy=820)
s.home(T('bercé par') - .35, .35)
s.screen('ambience', T('bercé par') - .1, 'sheet')
amb = union(box('ambience', r'Ambiance sonore'), box('ambience', r'Vent'))
s.lift('ambience', pad(amb, 20), T('la pluie') - .1, T('Et télécharge-le') - .1, scale=1.75, to=(540, 860))
s.screen('download-done', T('Et télécharge-le') - .05, 'fade', .25)
s.cam(T('Et télécharge-le') + .2, box('download-done', r'reader-download-btn|Télécharg'), zoom=2.6, dur=.55, fy=760)
s.home(T('même sans connexion') + .3, .5)
sfx(T('la pluie'), 'pop', .3)
sfx(T('Et télécharge-le'), 'click-soft', .35)
SCENES.append(s)

# ------------------------------------------------------------ 08 les passages
s = Scene('s08', 53.27, 61.82, 'sepia', first='reader-sepia')
s.add("tl.fromTo('#s08-ground',{backgroundColor:'#0F0A1C'},{backgroundColor:'#EFE2CC',duration:.45,ease:'power2.inOut'},0);")
s.add("tl.fromTo('#s08-glow',{opacity:0},{opacity:1,duration:.45},0);")
s.screen('passage-tools', T('Une phrase te frappe') + .15, 'fade', .25)
p3 = box('passage-tools', 'p-idx-3')
s.cam(T('te frappe') - .1, p3, zoom=1.55, fy=860)
s.screen('passage-highlight', T('Surligne-la') - .05, 'fade', .2)
s.home(T('annote-la') - .2, .35)
s.screen('passage-note', T('annote-la') - .05, 'fade', .2)
s.cam(T('annote-la') + .15, box('passage-note', r'Ma note|Ce que l'), zoom=1.6, fy=820)
s.home(T('fais-en une citation') - .1, .35)
s.screen('plumecard', T('fais-en une citation'), 'sheet')
s.cam(T('à partager') - .25, box('plumecard', r'CONTENU DE LA CITATION|Contenu de la citation'), zoom=1.7, fy=880)
s.home(T('Et découvre ce que') - .2, .35)
s.screen('comments', T('Et découvre ce que') - .05, 'sheet')
cm = box('comments', 'Malik Diallo')
cmc = union(cm, box('comments', r'Merci Malik'))
s.lift('comments', pad(cmc, 40, 30), T('pensent') - .2, None, scale=1.7, to=(540, 900))
s.add(f"tl.to('#s08-phone',{{opacity:.35,duration:.3}},{s.L(T('pensent') - .2)});")
sfx(T('Surligne-la'), 'pop', .3)
sfx(T('pensent') - .2, 'whoosh-short', .3)
SCENES.append(s)

# ------------------------------------------------------------ 09 bibliothèque
s = Scene('s09', 61.82, 69.78, 'day', first='library')
phone_in(s, 0.0, 'scale', .6)
s.cam(T('tes lectures en cours') - .2, box('library', r'Reprendre une histoire'), zoom=1.45, dur=.6, fy=760)
s.cam(T('celles à venir') - .15, box('library', r'^À lire'), zoom=2.0, dur=.45)
s.home(T('tes collections') - .3, .35)
s.screen('library-collections', T('tes collections') - .1, 'fade', .25)
# « Tu changes d'appareil ? » : un deuxième téléphone, sombre, au même endroit du même livre.
s.front.append(f'<div class="phone dark" id="s09-p2" style="opacity:0;left:{r(PX)}px;top:{r(PY)}px;width:{r(PW)}px;height:{r(PH)}px">'
               f'<div class="screen" style="left:{BZ}px;top:{BZ}px;width:{r(SW)}px;height:{r(SH)}px;background:#000"><img class="scr" id="s09-p2a" src="assets/screens/home-dark.png" alt="">'
               f'<img class="scr" id="s09-p2b" src="assets/screens/reader-oled.png" alt="" style="opacity:0"></div><div class="island"></div></div>')
tc = T("Tu changes d'appareil")
s.add(f"tl.to('#s09-phone',{{x:-250,scale:.78,duration:.6,ease:'power3.inOut'}},{s.L(tc) - .2});")
s.add(f"tl.fromTo('#s09-p2',{{opacity:1,x:900,scale:.78}},{{opacity:1,x:250,duration:.6,ease:'power3.out',immediateRender:false}},{s.L(tc) - .1});")
tr_ = T('Tu reprends au paragraphe')
s.add(f"tl.to('#s09-phone',{{x:-1100,duration:.45,ease:'power3.in'}},{s.L(tr_) - .1});")
s.add(f"tl.to('#s09-p2',{{x:0,scale:1,duration:.55,ease:'power3.inOut'}},{s.L(tr_) - .05});")
s.add(f"tl.fromTo('#s09-p2b',{{opacity:0}},{{opacity:1,duration:.25,immediateRender:false}},{s.L(tr_) + .35});")
s.flood(tr_ + .2, GROUNDS['night'], .5)
sfx(tc - .1, 'whoosh-short', .35)
SCENES.append(s)

# ------------------------------------------------------------ 10 partager
s = Scene('s10', 69.78, 77.42, 'day', first='inbox')
s.add("tl.fromTo('#s10-ground',{backgroundColor:'#0F0A1C'},{backgroundColor:'#F4F0FB',duration:.45,ease:'power2.inOut'},0);")
s.add("tl.fromTo('#s10-glow',{opacity:0},{opacity:1,duration:.45},0);")
phone_in(s, 0.0, 'scale', .6)
s.screen('chat', T('Envoie un livre') - .1, 'slide')
sfx(T('Envoie un livre') - .1, 'click-soft', .3)
share = box('chat', r'Voir le livre')
card = union(box('chat', r'La Cartographe des Marées', 0), share)
s.lift('chat', pad(card, 30), T('à un ami') - .15, T('cache tes spoilers') - .15, scale=1.65, to=(540, 860), out='back')
sp = box('chat', r'Toucher pour révéler')
s.cam(T('cache tes spoilers') + .05, pad(union(box('chat', r'^Spoiler$'), sp), 30), zoom=2.0, fy=860)
s.screen('chat-reveal', T('cache tes spoilers') + .75, 'fade', .2)
s.cam(T('note vocale') - .3, box('chat-reveal', r'Note vocale'), zoom=1.9, fy=860)
s.cam(T('ou appelle-le') - .05, box('chat-reveal', r'Appel|Lancer un appel|appel', 0), zoom=3.0, dur=.5, fy=760)
s.home(T('directement') + .25, .5)
sfx(T('cache tes spoilers') + .75, 'pop', .3)
SCENES.append(s)

# ------------------------------------------------------------ 11 club
s = Scene('s11', 77.42, 82.14, 'day', first='chat-reveal')
s.screen('clubs', T('Crée ton club'), 'slide')
s.cam(T('Crée ton club') + .25, union(box('clubs', r'Créer un club'), box('clubs', r'Les Nuits Blanches')), zoom=1.7, fy=820)
s.home(T('lance des sondages') - .3, .3)
s.screen('club', T('lance des sondages') - .1, 'slide')
s.cam(T('lance des sondages') + .3, box('club', r'Chambre 317'), zoom=2.0, fy=900)
s.home(T('et suis en direct') - .25, .3)
s.screen('club-top', T('et suis en direct') - .05, 'fade', .25)
s.cam(T('en direct') + .1, box('club-top', r'Lecture en direct'), zoom=1.9, fy=640, fx=560)
sfx(T('Crée ton club'), 'click-soft', .3)
SCENES.append(s)

# ------------------------------------------------------------ 12 progresser
s = Scene('s12', 82.14, 88.18, 'day', first='profile')
s.screen('profile-journey', T('Chaque chapitre lu') + .1, 'fade', .3)
s.cam(T("gagner de l'expérience") - .3, box('profile-journey', r'Mon parcours'), zoom=1.65, fy=760)
s.cam(T('Monte en niveau') - .1, box('profile-journey', r'Niveau'), zoom=2.2, fy=860)
s.home(T('débloque des trophées') - .3, .35)
s.screen('trophies', T('débloque des trophées') - .1, 'sheet')
s.cam(T('trophées') + .1, box('trophies', r'Progression globale|PROGRESSION GLOBALE'), zoom=1.7, fy=880)
s.home(T('et des légendes') - .25, .3)
s.screen('profile-legends', T('et des légendes') - .05, 'fade', .2)
lg = box('profile-legends', r'Le Sans Faute')
lgc = union(box('profile-legends', r'LÉGENDE DÉBLOQUÉE|Légende débloquée'), box('profile-legends', r'MAGNIFIQUE|Magnifique'))
s.lift('profile-legends', pad(lgc, 10), T('légendes') - .05, None, scale=1.45, to=(540, 860), radius=40)
sfx(T('légendes') - .05, 'sparkle', .45)
SCENES.append(s)

# ------------------------------------------------------------ 13 la bascule
s = Scene('s13', 88.18, 91.10, 'day', first='write')
s.screen('home', 0.0, 'cut', local=True)
fab = box('home', 'nav-tab-write')
s.cam(T('Et puis un jour') + .1, fab, zoom=2.4, dur=.9, ease='power2.inOut', fy=900)
# Zoom à travers le bouton plume : son violet devient le monde.
s.front.append('<div id="s13-iris" style="position:absolute;inset:0;background:#7C3AED"></div>')
tz = s.L(T("c'est toi qui"))
fx_, fy_ = 540, 900
s.add(f"tl.fromTo('#s13-iris',{{clipPath:'circle(0px at {fx_}px {fy_}px)'}},{{clipPath:'circle(1500px at {fx_}px {fy_}px)',duration:.4,ease:'power3.in'}},{tz - .25});")
s.words([("c’est", T("c'est toi")), ('toi', T('toi qui')), ('qui', T('qui prends')), ('\n', 0), ('prends', T('prends')), ('la', T('la plume')), ('plume.', T('plume', 2))],
        top=700, size=118, color='#fff', italic_words=('plume',))
sfx(T("c'est toi") - .25, 'whoosh-cinematic', .4)
SCENES.append(s)

# ------------------------------------------------------------ 14 l'atelier
s = Scene('s14', 91.10, 102.10, 'day', first='write')
s.front.append('<div id="s14-iris" style="position:absolute;inset:0;background:#7C3AED"></div>')
plus = box('write', r'add-story-studio-btn|Nouvelle histoire')
px_, py_ = SX + (plus[0] + plus[2] / 2) * K, SY + (plus[1] + plus[3] / 2) * K
s.add(f"tl.fromTo('#s14-iris',{{clipPath:'circle(1500px at {r(px_)}px {r(py_)}px)'}},{{clipPath:'circle(0px at {r(px_)}px {r(py_)}px)',duration:.55,ease:'power3.inOut'}},0.3);")
s.words([("c’est", None), ('toi', None), ('qui', None), ('\n', 0), ('prends', None), ('la', None), ('plume.', None)], top=700, size=118, color='#fff', italic_words=('plume',), t_out=0.28, local=True)
s.cam(T("l'atelier") - .1, box('write', r"Atelier d’écriture|Atelier d'écriture"), zoom=1.7, fy=760)
s.home(T('crée ton histoire') - .3, .35)
s.screen('create', T('crée ton histoire'), 'slide')
sfx(T('crée ton histoire'), 'click-soft', .3)
s.cam(T('la couverture') - .15, box('create', r"COUVERTURE DE L'HISTOIRE|Couverture de l"), zoom=1.75, fy=760)
s.home(T('les genres') - .35, .3)
s.screen('create-2', T('les genres') - .1, 'fade', .25)
s.cam(T('les genres') + .1, box('create-2', r'GENRES PRINCIPAUX|Genres principaux'), zoom=1.6, fy=700)
s.cam(T("l'ambiance") - .1, box('create-2', r'^AMBIANCE$|^Ambiance$'), zoom=2.0, fy=860)
s.cam(T('en chapitres') - .15, union(box('create-2', r'Par chapitres'), box('create-2', r'Par tomes')), zoom=1.8, fy=900)
s.home(T('Importe ton manuscrit') - .3, .35)
s.screen('workshop', T('Importe ton manuscrit') - .1, 'slide')
s.cam(T('Importe ton manuscrit') + .25, box('workshop', r'^Importer$'), zoom=2.3, fy=820)
s.home(T('ou écris directement') - .2, .35)
s.screen('editor', T('ou écris directement'), 'slide')
ew = s.screen('editor-written', T("l'éditeur immersif") - .4, 'cut')
s.add(f"tl.fromTo('#{ew}',{{clipPath:'inset(0% 0% 86% 0%)'}},{{clipPath:'inset(0% 0% 0% 0%)',duration:1.4,ease:'none'}},{s.L(T_EDIT - .4)});")
s.cam(T("l'éditeur immersif") - .3, box('editor-written', r'Nadia ouvrit|Cette nuit'), zoom=1.55, fy=760, dur=.8)
SCENES.append(s)

# ------------------------------------------------------------ 15 l'assistant
s = Scene('s15', 102.10, 110.25, 'day', first='editor-written')
s.cam_set(box('editor-written', r'Nadia ouvrit|Cette nuit'), zoom=1.55, fy=760)
s.cam(T('Besoin d\'un coup') + .1, box('editor-written', r"Assistant d'écriture IA|Assistant"), zoom=2.6, dur=.6, fy=900)
s.home(T("L'assistant") - .3, .35)
s.screen('ai-menu', T("L'assistant") - .05, 'sheet')
rows = [('découpe tes paragraphes', r'Découper en paragraphes'), ('soigne la ponctuation', r'Typographie & ponctuation'), ('te suggère un titre', r'Suggérer un titre')]
for j, (ph, pat) in enumerate(rows):
    b = box('ai-menu', pat)
    rowb = (60, b[1] - 40, 1050, b[3] + 120)
    t_in = T(ph) - .15
    t_out = T(rows[j + 1][0]) - .2 if j < 2 else T("Mais l'histoire") - .1
    s.lift('ai-menu', rowb, t_in, t_out, scale=1.55, to=(540, 860 + (j - 1) * 0))
    sfx(t_in + .05, 'pop', .25)
s.screen('editor-written', T("Mais l'histoire") - .1, 'fade', .35)
s.flood(T("Mais l'histoire") - .1, GROUNDS['night'], .5)
s.cam(T('reste la tienne') - .6, box('editor-written', r'Au loin|Nadia comprit|Nadia ouvrit'), zoom=1.7, fy=880, dur=.9)
SCENES.append(s)

# ------------------------------------------------------------ 16 publier
s = Scene('s16', 110.25, 118.78, 'day', first='workshop')
s.add("tl.fromTo('#s16-ground',{backgroundColor:'#0F0A1C'},{backgroundColor:'#F4F0FB',duration:.45,ease:'power2.inOut'},0);")
s.add("tl.fromTo('#s16-glow',{opacity:0},{opacity:1,duration:.45},0);")
phone_in(s, 0.0, 'scale', .55)
ch4 = union(box('workshop', r'Nuit sans lune'), box('workshop', r'Mettre en ligne'))
s.cam_set(ch4, zoom=1.9, fy=880)
s.screen('published', T('Publie') + .15, 'cut')
sfx(T('Publie') + .1, 'click-soft', .4)
s.home(T('tes abonnés') - .1, .4)
nb = box('notif-malik', r'Nouveau chapitre', 0)
nrow = (36, nb[1] - 60, 1098, 260)
s.lift('notif-malik', nrow, T('sont prévenus') - .2, T('Suis tes lectures') - .2, scale=1.55, to=(540, 520))
sfx(T('sont prévenus') - .2, 'pop', .35)
s.screen('stats', T('Suis tes lectures') - .1, 'slide')
s.cam(T('Suis tes lectures') + .2, box('stats', r'^Lectures$'), zoom=2.1, fy=860)
s.cam(T('tes commentaires') - .15, box('stats', r'^Commentaires$'), zoom=2.1, fy=860)
s.home(T('et repère le chapitre') - .3, .35)
s.screen('stats-funnel', T('et repère le chapitre') - .05, 'fade', .25)
dc = box('stats-funnel', r'décrochage', 0)
s.cam(T('tes lecteurs décrochent') - .2, dc, zoom=2.5, fy=860, dur=.55)
s.home(T('pour qu\'ils ne') + .2, .7)
SCENES.append(s)

# ------------------------------------------------------------ 17 affirmation
s = Scene('s17', 118.78, 121.42, 'brand', glow=False, phone=False)
s.add("tl.fromTo('#s17-ground',{clipPath:'inset(100% 0% 0% 0%)'},{clipPath:'inset(0% 0% 0% 0%)',duration:.45,ease:'power3.out'},0);")
for j, (wd, t) in enumerate([('Lire.', T('Lire', 2)), ('Écrire.', T('Écrire', 1)), ('Partager.', T('Partager', 2))]):
    s.words([(wd, t)], top=470 + j * 250, size=200, color='#fff')
    sfx(t, 'pop', .3)
SCENES.append(s)

# ------------------------------------------------------------ 18 fin
s = Scene('s18', 121.42, TOTAL, 'white', glow=False, phone=False)
s.css.append(""".brandrow{position:absolute;left:0;right:0;top:560px;display:flex;align-items:center;justify-content:center;gap:34px}
#s18-feather{width:230px;height:auto}
#s18-mark{position:absolute;left:0;right:0;top:560px;text-align:center}
#s18-avail{position:absolute;left:0;right:0;top:1010px;text-align:center;font:600 54px/1.1 'Inter',sans-serif;color:#181224;letter-spacing:-.01em}
.store{display:flex;align-items:center;gap:22px;padding:24px 40px;border-radius:30px;background:#181224;color:#fff;font:700 52px/1 'Inter',sans-serif}
.store svg{width:58px;height:58px}
#s18-stores{position:absolute;left:0;right:0;top:1120px;display:flex;justify-content:center;gap:34px}""")
s.front.append(f'<div id="s18-mark"><img id="s18-logo" src="assets/brand/logo-plume-hd.png" alt="PLUME" style="width:700px;height:auto"></div>')
android = (ROOT / 'assets/brand/android.svg').read_text(encoding='utf-8').replace('<svg ', '<svg fill="#3DDC84" ')
apple = (ROOT / 'assets/brand/apple.svg').read_text(encoding='utf-8').replace('<svg ', '<svg fill="#FFFFFF" ')
s.front.append('<div id="s18-avail"><span id="s18-av1" style="opacity:0;display:inline-block">Bientôt disponible sur</span></div>')
s.front.append(f'<div id="s18-stores"><div class="store" id="s18-and" style="opacity:0">{android}<span>Android</span></div><div class="store" id="s18-ios" style="opacity:0">{apple}<span>iOS</span></div></div>')
tP = s.L(T('PLUME', 3))
# La plume est « tracée » de bas en haut, puis le mot se dévoile.
s.add(f"tl.fromTo('#s18-logo',{{opacity:1,clipPath:'inset(0% 100% 0% 0%)',scale:1.06}},{{clipPath:'inset(0% 0% 0% 0%)',scale:1,duration:.9,ease:'power3.out'}},{max(0, tP - .1)});")
s.add(f"tl.fromTo('#s18-av1',{{opacity:0,filter:'blur(8px)'}},{{opacity:1,filter:'blur(0px)',duration:.25,immediateRender:false}},{s.L(T('Bientôt'))});")
s.add(f"tl.fromTo('#s18-and',{{opacity:0,y:40}},{{opacity:1,y:0,duration:.5,ease:'expo.out',immediateRender:false}},{s.L(T('Android')) - .1});")
s.add(f"tl.fromTo('#s18-ios',{{opacity:0,y:40}},{{opacity:1,y:0,duration:.5,ease:'expo.out',immediateRender:false}},{s.L(T('iOS')) - .1});")
s.add("tl.fromTo('#s18-ground',{clipPath:'circle(0% at 50% 50%)'},{clipPath:'circle(150% at 50% 50%)',duration:.5,ease:'power3.out'},0);")
sfx(T('PLUME', 3) - .9, 'riser', .35)
sfx(T('Android') - .05, 'pop', .3)
sfx(T('iOS') - .05, 'pop', .3)
SCENES.append(s)

# ================================================================ sous-titres
# Moments où les mots sont déjà à l'écran en grand (pas de sous-titre en double).
NO_CAP = [(0.0, T("Il s'écrit") - .05), (7.15, 8.35), (T("c'est toi") - .05, 91.10), (118.78, TOTAL)]


def captioned(t):
    return not any(a <= t < b for a, b in NO_CAP)


groups, cur = [], []
for w in WORDS:
    if not captioned(w['start']):
        if cur:
            groups.append(cur); cur = []
        continue
    cur.append(w)
    if w['text'][-1] in '.?!:…,' and len(cur) >= 3 or len(cur) >= 6 or w['text'][-1] in '.?!…' :
        groups.append(cur); cur = []
if cur:
    groups.append(cur)


def caption_html():
    els, js = [], []
    for gi, g in enumerate(groups):
        t0 = g[0]['start'] - .06
        nxt = groups[gi + 1][0]['start'] - .06 if gi + 1 < len(groups) else g[-1]['end'] + .4
        t1 = min(g[-1]['end'] + .45, nxt)
        for a_, b_ in NO_CAP:
            if g[-1]['end'] <= a_ < t1:
                t1 = a_
        spans = []
        for wi, w in enumerate(g):
            wid = f'cw{gi}_{wi}'
            spans.append(f'<span class="cw" id="{wid}">{escape(w["text"])}</span>')
            js.append(f"tl.set('#{wid}',{{backgroundColor:'#7C3AED',color:'#fff'}},{r(w['start'])});")
            js.append(f"tl.set('#{wid}',{{backgroundColor:'rgba(124,58,237,0)'}},{r(min(w['end'] + .02, t1))});")
        els.append(f'<div class="cg clip" id="cg{gi}" data-start="{r(t0)}" data-duration="{r(t1 - t0)}"><span class="cl">{" ".join(spans)}</span></div>')
    return f"""<template id="captions-template">
  <style>
#root{{position:absolute;inset:0;pointer-events:none}}
.cg{{position:absolute;left:70px;right:70px;top:190px;text-align:center}}
.cl{{display:inline;padding:10px 8px;background:rgba(24,18,36,.86);border-radius:22px;box-decoration-break:clone;-webkit-box-decoration-break:clone;font:800 48px/1.62 'Inter',sans-serif;color:#fff;letter-spacing:-.01em}}
.cw{{display:inline-block;padding:0 9px;border-radius:12px;line-height:1.25;background-color:rgba(124,58,237,0)}}
  </style>
  <div id="root" data-composition-id="captions" data-width="{W}" data-height="{H}" data-duration="{TOTAL}">
    {''.join(els)}
  </div>
  <script>
    const tl = gsap.timeline({{ paused: true }});
    {chr(10).join('    ' + x for x in js)}
    window.__timelines["captions"] = tl;
  </script>
</template>
"""


# ================================================================ assemblage
import subprocess
SFX_DUR = {}
for _f in (ROOT / 'assets/sfx').glob('*.mp3'):
    _d = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(_f)], capture_output=True, text=True).stdout.strip()
    SFX_DUR[_f.stem] = round(float(_d) - 0.01, 3)
VOICE_DUR = round(float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(ROOT / 'assets/audio/voix-off-norm.wav')], capture_output=True, text=True).stdout.strip()) - 0.01, 3)


def index_html():
    hosts = []
    for j, sc in enumerate(SCENES):
        hosts.append(f'<div id="{sc.sid}" data-composition-id="{sc.sid}" data-composition-src="compositions/{sc.sid}.html" data-start="{r(sc.t0)}" '
                     f'data-duration="{r(sc.t1 - sc.t0)}" data-track-index="1" data-track-kind="graphics" data-width="{W}" data-height="{H}"></div>')
    hosts.append(f'<div id="captions" data-composition-id="captions" data-composition-src="compositions/captions.html" data-start="0" data-duration="{TOTAL}" '
                 f'data-track-index="2" data-track-kind="captions" data-width="{W}" data-height="{H}" style="z-index:50"></div>')
    audio = [f'<audio id="voice" class="clip" src="assets/audio/voix-off-norm.wav" data-start="0" data-duration="{VOICE_DUR}" data-track-index="10" data-volume="1"></audio>',
             f'<audio id="music" class="clip" src="assets/audio/music.mp3" data-start="0" data-duration="{TOTAL}" data-track-index="11" data-volume="0.20" data-fade-in="0.4" data-fade-out="2.5"></audio>']
    for j, (t, name, vol) in enumerate(sorted(SFX)):
        d = round(min(SFX_DUR[name], TOTAL - t - 0.02), 3)
        audio.append(f'<audio id="sfx{j}" class="clip" src="assets/sfx/{name}.mp3" data-start="{max(0, round(t, 3))}" data-duration="{d}" data-track-index="{12 + j % 6}" data-volume="{vol}"></audio>')
    return f"""<!doctype html>
<html lang="fr" data-resolution="portrait" data-composition-variables='[{{"id":"color-ground","type":"color","label":"Fond","default":"#F4F0FB"}},{{"id":"color-ink","type":"color","label":"Texte","default":"#181224"}},{{"id":"color-accent","type":"color","label":"Accent","default":"#7C3AED"}},{{"id":"font-display","type":"string","label":"Police des titres","default":"Source Serif 4"}}]'>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      {FONT_FACE}
      :root {{ --color-ground:#F4F0FB; --color-ink:#181224; --color-accent:#7C3AED; --font-display:'Source Serif 4'; }}
      * {{ margin:0; padding:0; box-sizing:border-box; }}
      html, body {{ margin:0; width:1080px; height:1920px; overflow:hidden; background:var(--color-ground); }}
      #root {{ position:relative; width:100%; height:100%; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{TOTAL}" data-width="{W}" data-height="{H}">
      {chr(10).join('      ' + h for h in hosts)}
      {chr(10).join('      ' + a for a in audio)}
    </div>
    <script>
      window.__timelines = window.__timelines || {{}};
      const tl = gsap.timeline({{ paused: true }});
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
"""


if __name__ == '__main__':
    out = ROOT / 'compositions'
    out.mkdir(exist_ok=True)
    for sc in SCENES:
        (out / f'{sc.sid}.html').write_text(sc.html(), encoding='utf-8')
    (out / 'captions.html').write_text(caption_html(), encoding='utf-8')
    (ROOT / 'index.html').write_text(index_html(), encoding='utf-8')
    print(f'{len(SCENES)} scènes, {len(groups)} groupes de sous-titres, {len(SFX)} effets sonores')
