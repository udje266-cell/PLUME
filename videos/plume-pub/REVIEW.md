# Contrôle — PLUME « Prends la plume »

## Export
`renders/PLUME-pub-TikTok.mp4` : H.264 1080 × 1920, 30 im/s, 3 825 images, 127,5 s ; AAC stéréo 48 kHz. Décodage intégral sans erreur. Intensité −16,3 LUFS intégrés, LRA 3,5 LU, crête échantillon −1,6 dBFS (mesures ffmpeg ebur128). Le son est mesuré, pas écouté : aucune écoute humaine n'a eu lieu dans cet environnement.

## Vérifications
- `hyperframes check` : 0 erreur (lint, exécution, mise en page, mouvement, contraste). Avertissements conservés :
  - deux `line_unread` : le mot « PLUME » qui rétrécit vers l'en-tête (il vient d'être tenu 1,2 s) et « c'est toi qui prends la plume. », tenu 2,2 s au total sur deux scènes, prononcé en même temps ;
  - des `duplicate_media_discovery_risk` : une même capture réutilisée dans une scène.
- Images vérifiées : aperçus HyperFrames à environ 70 instants (début et milieu de chaque scène, raccords à ±0,2 s), puis 22 images extraites du MP4 final.
- Sous-titres : 79 groupes, alignés mot à mot sur la voix (orthographe du script, temps mesurés) ; deux lignes au maximum, dans la bande 190–330 px ; aucun sous-titre en double avec les grands titres (accroche, « Sur PLUME », bascule, affirmation, carton final).
- Bande utile TikTok : produit et texte entre 168 et 1330 px. Le téléphone occupe 392–1318 px au repos.

## Corrections faites pendant la réalisation
- Caméra : à faible zoom, l'écran entier reste dans la largeur (plus de téléphone coupé sur un bord).
- Découpes « thèmes » et « polices » fusionnées (elles se chevauchaient).
- Repères de temps sur les mots répétés (« plume », « PLUME ») : la phrase de bascule et le logo arrivent sur le bon mot.
- Scène de publication : la caméra cadrait sous l'écran au départ ; elle cadre maintenant la ligne du chapitre 4.
- Logo : version haute définition extraite de l'écran de démarrage officiel (le PNG du dépôt ne faisait que 273 px de large).
- Éléments cachés au départ : opacité dans le CSS, plus de `tl.set` à 0 (risque de flash sur la première image d'une scène).

## Effet de bord utile pour l'app
Les captures ont révélé un vrai bug de PLUME : après « Mettre en ligne », le chapitre affichait « Publié le Invalid Date ». Il est corrigé dans `src/App.tsx` et `src/components/WriteView.tsx` (commit séparé).

## Données
Captures faites sur une base PostgreSQL locale de démonstration (comptes `@example.invalid`, livres fictifs ; « The Hostel » = livre public du propriétaire). Aucune donnée privée de production n'apparaît.
