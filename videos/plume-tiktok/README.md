# PLUME — Encore un chapitre

Publicité TikTok verticale : 1080 × 1920, 30 images/s, 2 min 14 s.
La voix off fournie dure 130,93 s ; le carton final reste après sa conclusion.

Le montage utilise les véritables écrans de PLUME, des livres et comptes de démonstration locaux, la plume originale de l'application, une musique instrumentale originale et les effets sonores crédités dans `assets/audio/SFX-CREDITS.md`. Les comptes et livres sont supprimés après les captures.

Le projet s'ouvre et se modifie dans **HyperFrames desktop app**, ou avec le CLI épinglé :

```sh
npm run dev
npm run check
npm run render -- --quality delivery --fps 30 --workers 4 --output renders/PLUME-TikTok.mp4
```

Pour les agents, lancer `npx hyperframes preview --background`, puis vérifier l'URL du projet avant rendu. Ne pas importer les captures dans un dessin de téléphone ni modifier les interfaces à la main.

- `index.html` : séquence principale et pistes sonores.
- `compositions/` : un fichier par scène et une piste de sous-titres.
- `assets/screens/` : captures de l'application ; `CAPTURES.json` décrit leur provenance.
- `VOIX-OFF.txt` : texte transmis pour l'enregistrement.
- `transcript.json` / `PLUME-sous-titres.srt` : français corrigé d'après le script, temps mesurés dans l'audio fourni.
- `INSPIRATIONS.md` : références consultées et limites d'accès à Pinterest/YouTube.
- `FEATURES.md` : liens entre les promesses et le code de l'application.
- `SPEC.md` / `REVIEW.md` : choix de réalisation et contrôles.

`tools/capture.mjs` crée des données jetables dans une base **locale uniquement** et nettoie dans `finally`. Il se lance depuis la racine du dépôt avec Prisma, un serveur PLUME local sur le port 3001, et Playwright. Aucun compte de production n'est nécessaire. `tools/build.py` reconstruit les scènes à partir des captures et de l'alignement audio déjà inclus ; il ne télécharge aucun modèle. `tools/music.py` synthétise la musique originale avec NumPy/SciPy et FFmpeg.

Les durées des scènes suivent la voix de Claire fournie par le propriétaire. Changer la narration nécessite de refaire les points de coupe et les sous-titres. L'annonce finale exprime une disponibilité **à venir**, sans date ni badge de store.
