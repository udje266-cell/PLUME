"""Build editable, seekable Hyperframes scenes from real PLUME captures.
Run after capture.mjs. Whisper offsets are local transcription of the supplied VO.
"""
from pathlib import Path
import json,re,html,unicodedata,difflib,shutil
ROOT=Path(__file__).resolve().parent.parent
DURATION=134.0
def q(t):return round(t*30)/30
# key, start, headline, proof screens and camera offsets (pixels at output size)
SHOTS=[
 ('hook',0,'Encore un<br>chapitre ?', [('reader',0,-260),('book',2.7,-20)]),
 ('first-word',5.68,'Et si c’était<br>le tien ?', [('editor',0,0)]),
 ('promise',8.28,'Des histoires<br>qui nous relient', [('home',0,0),('home',3.7,-650)]),
 ('discover',15.96,'Trouve ton<br>prochain univers', [('explorer',0,-50),('explorer',4.5,-580)]),
 ('read',24.8,'Lis à<br>ta façon', [('book',0,-720),('reader',2.2,0),('reader-settings',4.3,-550)]),
 ('listen',31.96,'Écoute.<br>Emporte ton livre', [('reader-audio',0,-1010),('reader-download',3.2,0)]),
 ('keep',37.88,'Garde les mots<br>qui comptent', [('reader-highlight',0,-200),('reader-note',2.6,-530),('plumecard',5.4,-300)]),
 ('comment',45.96,'Une lecture<br>se partage', [('reader-comments',0,-360)]),
 ('library',49.6,'Ton coin<br>de bibliothèque', [('library',0,0),('library-grid',3.1,-280),('collection-create',5.8,-620),('library-list',8.8,-470)]),
 ('resume',60.88,'Là où tu<br>t’étais arrêté', [('library',0,-270),('reader-highlight',2.4,-300)]),
 ('people',65.68,'Derrière un livre,<br>une personne', [('profile',0,-40)]),
 ('live',67.92,'Des lectures<br>à vivre ensemble', [('profile',0,-750),('live-reading-before',2.4,-820),('live-reading-after',4.6,-820)]),
 ('chat',75.56,'« Tu devrais<br>lire celui-ci »', [('chat',0,0),('chat-attachments',3,-840),('chat',5.8,-560),('chat-reveal',8.6,-650)]),
 ('club',86.84,'Une histoire,<br>plusieurs regards', [('inbox',0,0),('club',2.7,-400)]),
 ('write',92.52,'Cette histoire ?<br>Écris-la', [('write',0,0),('story-create',3.7,-140),('editor',6.6,0),('editor-written',8.1,0),('workshop',9.9,-80)]),
 ('publish',105.4,'À toi de<br>tourner la page', [('workshop',0,-370),('workshop-ready',1.25,-370)]),
 ('feedback',107.96,'Ton histoire<br>prend vie', [('author-stats',0,-150)]),
 ('journey',111.96,'Chaque chapitre<br>te fait grandir', [('journey',0,-570),('journey',4.1,-870)]),
 ('payoff',119.92,'Une envie<br>devient un roman', [('book',0,0),('write',2.7,-100)]),
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
hosts=[];spec=[]
for i,(key,start,title,proofs)in enumerate(SHOTS):
 start=q(start);end=q(SHOTS[i+1][1])if i+1<len(SHOTS)else DURATION;d=end-start
 dark=(key in ['first-word','listen','people','live','chat','club','write','publish','feedback','journey','end'])
 bg='#10101e'if dark else '#faf8ff';ink='#faf8ff'if dark else '#161227';accent='#c084fc'if dark else '#7c25d9'
 hosts.append(f'<div id="{key}" class="clip" data-composition-id="{key}" data-composition-src="compositions/{key}.html" data-start="{start:.5f}" data-duration="{d:.5f}" data-track-index="0" data-track-kind="graphics" data-width="1080" data-height="1920"></div>')
 css=f'''#root{{position:absolute;inset:0;font-family:Inter,sans-serif;color:{ink};overflow:hidden}} .ground{{position:absolute;inset:0;background:{bg}}} .title{{position:absolute;left:108px;top:185px;font-size:98px;line-height:1.06;letter-spacing:-5px;font-weight:700;width:850px}} .viewport{{position:absolute;left:108px;top:492px;width:840px;height:790px;overflow:hidden;border-radius:28px;background:{bg};box-shadow:0 8px 38px #00000020}} .camera{{position:absolute;left:0;top:0;width:840px;transform-origin:50% 30%}} .screen{{display:block;width:840px;height:auto}} .screen-clip{{position:absolute;inset:0}} .edge{{position:absolute;left:108px;top:1450px;width:840px;height:4px;background:{accent};opacity:.15}} .handoff{{position:absolute;inset:0;background:{accent}}}'''
 tl=["const tl=gsap.timeline({paused:true});"]
 if key=='end':
  css+='''.verb{position:absolute;left:108px;font-size:108px;font-weight:700;letter-spacing:-4px}.mark{position:absolute;left:420px;top:660px;width:240px;height:240px}.brand{position:absolute;left:108px;top:920px;width:864px;text-align:center;font-size:112px;font-weight:600;letter-spacing:15px}.cta{position:absolute;left:120px;top:1120px;width:840px;text-align:center;font-size:58px;line-height:1.25;letter-spacing:-1.8px;font-weight:600}'''
  body='''<div id="end-lis" class="verb" style="top:210px">Lis</div><div id="end-ecris" class="verb" style="top:330px;color:#c084fc">Écris</div><div id="end-partage" class="verb" style="top:450px">Partage</div><img id="end-mark" class="mark" src="assets/plume.png" alt=""/><div id="end-brand" class="brand">PLUME</div><div id="end-cta" class="cta" data-var-text="launch">Bientôt disponible<br>sur Android et iOS</div>'''
  for selector,t in [('end-lis',.05),('end-ecris',.65),('end-partage',1.36)]:tl.append(f'tl.fromTo("#{selector}",{{clipPath:"inset(0 100% 0 0)"}},{{clipPath:"inset(0 0% 0 0)",duration:.42,ease:"power3.out"}},{t});')
  tl += ['tl.fromTo("#end-mark",{y:85,scale:.6,opacity:0},{y:0,scale:1,opacity:1,duration:.65,ease:"power4.out"},2.15);','tl.fromTo("#end-brand",{clipPath:"inset(0 100% 0 0)"},{clipPath:"inset(0 0% 0 0)",duration:.6,ease:"power3.out"},2.25);','tl.fromTo("#end-cta",{opacity:0},{opacity:1,duration:.3},2.85);']
 else:
  title_id=key+'-title';body=f'<div id="{title_id}" class="title">{title}</div><div class="viewport" data-layout-allow-overflow>'
  for j,(screen,at,offset)in enumerate(proofs):
   at=q(at);until=q(proofs[j+1][1])if j+1<len(proofs)else d
   if not (ROOT/'assets/screens'/f'{screen}.png').exists():raise FileNotFoundError(screen)
   sid=f'{key}-proof-{j}';cid=sid+'-camera'
   body+=f'<div id="{sid}" class="clip screen-clip" data-start="{at}" data-duration="{until-at:.5f}" data-track-index="1"><div id="{cid}" class="camera"><img class="screen" src="assets/screens/{screen}.png" alt="Capture réelle PLUME : {screen}"/></div></div>'
   tl.append(f'tl.set("#{cid}",{{y:{offset}}},0);')
   if j>0:tl.append(f'tl.fromTo("#{cid}",{{scale:1.065}},{{scale:1,duration:.48,ease:"power3.out"}},{at});')
   if until-at>3.8:
    target=max(-1025,offset-190)if offset>-600 else min(0,offset+145)
    tl.append(f'tl.to("#{cid}",{{y:{target},duration:.65,ease:"power2.inOut"}},{at+2.1});')
  body+='</div><div class="edge"></div>'
  # Different scales and layouts follow the task: a cover travels into the UI,
  # a shelf opens as a fan, and the author's page becomes the final book.
  # These are the same original cover SVGs used by the real captured app.
  if key in ['hook','discover','library','chat','payoff']:
   moment={'hook':0,'discover':0,'library':4.5,'chat':0,'payoff':0}[key]
   hold={'hook':2.45,'discover':3.25,'library':2.3,'chat':1.8,'payoff':2.9}[key]
   count=5 if key in ['discover','library']else 1
   cover_ids=[]
   css+=' .book-art{position:absolute;left:300px;top:550px;width:430px;height:645px;border-radius:8px;box-shadow:12px 22px 35px #00000035;transform-origin:50% 100%}.book-art img{width:100%;height:100%;display:block;border-radius:8px}.art-rack{position:absolute;inset:0}'
   body+=f'<div class="clip" id="{key}-art-slot" data-start="{moment}" data-duration="{hold}" data-track-index="6"><div id="{key}-art-rack" class="art-rack" data-layout-allow-overflow>'
   for b in range(count):
    bid=f'{key}-book-{b}';cover_ids.append(bid)
    body+=f'<div id="{bid}" class="book-art"><img src="assets/demo/cover-{b if count>1 else 0}.svg" alt=""/></div>'
    dx=(b-(count-1)/2)*138 if count>1 else (180 if key=='hook'else 0)
    rotation=(b-(count-1)/2)*9 if count>1 else -5
    tl.append(f'tl.fromTo("#{bid}",{{x:0,y:120,rotation:0,scale:.65,opacity:0}},{{x:{dx},y:0,rotation:{rotation},scale:1,opacity:1,duration:.65,ease:"power4.out"}},{moment+b*.07});')
   body+='</div></div>'
   tl.append(f'tl.to("#{key}-art-rack",{{x:{-160 if key=="chat"else 750},y:{140 if key=="chat"else -90},scale:{.3 if key=="chat"else 1.1},opacity:0,duration:.55,ease:"power3.inOut"}},{moment+hold-.57});')
   if key in ['discover','payoff']:
    tl.append(f'tl.fromTo("#{key}-proof-0-camera",{{opacity:0}},{{opacity:1,duration:.25}},{moment+hold-.8});')
  if key=='hook':css+=' .title{font-size:132px;letter-spacing:-7px;top:170px}.viewport{top:540px;height:742px}'
  if key=='first-word':css+=' .title{font-size:132px;top:230px}.viewport{top:610px;height:660px}'
  if key=='people':css+=' .title{top:1100px;font-size:66px;letter-spacing:-3px}.viewport{top:200px;height:850px}'
  if key=='library':css+=' .title{font-size:82px;top:170px}.viewport{top:405px;height:877px}'
  if key=='chat':css+=' .title{font-size:89px;color:#d8b4fe}.viewport{top:450px;height:832px}'
  if key=='publish':css+=' .viewport{top:540px;height:640px}'
  if i%3==0:
   tl.append(f'tl.fromTo("#{title_id}",{{clipPath:"inset(0 100% 0 0)"}},{{clipPath:"inset(0 0% 0 0)",duration:.55,ease:"power3.out"}},0);')
  elif i%3==1:
   tl.append(f'tl.fromTo("#{title_id}",{{x:80,opacity:0}},{{x:0,opacity:1,duration:.52,ease:"power4.out"}},0);')
  else:tl.append(f'tl.fromTo("#{title_id}",{{opacity:0}},{{opacity:1,duration:.22}},.05);')
  if key=='hook':
   # Frame zero carries the hook and a live product screen; no empty intro.
   tl[1]='tl.set("#hook-proof-0-camera",{y:-260},0);'
   tl=[x for x in tl if not('hook-title'in x)]
  if i%2==0 and key!='hook':
   body+=f'<div id="{key}-wipe" class="handoff" data-layout-ignore></div>'
   tl.append(f'tl.fromTo("#{key}-wipe",{{x:0}},{{x:1080,duration:.48,ease:"power3.inOut"}},0);')
  if i%2==1:
   tl.append(f'tl.to("#{key}-proof-{len(proofs)-1}-camera",{{x:-45,duration:.25,ease:"power3.in"}},{d-.27});')
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
(ROOT/'compositions/captions.html').write_text('<template><style>'+fontcss+'#root{position:absolute;inset:0;pointer-events:none;font-family:Inter}.caption{position:absolute;left:108px;top:1298px;width:840px;text-align:center;font-size:42px;line-height:1.18;font-weight:600;color:#fff}.caption span{display:inline-block;max-width:840px;background:#171323;padding:14px 24px;border-radius:12px}</style><div id="root" data-composition-id="captions" data-width="1080" data-height="1920" data-duration="134">'+''.join(capbody)+'</div><script>'+''.join(captl)+'</script></template>')
hosts.append('<div id="captions" class="clip" data-composition-id="captions" data-composition-src="compositions/captions.html" data-start="0" data-duration="134" data-track-index="2" data-track-kind="captions" data-width="1080" data-height="1920" style="z-index:10"></div>')
audio='<audio id="voiceover" src="assets/audio/voix-off-normalisee.wav" data-start="0" data-duration="130.925" data-track-index="3" data-volume="1" data-timeline-role="voiceover"></audio><audio id="music" src="assets/audio/music.mp3" data-start="0" data-duration="134" data-track-index="4" data-volume="0.22" data-fade-in=".4" data-fade-out="2.5" data-timeline-role="music"></audio>'
for i,t in enumerate([8.28,24.8,49.6,67.92,75.56,92.52,111.96,127.5]):audio+=f'<audio id="sfx-{i}" src="assets/audio/{"chime"if i==7 else "whoosh-short"}.mp3" data-start="{t}" data-duration="{.8 if i==7 else .57}" data-track-index="5" data-volume=".08"></audio>'
root='''<!doctype html><html lang="fr" data-resolution="portrait" data-composition-variables='[{"id":"launch","type":"string","label":"Annonce finale","default":"Bientôt disponible sur Android et iOS"}]'><head><meta charset="utf-8"/><meta name="viewport" content="width=1080,height=1920"/><title>PLUME — Encore un chapitre</title><script src="assets/vendor/gsap.min.js"></script><style>'''+fontcss+'''*{box-sizing:border-box;margin:0}html,body{width:1080px;height:1920px;overflow:hidden;background:#faf8ff}.clip{position:absolute}#root{position:relative;width:1080px;height:1920px}#root>.clip{inset:0;width:1080px;height:1920px}</style></head><body><div id="root" data-composition-id="main" data-start="0" data-duration="134" data-width="1080" data-height="1920" data-fps="30">'''+''.join(hosts)+audio+'''</div><script>window.__timelines=window.__timelines||{};window.__timelines.main=gsap.timeline({paused:true});</script></body></html>'''
(ROOT/'index.html').write_text(root)
(ROOT/'SPEC.md').write_text('''# PLUME — Encore un chapitre

GOAL : un lecteur se reconnaît, découvre la communauté et imagine écrire son propre livre.
OUTPUT : Hyperframes, 1080 × 1920, 30 fps, H.264/AAC, portrait TikTok.
TIME : 134 s = 4020 images ; voix fournie 130,93 s ; musique originale 104 BPM.
LOOK : blanc lavande #faf8ff / encre #10101e ; accent PLUME #7c25d9 et #c084fc sur sombre. Inter 700, 98 px, interligne 1,06 ; sous-titres 42 px, Inter 600. Aucun écran incliné. Captures 780 × 1688 affichées à 840 px de large ; actions cadrées à environ 2,15 fois leur taille CSS. Rayon 28 px, ombre 0 8 38 / 12 %. Images produit non filtrées.
SAFE : titres x108–958, y185–400 ; interface x108–948, y492–1282 ; sous-titres x108–948, y1298–1425. Le bas reste libre pour l'interface TikTok ; les informations essentielles restent au-dessus de 1430. Le carton final est entièrement au-dessus de 1350.
OBJECT : le même livre traverse accueil, lecture, bibliothèque, conversation et communauté. Livres et comptes créés localement pour les captures, supprimés après. Aucun écran privé de production.
MOTION : arrivées power4.out en 16 images ; mouvements de cadrage power2.inOut en 20 images ; dévoilements clip-path power3.out en 16 images ; départs power3.in en 8 images. Titres immobiles après arrivée, pas de flottement continu. Motions inspirées des composants installés ui-focus-zoom, directional-wipe, kinetic-center-build, caption-clip-wipe ; ajustées à de véritables captures, sans leurs écrans de squelette.
BANNED : fausses interfaces, trois cartes de fonctions, petits téléphones perdus au centre, 3D inclinée, néons, particules, logo en filigrane, défilement de titre pendant sa lecture, progression artificielle figée à 35, voix synthétique de remplacement, badges de stores suggérant une disponibilité immédiate.
QA : chaque scène au début +0,3 s et au milieu ; coutures ±0,2 s ; lecture à 360 px ; fin de voix « Android et iOS » ; écran final tenu après la voix ; pas de données de démonstration restantes. Mesurer volume et crêtes du mix ; contrôler toutes les images extraites et l'intégrité du MP4.

## Plans par image

| Images à 30 fps | Scène | Texte clé | Preuves de l'application |
| --- | --- | --- | --- |
'''+ '\n'.join(spec)+'\n')
print('Built 20 scenes + captions, 134 seconds, voice-aligned proof screens and corrected French subtitles.')
