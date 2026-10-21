# PLUME promo — design spec

Concept : « Toute histoire commence par une plume. » Une plume lumineuse écrit
l'ouverture, devient le logo, puis un téléphone héros traverse chaque
fonctionnalité de l'app sur un fond d'encre violette.

## Palette

| Rôle            | Valeur    | Usage                                              |
| --------------- | --------- | -------------------------------------------------- |
| Fond (encre)    | `#140B22` | fond unique de toute la vidéo (teinté violet)      |
| Encre profonde  | `#0D0717` | vignettage, ombres                                 |
| Texte           | `#F5F0FF` | titres et labels sur le fond                       |
| Texte secondaire| `#B9A8DA` | sous-titres                                        |
| Accent          | `#7C3AED` | violet PLUME (boutons, puces, halos)               |
| Accent clair    | `#A78BFA` | labels mono, filets                                |
| Plume (dégradé) | `#7C3AED → #EC4899` | uniquement la plume / le logo            |
| Papier (UI)     | `#FFFFFF` / `#F7F5FB` | écrans de l'app                        |

## Typographie

- Titres : Source Serif 4 (900 / 600, italique pour l'émotion) — la police serif de l'app.
- UI dans le téléphone : Inter (400/600/700) — la vraie police de l'app (maquette fidèle).
- Labels / métadonnées : JetBrains Mono 400/700, capitales espacées.

## Composition

- Canvas 1080x1920. Zone titre en haut (y 150–470), téléphone héros en bas (640x1300, centré, bas à y≈1820).
- Satellites (couvertures, cartes, avatars, trophées) débordent du téléphone pour la profondeur.
- Fond vivant : 2 halos radiaux qui dérivent, mot fantôme géant en serif italique (≈12 %), grain.

## Mouvement

- Primaire : poussée latérale des écrans dans le téléphone + échange du titre (sortie vers le haut / entrée par le bas).
- Accents : zoom-through de la plume (ouverture), bloom du logo, lancement d'app (icône → écran), éventail de 3 téléphones (final).
- Eases variés : expo.out (arrivées franches), back.out (pop), power3.inOut (déplacements), sine.inOut (ambiance).
