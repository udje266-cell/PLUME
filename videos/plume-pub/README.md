# PLUME — pub TikTok « Prends la plume »

Vidéo verticale 1080 × 1920, 30 im/s, 127,5 s, narrée (voix « Manon » fournie) et sous-titrée.
Rendu : `renders/PLUME-pub-TikTok.mp4` (non versionné, voir `.gitignore`).

## Fichiers
- `VOIX-OFF.txt` : texte de la voix off, envoyé pour l'enregistrement.
- `BRIEF.md`, `INSPIRATIONS.md`, `STORYLINES.md`, `SPEC.md`, `REVIEW.md` : demande, recherches, pistes, cahier des charges chiffré, contrôle.
- `index.html` + `compositions/` : **générés** par `tools/build.py` (18 scènes + sous-titres). Modifier `tools/build.py`, puis `python3 tools/build.py`.
- `assets/screens/` : captures 390 × 844 @3x de la vraie interface ; `assets/boxes/` : positions des éléments de chaque capture (ciblage des zooms).
- `assets/audio/` : voix fournie, voix normalisée (−16 LUFS), transcription (`transcript.json`), texte aligné mot à mot (`words.json`), musique.

## Refaire les captures (base locale uniquement)
```sh
service postgresql start                                   # PostgreSQL local
DATABASE_URL=postgresql://plume:plume@localhost:5432/plume_promo npx prisma migrate deploy
DATABASE_URL=postgresql://plume:plume@localhost:5432/plume_promo node videos/plume-pub/tools/seed.mjs
DATABASE_URL=postgresql://plume:plume@localhost:5432/plume_promo PORT=3001 npx tsx server.ts &
cd videos/plume-pub && node tools/covers.mjs && node tools/capture.mjs
```
Le script de données refuse toute base qui n'est pas locale.

## Vérifier et rendre
```sh
npx hyperframes check
npx hyperframes render --quality delivery --fps 30 --output renders/PLUME-pub-TikTok.mp4
```
Le projet s'ouvre aussi dans l'application de bureau HyperFrames pour des retouches.
