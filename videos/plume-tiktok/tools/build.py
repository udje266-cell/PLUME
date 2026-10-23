"""Build editable, seekable Hyperframes scenes from real PLUME captures.
Run after capture.mjs. Whisper offsets are local transcription of the supplied VO.
"""
from pathlib import Path
import json,re,html,unicodedata,difflib,shutil
ROOT=Path(__file__).resolve().parent.parent
DURATION=134.0
def q(t):return round(t*30)/30
# Key, start, headline, and full portrait proof screens at voice-aligned times.
# The screen always keeps its native 780:1688 ratio, with no internal camera pan.
SHOTS=[
 ('hook',0,'Encore un<br>chapitre ?', [('reader',0),('book',2.7)]),
 ('first-word',5.68,'Et si c’était<br>le tien ?', [('editor',0)]),
 ('promise',8.28,'Des histoires<br>qui nous relient', [('home',0),('book',3.7)]),
 ('discover',15.96,'Trouve ton<br>prochain univers', [('explorer',0),('book',4.5)]),
 ('read',24.8,'Lis à<br>ta façon', [('book',0),('reader',2.2),('reader-settings',4.3)]),
 ('listen',31.96,'Écoute.<br>Emporte ton livre', [('reader-audio',0),('reader-download',3.2)]),
 ('keep',37.88,'Garde les mots<br>qui comptent', [('reader-highlight',0),('reader-note',2.6),('plumecard',5.4)]),
 ('comment',45.96,'Une lecture<br>se partage', [('reader-comments',0)]),
 ('library',49.6,'Ton coin<br>de bibliothèque', [('library',0),('library-grid',3.1),('collection-create',5.8),('library-list',8.8)]),
 ('resume',60.88,'Là où tu<br>t’étais arrêté', [('library',0),('reader-highlight',2.4)]),
 ('people',65.68,'Derrière un livre,<br>une personne', [('profile',0)]),
 ('live',67.92,'Des lectures<br>à vivre ensemble', [('profile',0),('live-reading-before',2.4),('live-reading-after',4.6)]),
 ('chat',75.56,'« Tu devrais<br>lire celui-ci »', [('chat',0),('chat-attachments',3),('chat',5.8),('chat-reveal',8.6)]),
 ('club',86.84,'Une histoire,<br>plusieurs regards', [('inbox',0),('club',2.7)]),
 ('write',92.52,'Cette histoire ?<br>Écris-la', [('write',0),('story-create',3.7),('editor',6.6),('editor-written',8.1),('workshop',9.9)]),
 ('publish',105.4,'À toi de<br>tourner la page', [('workshop',0),('workshop-ready',1.25)]),
 ('feedback',107.96,'Ton histoire<br>prend vie', [('author-stats',0)]),
 ('journey',111.96,'Chaque chapitre<br>te fait grandir', [('journey',0),('profile',4.1)]),
 ('payoff',119.92,'Une envie<br>devient un roman', [('book',0),('write',2.7)]),
 ('end',125.24,'',[]),
]
RAW=Path('/workspace/plume-local/promo-transcript.json')
if RAW.exists():shutil.copyfile(RAW,ROOT/'audio-alignment.json')
RAW=ROOT/'audio-alignment.json'
TRUTH=[
 "Tu connais ce moment où une histoire te donne envie de tout oublier… juste pour lire encore un chapitre ?",
 "Et si elle te donnait aussi envie d’écrire le tien ?",
 "Bienvenue sur PLUME. Un lieu pour découvrir des histoires, faire vivre les tiennes, et rencontrer les personnes qui aiment les mêmes univers que toi.",
 "Fantasy, romance, thriller, poésie… Explore les genres, cherche un livre ou un auteur, et laisse les recommandations t’emmener vers ta prochaine lecture.",
 "Ouvre une histoire. Choisis ton chapitre. Installe-toi. Adapte la taille du texte, la police et l’ambiance de lecture.",
 "Tu préfères écouter ? Active la lecture audio. Et pour continuer sans connexion, télécharge tes chapitres à l’avance.",
 "Un passage te touche ? Aime-le, surligne-le, ajoute une note. Garde tes citations dans ton carnet, ou transforme-les en PlumeCards à partager.",
 "Tu peux aussi commenter au fil de l’histoire et échanger avec son auteur.",
 "Ta bibliothèque garde toutes tes envies à portée de main : en cours, à lire, terminés. Crée tes collections, choisis la grille ou la liste, et retrouve tes livres par titre, par auteur ou par ajout récent.",
 "Ta progression suit ta lecture. Quand tu reviens, tu reprends là où tu t’étais arrêté.",
 "Derrière chaque histoire, il y a quelqu’un.",
 "Découvre des profils, suis tes auteurs préférés, et partage ta lecture en direct avec ta communauté… si tu le souhaites. C’est toi qui décides.",
 "Une recommandation ? Envoie le livre dans une discussion. Partage des photos, des fichiers ou une note vocale. Réponds à un message, réagis avec un emoji, et masque les spoilers pour laisser la surprise intacte.",
 "Retrouve tes conversations épinglées, tes messages non lus, ou rejoins un club de lecture pour en parler ensemble.",
 "Et cette histoire que tu gardes dans un coin de ta tête ? Donne-lui une place. Crée ton livre, sa couverture, son univers. Écris dans ton atelier, organise tes chapitres et tes tomes, ou importe un document pour reprendre un texte déjà commencé.",
 "Garde tes brouillons, puis publie quand tu es prêt.",
 "Les retours de tes lecteurs et les statistiques t’aident à suivre la vie de ton histoire.",
 "Lecture après lecture, chapitre après chapitre, ton parcours évolue : niveaux, expérience et trophées racontent aussi ton aventure.",
 "Sur PLUME, une histoire peut devenir une rencontre. Et une envie peut devenir ton premier roman.",
 "Lis. Écris. Partage. PLUME, bientôt disponible sur Android et iOS.",
]
def norm(s):return re.sub(r'[^a-z0-9]','',unicodedata.normalize('NFD',s.lower().replace('œ','oe')))
words=[]
for seg,truth in zip(json.loads(RAW.read_text())['transcription'],TRUTH):
 source=[]
 for t in seg['tokens']:
  text=t['text']
  if '['in text or t['offsets']['to']<=t['offsets']['from']:continue
  if text.startswith(' ') or not source:source.append({'text':text.strip(),'start':t['offsets']['from']/1000,'end':t['offsets']['to']/1000})
  else:source[-1]['text']+=text;source[-1]['end']=t['offsets']['to']/1000
 target=truth.split();starts=[None]*len(target)
 matcher=difflib.SequenceMatcher(a=[norm(x['text'])for x in source],b=[norm(x)for x in target],autojunk=False)
 for block in matcher.get_matching_blocks():
  for k in range(block.size):starts[block.b+k]=source[block.a+k]['start']
 known=[(-1,seg['offsets']['from']/1000)]+[(i,t)for i,t in enumerate(starts)if t is not None]+[(len(starts),seg['offsets']['to']/1000)]
 for (i,a),(j,b)in zip(known,known[1:]):
  for k in range(i+1,j):starts[k]=a+(b-a)*(k-i)/(j-i)
 for i,text in enumerate(target):words.append({'id':f'w{len(words)}','text':text,'start':round(starts[i],3),'end':round(starts[i+1]if i+1<len(target)else seg['offsets']['to']/1000,3)})
