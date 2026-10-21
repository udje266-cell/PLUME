---
format: 1080x1920
duration: 92s
message: "PLUME : lis, écris et partage des histoires — tout dans une seule app"
arc: Hook → Logo → Découvrir → Explorer → Choisir → Lire/Écouter → Écrire → Partager → Progresser → Lockup
audience: lecteurs et auteurs francophones, sur mobile
mode: autonomous
music: composition originale 120 BPM (1 mesure = 2 s), intro douce → drop à 8 s → pont calme (lecture) → montée 70–78 s → refrain final → résolution
---

Architecture : une seule composition (`index.html`) — le téléphone est un élément
persistant de 14 s à 78 s, donc les scènes partagent le même DOM (archétype
« multi-scene merge » de hyperframes-core).

## Frame 1 — La plume écrit
- status: outline
- src: index.html#s1
- duration: 8s
- transition_in: cut
- scene: Une plume lumineuse descend, trace « Il était une fois… » puis « une plume. », plonge vers la caméra.
- blueprint: typewriter-reveal (adapt) + svg-path-draw, particle-burst, motion-blur-streak

## Frame 2 — Logo
- status: outline
- src: index.html#s2
- duration: 6s
- transition_in: zoom-through flash
- scene: La plume éclot au centre (bloom), les lettres P-L-U-M-E cascadent, « Lis. Écris. Partage. » claque sur 3 temps.
- blueprint: logo-assemble-lockup (CTA text-clear bloom variant) + kinetic-beat-slam

## Frame 3 — Découvrir (Accueil)
- status: outline
- src: index.html#s3
- duration: 10s
- transition_in: lancement d'app (le logo devient l'icône, l'écran s'ouvre)
- scene: Le téléphone monte, l'Accueil s'ouvre, carrousel « Pour toi », couvertures qui jaillissent en 3D.
- blueprint: device-surface-showcase (static-tour) + depth-scatter-assemble

## Frame 4 — Explorer
- status: outline
- src: index.html#s4
- duration: 8s
- transition_in: poussée latérale
- scene: Recherche « dragons » tapée, pastilles de genres en cascade, grille de résultats.
- blueprint: prompt-type-submit-generate (instant result) + grid-card-assemble

## Frame 5 — Choisir (fiche d'oeuvre)
- status: outline
- src: index.html#s5
- duration: 6s
- transition_in: tap + feuille qui monte
- scene: Couverture, synopsis, Tome 1 et chapitres, bouton « Reprendre au chapitre 3 ».
- blueprint: cursor-ui-demo (tap) + waterfall-entry

## Frame 6 — Lire / Écouter
- status: outline
- src: index.html#s6
- duration: 10s
- transition_in: poussée latérale
- scene: Thèmes Clair → Nuit → Sépia, surlignage + note, puis lecteur audio (ondes + karaoké).
- blueprint: fixed-anchor-cycle (theme morph) + css-marker-patterns + gsap-effects (audio visualizer)

## Frame 7 — Écrire / Publier / Statistiques
- status: outline
- src: index.html#s7
- duration: 10s
- transition_in: retournement 3D du téléphone
- scene: Titre et texte tapés, genres choisis, « Publier » pressé + confettis ; carte statistiques par chapitre.
- blueprint: typewriter-reveal + press-release-spring + particle-burst + stat-bars-and-fills + counting-dynamic-scale

## Frame 8 — Partager (groupes)
- status: outline
- src: index.html#s8
- duration: 12s
- transition_in: poussée latérale
- scene: Bulles de groupe, mention @, spoiler révélé, sondage qui se remplit, notification, nuage d'avatars.
- blueprint: agent-progress-theater (thread builds) + avatar-cloud-network + spring-pop-entrance

## Frame 9 — Progresser (succès)
- status: outline
- src: index.html#s9
- duration: 8s
- transition_in: poussée latérale
- scene: Niveau et XP qui se remplissent, trophées qui éclatent, trophée légendaire qui brille.
- blueprint: dataviz-countup + spring-pop-entrance + gradient sheen

## Frame 10 — Final
- status: outline
- src: index.html#s10
- duration: 14s
- transition_in: zoom arrière en éventail
- scene: Trois téléphones en éventail, se replient dans la plume ; lockup PLUME + « Lis. Écris. Partage. » + « Disponible sur Android ».
- blueprint: split-tilt-cards + logo-assemble-lockup (Brand_Outro)