(ROOT/'transcript.json').write_text(json.dumps(words,ensure_ascii=False,indent=2))
groups=[];buffer=[]
for word in words:
 buffer.append(word)
 if len(buffer)>=4 or re.search(r'[.!?…]$',word['text']):groups.append(buffer);buffer=[]
if buffer:groups.append(buffer)
def stamp(t):
 ms=round(t*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
(ROOT/'PLUME-sous-titres.srt').write_text('\n\n'.join(f'{i+1}\n{stamp(g[0]["start"])} --> {stamp(g[-1]["end"])}\n'+ ' '.join(w['text']for w in g)for i,g in enumerate(groups))+'\n')
fontcss="""@font-face{font-family:Inter;src:url('assets/fonts/inter-400.woff2');font-weight:400}@font-face{font-family:Inter;src:url('assets/fonts/inter-600.woff2');font-weight:600}@font-face{font-family:Inter;src:url('assets/fonts/inter-700.woff2');font-weight:700}"""
# Adapted from the installed device-frame-stage component: a rigid, flat phone
# with real captures, no idle float, notch, perspective, or skeleton UI.
SCREEN_W=444
SCREEN_H=SCREEN_W*1688/780
PHONE_H=SCREEN_H+52
def platform_svg(name):
 return (ROOT/f'assets/icons/{name}.svg').read_text().replace('<svg ',f'<svg class="platform-icon {name}" ')
hosts=[];spec=[]
for i,(key,start,title,proofs)in enumerate(SHOTS):
 start=q(start);end=q(SHOTS[i+1][1])if i+1<len(SHOTS)else DURATION;d=end-start
 dark=(key in ['first-word','listen','people','live','chat','club','write','publish','feedback','journey','end'])
 bg='#10101e'if dark else '#faf8ff';ink='#faf8ff'if dark else '#161227';accent='#c084fc'if dark else '#7c25d9'
 hosts.append(f'<div id="{key}" class="clip" data-composition-id="{key}" data-composition-src="compositions/{key}.html" data-start="{start:.5f}" data-duration="{d:.5f}" data-track-index="0" data-track-kind="graphics" data-width="1080" data-height="1920"></div>')
 css=f'''#root{{position:absolute;inset:0;font-family:Inter,sans-serif;color:{ink};overflow:hidden}} .ground{{position:absolute;inset:0;background:{bg}}} .title{{position:absolute;left:108px;top:168px;font-size:56px;line-height:1.15;letter-spacing:-2px;font-weight:700;width:864px;white-space:nowrap}} .phone{{position:absolute;z-index:2;left:300px;top:310px;width:480px;height:{PHONE_H:.8f}px;border-radius:54px;background:linear-gradient(145deg,#343740,#1b1d22 42%,#111318);border:1px solid #62636f;box-shadow:0 22px 48px #070a1438,inset 0 0 0 3px #ffffff0c;transform-origin:50% 50%}} .speaker{{position:absolute;left:204px;top:13px;width:70px;height:5px;border-radius:8px;background:#08090d}} .lens{{position:absolute;left:287px;top:11px;width:8px;height:8px;border-radius:50%;background:#08090d;border:2px solid #4c4d58}} .viewport{{position:absolute;left:17px;top:29px;width:{SCREEN_W}px;height:{SCREEN_H:.8f}px;overflow:hidden;background:{bg}}} .camera{{position:absolute;inset:0;width:100%;height:100%}} .screen{{display:block;width:100%;height:100%;object-fit:contain}} .screen-clip{{position:absolute;inset:0}} .home-indicator{{position:absolute;left:172px;bottom:9px;width:134px;height:5px;border-radius:8px;background:#8b8c96}} .handoff{{position:absolute;z-index:4;inset:0;background:{accent}}}'''
 tl=["const tl=gsap.timeline({paused:true});"]
 if key=='end':
  css+='''.verb{position:absolute;left:108px;font-size:108px;font-weight:700;letter-spacing:-4px}.mark{position:absolute;left:420px;top:660px;width:240px;height:240px}.brand{position:absolute;left:108px;top:920px;width:864px;text-align:center;font-size:112px;font-weight:600;letter-spacing:15px}.cta{position:absolute;left:120px;top:1090px;width:840px;text-align:center;font-size:56px;line-height:1.25;letter-spacing:-1.8px;font-weight:600}.platforms{position:absolute;left:215px;top:1260px;width:650px;display:flex;justify-content:center;align-items:center;gap:96px}.platform{display:flex;align-items:center;gap:18px;font-size:42px;font-weight:600}.platform-icon{width:60px;height:60px;fill:currentColor;flex:none}.android{color:#3ddc84}.apple{color:#faf8ff}'''
  body='''<div id="end-lis" class="verb" style="top:210px">Lis</div><div id="end-ecris" class="verb" style="top:330px;color:#c084fc">Écris</div><div id="end-partage" class="verb" style="top:450px">Partage</div><img id="end-mark" class="mark" src="assets/plume.png" alt=""/><div id="end-brand" class="brand">PLUME</div><div id="end-cta" class="cta"><span data-var-text="launch">Bientôt disponible</span><br>sur Android et iOS</div><div id="end-platforms" class="platforms"><div class="platform">'''+platform_svg('android')+'''<span>Android</span></div><div class="platform">'''+platform_svg('apple')+'''<span>iOS</span></div></div>'''
  for selector,t in [('end-lis',.05),('end-ecris',.65),('end-partage',1.36)]:tl.append(f'tl.fromTo("#{selector}",{{clipPath:"inset(0 100% 0 0)"}},{{clipPath:"inset(0 0% 0 0)",duration:.42,ease:"power3.out"}},{t});')
  tl += ['tl.fromTo("#end-mark",{y:85,scale:.6,opacity:0},{y:0,scale:1,opacity:1,duration:.65,ease:"power4.out"},2.15);','tl.fromTo("#end-brand",{clipPath:"inset(0 100% 0 0)"},{clipPath:"inset(0 0% 0 0)",duration:.6,ease:"power3.out"},2.25);','tl.fromTo("#end-cta",{opacity:0},{opacity:1,duration:.3},2.85);','tl.fromTo("#end-platforms",{y:14,opacity:0},{y:0,opacity:1,duration:.36,ease:"power3.out"},3.05);']
 else:
  title_id=key+'-title';body=f'<div id="{title_id}" class="title">{title.replace("<br>"," ")}</div><div id="{key}-phone" class="phone"><div class="speaker"></div><div class="lens"></div><div class="viewport">'
  for j,(screen,at)in enumerate(proofs):
   at=q(at);until=q(proofs[j+1][1])if j+1<len(proofs)else d
   if not (ROOT/'assets/screens'/f'{screen}.png').exists():raise FileNotFoundError(screen)
   sid=f'{key}-proof-{j}';cid=sid+'-camera'
   body+=f'<div id="{sid}" class="clip screen-clip" data-start="{at}" data-duration="{until-at:.5f}" data-track-index="1"><div id="{cid}" class="camera"><img class="screen" src="assets/screens/{screen}.png" alt="Capture réelle PLUME : {screen}"/></div></div>'
   if j>0:tl.append(f'tl.fromTo("#{cid}",{{opacity:.12}},{{opacity:1,duration:.18,ease:"power2.out"}},{at});')
  body+='</div><div class="home-indicator"></div></div>'
  if key!='hook':tl.append(f'tl.fromTo("#{key}-phone",{{x:{18 if i%2 else -18},y:24,scale:.985}},{{x:0,y:0,scale:1,duration:.52,ease:"power4.out"}},0);')
  # Different scales and layouts follow the task: a cover travels into the UI,
  # a shelf opens as a fan, and the author's page becomes the final book.
  # These are the same original cover SVGs used by the real captured app.
  if key in ['hook','discover','library','chat','payoff']:
   moment={'hook':0,'discover':0,'library':4.5,'chat':0,'payoff':0}[key]
   hold={'hook':2.45,'discover':3.25,'library':2.3,'chat':1.8,'payoff':2.9}[key]
   count=5 if key in ['discover','library']else 1
   cover_ids=[]
   css+=' .book-art{position:absolute;left:415px;top:640px;width:250px;height:375px;border-radius:8px;box-shadow:12px 22px 35px #00000025;transform-origin:50% 100%}.book-art img{width:100%;height:100%;display:block;border-radius:8px}.art-rack{position:absolute;inset:0}'
   body+=f'<div class="clip" id="{key}-art-slot" style="z-index:1" data-start="{moment}" data-duration="{hold}" data-track-index="6"><div id="{key}-art-rack" class="art-rack" data-layout-allow-overflow>'
   for b in range(count):
    bid=f'{key}-book-{b}';cover_ids.append(bid)
    body+=f'<div id="{bid}" class="book-art"><img src="assets/demo/cover-{b if count>1 else 0}.svg" alt=""/></div>'
    dx=(b-(count-1)/2)*150 if count>1 else (300 if key=='hook'else -300)
    rotation=(b-(count-1)/2)*9 if count>1 else -5
    tl.append(f'tl.fromTo("#{bid}",{{x:0,y:120,rotation:0,scale:.65,opacity:0}},{{x:{dx},y:0,rotation:{rotation},scale:1,opacity:1,duration:.65,ease:"power4.out"}},{moment+b*.07});')
   body+='</div></div>'
   tl.append(f'tl.to("#{key}-art-rack",{{x:{-160 if key=="chat"else 750},y:{140 if key=="chat"else -90},scale:{.3 if key=="chat"else 1.1},opacity:0,duration:.55,ease:"power3.inOut"}},{moment+hold-.57});')
  if i%3==0:
   tl.append(f'tl.fromTo("#{title_id}",{{clipPath:"inset(0 100% 0 0)"}},{{clipPath:"inset(0 0% 0 0)",duration:.55,ease:"power3.out"}},0);')
  elif i%3==1:
   tl.append(f'tl.fromTo("#{title_id}",{{x:80,opacity:0}},{{x:0,opacity:1,duration:.52,ease:"power4.out"}},0);')
  else:tl.append(f'tl.fromTo("#{title_id}",{{opacity:0}},{{opacity:1,duration:.22}},.05);')
  if key=='hook':
   # Frame zero carries the hook and a live product screen; no empty intro.
   tl=[x for x in tl if not('hook-title'in x)]
  if i%2==0 and key!='hook':
   body+=f'<div id="{key}-wipe" class="handoff" data-layout-ignore></div>'
   tl.append(f'tl.fromTo("#{key}-wipe",{{x:0}},{{x:1080,duration:.48,ease:"power3.inOut"}},0);')
 tl.append(f'window.__timelines["{key}"]=tl;')
 content=f'<template><style>{fontcss}{css}</style><div id="root" data-composition-id="{key}" data-width="1080" data-height="1920" data-duration="{d:.5f}"><div class="ground"></div>{body}</div><script>'+''.join(tl)+'</script></template>'
 (ROOT/'compositions'/f'{key}.html').write_text(content)
 spec.append(f'| {round(start*30)}–{round(end*30)-1} | {key} | {title.replace("<br>"," ")} | '+', '.join(x[0]for x in proofs)+' |')
# Single captions track. Corrected source text, with measured French word offsets.
capbody=[];captl=['const tl=gsap.timeline({paused:true});']
for i,g in enumerate(groups):
 a=q(max(.1,g[0]['start']));b=q(min(125.24,g[-1]['end']))
 if a>=125.24 or b<=a:continue
 text=' '.join(w['text']for w in g)
 capbody.append(f'<div id="cap-{i}" class="clip caption" data-start="{a:.5f}" data-duration="{b-a:.5f}" data-track-index="2"><span>{html.escape(text)}</span></div>')
 captl.append(f'tl.fromTo("#cap-{i} span",{{opacity:0,clipPath:"inset(0 100% 0 0)"}},{{opacity:1,clipPath:"inset(0 0% 0 0)",duration:.09,ease:"power2.out"}},{a});')
captl.append('window.__timelines["captions"]=tl;')
(ROOT/'compositions/captions.html').write_text('<template><style>'+fontcss+'#root{position:absolute;inset:0;pointer-events:none;font-family:Inter}.caption{position:absolute;left:108px;top:242px;width:864px;text-align:center;font-size:38px;line-height:1.15;font-weight:600;color:#fff}.caption span{display:inline-block;max-width:864px;white-space:nowrap;background:#171323;padding:10px 22px;border-radius:12px}</style><div id="root" data-composition-id="captions" data-width="1080" data-height="1920" data-duration="134">'+''.join(capbody)+'</div><script>'+''.join(captl)+'</script></template>')
hosts.append('<div id="captions" class="clip" data-composition-id="captions" data-composition-src="compositions/captions.html" data-start="0" data-duration="134" data-track-index="2" data-track-kind="captions" data-width="1080" data-height="1920" style="z-index:10"></div>')
audio='<audio id="voiceover" src="assets/audio/voix-off-normalisee.wav" data-start="0" data-duration="130.925" data-track-index="3" data-volume="1" data-timeline-role="voiceover"></audio><audio id="music" src="assets/audio/music.mp3" data-start="0" data-duration="134" data-track-index="4" data-volume="0.22" data-fade-in=".4" data-fade-out="2.5" data-timeline-role="music"></audio>'
for i,t in enumerate([8.28,24.8,49.6,67.92,75.56,92.52,111.96,127.5]):audio+=f'<audio id="sfx-{i}" src="assets/audio/{"chime"if i==7 else "whoosh-short"}.mp3" data-start="{t}" data-duration="{.8 if i==7 else .57}" data-track-index="5" data-volume=".08"></audio>'
root='''<!doctype html><html lang="fr" data-resolution="portrait" data-composition-variables='[{"id":"launch","type":"string","label":"Annonce finale","default":"Bientôt disponible"}]'><head><meta charset="utf-8"/><meta name="viewport" content="width=1080,height=1920"/><title>PLUME — Encore un chapitre</title><script src="assets/vendor/gsap.min.js"></script><style>'''+fontcss+'''*{box-sizing:border-box;margin:0}html,body{width:1080px;height:1920px;overflow:hidden;background:#faf8ff}.clip{position:absolute}#root{position:relative;width:1080px;height:1920px}#root>.clip{inset:0;width:1080px;height:1920px}</style></head><body><div id="root" data-composition-id="main" data-start="0" data-duration="134" data-width="1080" data-height="1920" data-fps="30">'''+''.join(hosts)+audio+'''</div><script>window.__timelines=window.__timelines||{};window.__timelines.main=gsap.timeline({paused:true});</script></body></html>'''
(ROOT/'index.html').write_text(root)
(ROOT/'SPEC.md').write_text('''# PLUME — Encore un chapitre

GOAL : un lecteur se reconnaît, découvre la communauté et imagine écrire son propre livre.
OUTPUT : Hyperframes, 1080 × 1920, 30 fps, H.264/AAC, portrait TikTok.
TIME : 134 s = 4020 images ; voix fournie 130,93 s ; musique originale 104 BPM.
LOOK : blanc lavande #faf8ff / encre #10101e ; accent PLUME #7c25d9 et #c084fc sur sombre. Inter 700, 56 px, interligne 1,15 ; sous-titres 38 px, Inter 600. Téléphone vertical de face, graphite, 480 × 1012,86 px. Captures entières 780 × 1688 affichées sans déformation à 444 × 960,86 px. Aucun panoramique interne, zoom ou découpage de l’interface ; chaque bord de la capture reste visible. Écouteur et barre d’accueil dans le cadre, à l’extérieur de la capture. Images produit non filtrées.
SAFE : titres x108–972, y168–233 ; sous-titres x108–972, y242–306 ; téléphone x300–780, y310–1322,86. Toutes les informations restent au-dessus de 1330, en dehors du rail droit TikTok. Le carton final avec les icônes Android et Apple se termine à y1320. Les couvertures animées passent derrière le téléphone, sans couvrir son écran.
OBJECT : le même livre traverse accueil, lecture, bibliothèque, conversation et communauté. Livres et comptes créés localement pour les captures, supprimés après. Aucun écran privé de production.
MOTION : arrivées du téléphone comme un seul objet, power4.out en 16 images, amplitude 18 px en x et 24 px en y ; changements de capture par apparition de 5 images. Dévoilements de titre clip-path power3.out en 16 images. Titres et téléphone immobiles après arrivée, pas de flottement continu. Cadre adapté du composant installé device-frame-stage ; habillage directional-wipe, kinetic-center-build et caption-clip-wipe, sans interface fictive.
BANNED : fausses interfaces, cadrages carrés, capture rognée ou déformée, encoche masquant le produit, couverture ou sous-titre superposé à l’écran, trois cartes de fonctions, 3D inclinée, néons, particules, logo en filigrane, défilement de titre pendant sa lecture, progression artificielle figée à 35, voix synthétique de remplacement, badges de stores suggérant une disponibilité immédiate.
QA : chaque scène au début +0,3 s et au milieu ; coutures ±0,2 s ; lecture à 360 px ; fin de voix « Android et iOS » ; écran final tenu après la voix ; pas de données de démonstration restantes. Mesurer volume et crêtes du mix ; contrôler toutes les images extraites et l'intégrité du MP4.

## Plans par image

| Images à 30 fps | Scène | Texte clé | Preuves de l'application |
| --- | --- | --- | --- |
'''+ '\n'.join(spec)+'\n')
print('Built 20 scenes + captions, 134 seconds, voice-aligned proof screens and corrected French subtitles.')
