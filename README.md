# PLUME 🪶

Plateforme moderne de **lecture, d'écriture et de partage d'histoires**
francophones — web **et** mobile (Android/iOS via Capacitor).

---

## Sommaire
- [Stack & architecture](#stack--architecture)
- [Démarrage rapide](#démarrage-rapide)
- [Variables d'environnement](#variables-denvironnement)
- [Scripts](#scripts)
- [Structure du projet](#structure-du-projet)
- [Fonctionnalités](#fonctionnalités)
- [Déploiement (web)](#déploiement-web)
- [Applications mobiles](#applications-mobiles)
- [Montée en charge](#montée-en-charge)
- [Sécurité & confidentialité](#sécurité--confidentialité)
- [Tests](#tests)

---

## Stack & architecture

Monorepo **client + serveur** servi par un seul process Express.

| Couche | Techno |
|---|---|
| Frontend | React 19 + Vite 6 + TypeScript + Tailwind v4 |
| Backend | Express 4 + Socket.io 4 (temps réel) |
| Base de données | PostgreSQL via **Prisma** |
| Auth | JWT **stateless** (cookie httpOnly en web + token Bearer en natif) |
| Mobile | **Capacitor** (Android livré, iOS via CI) |
| E-mails (OTP) | Brevo API |
| Images | Cloudinary |

- En production, Express sert le frontend buildé (`dist/`) et expose l'API sous
  `/api/*`.
- En natif, l'app appelle un backend distant : tous les `/api` sont réécrits
  vers `VITE_API_URL` (cf. `src/utils/api.ts`).

---

## Démarrage rapide

**Prérequis :** Node.js 20+, npm, PostgreSQL.

```bash
npm install
cp .env.example .env          # puis renseigner DATABASE_URL et JWT_SECRET
npm run db:generate           # génère le client Prisma
npm run db:migrate            # applique les migrations
npm run db:seed               # (optionnel) données de démarrage
npm run dev                   # http://localhost:3000
```

---

## Variables d'environnement

Voir `.env.example`. Récapitulatif :

| Variable | Obligatoire | Rôle |
|---|---|---|
| `DATABASE_URL` | ✅ | Connexion PostgreSQL (runtime ; poolée en prod) |
| `DIRECT_URL` | ⛅ | Connexion **directe** pour les migrations (repli auto = `DATABASE_URL`) |
| `JWT_SECRET` | ✅ (prod, ≥16 car.) | Signature des JWT |
| `PORT` | — | Port d'écoute (défaut 3000) |
| `BREVO_API_KEY` | ✅ (inscription) | Envoi des codes OTP. **Sans elle, aucun e-mail n'est envoyé** → inscription impossible |
| `SMTP_FROM` | — | Expéditeur des e-mails |
| `VITE_CLOUDINARY_CLOUD_NAME` / `VITE_CLOUDINARY_UPLOAD_PRESET` | ✅ (upload images) | Avatars/bannières/couvertures |
| `VITE_API_URL` | ✅ (build natif) | URL absolue du backend pour l'app mobile |
| `CORS_ORIGINS` / `APP_URL` | — | Origines autorisées (les origines Capacitor sont déjà tolérées) |
| `REDIS_URL` | — | Active la cohérence multi-instances (cf. `SCALING.md`) |

---

## Scripts

| Commande | Description |
|---|---|
| `npm run dev` | Serveur Express + Vite (hot reload) |
| `npm run build` | Build frontend + bundle serveur (`dist/`) |
| `npm start` | Migrations + démarrage production |
| `npm run lint` | Vérification TypeScript (`tsc --noEmit`) |
| `npm test` | Tests Vitest |
| `npm run db:generate` / `db:migrate` / `db:seed` / `db:studio` | Prisma |
| `npm run build:mobile` | Build web seul (pour Capacitor) |
| `npm run cap:sync` / `cap:android` / `cap:ios` / `cap:assets` | Capacitor |

---

## Structure du projet

```
server.ts                 API Express + Socket.io (point d'entrée backend)
prisma/
  schema.prisma           modèle de données (PostgreSQL)
  migrations/             migrations SQL
  seed.ts                 données de démarrage (idempotent)
src/
  main.tsx, App.tsx       entrée + état global du frontend
  components/             écrans (Home, Explorer, Reading, Profile, Messages…)
  utils/
    api.ts                base URL backend + fetch patché (timeout/diagnostic)
    auth.ts               token (mémoire web / Preferences natif)
    native.ts             init Capacitor (splash, status bar, safe-areas, back)
    recommendation.ts     algorithme de diffusion des récits
    achievements.ts       badges & énigmes
  server/
    prisma.ts             client Prisma (singleton)
    redis.ts              client Redis optionnel (multi-instances)
android/                  projet natif Android (Capacitor)
public/                   privacy.html, terms.html, icône
.github/workflows/        CI (build iOS sur runner macOS)
MOBILE.md  SCALING.md     guides dédiés
```

---

## Fonctionnalités

- **Lecture** : récits multi-chapitres, mode lecture augmentée, progression,
  favoris, likes, notes (1-5), historique.
- **Écriture** : création de récits/chapitres, couvertures, brouillons/publié.
- **Social** : abonnements, amis, messages privés & groupes (Socket.io),
  commentaires + réponses, blocage, signalement (modération UGC).
- **Découverte** : fil « Pour toi » avec un **algorithme de recommandation**
  (affinité, social, qualité bayésienne, popularité à déclin temporel,
  cold-start, exploration, filtrage collaboratif) ; recherche insensible
  casse/accents incluant les **profils**.
- **Gamification** : 225 badges (lecteur/auteur) avec **énigmes** au clic ;
  certification automatique des auteurs.
- **Compte** : inscription par **OTP e-mail**, réinitialisation de mot de passe,
  **suppression de compte** in-app, paramètres de confidentialité.
- **UI** : mobile-first, mode sombre, fermeture des overlays au tap extérieur.

---

## Déploiement (web)

Déploiement type **Render** via `render.yaml` (blueprint) :
- `buildCommand: npm install && npx prisma generate && npm run build`
- `startCommand: npm start` (lance les migrations puis le serveur)
- Renseigner les variables d'env (DATABASE_URL est branché sur la base managée ;
  `JWT_SECRET` généré ; `BREVO_API_KEY`, Cloudinary à fournir).

> ⚠️ Le plan **gratuit met le service en veille** (cold start ~30-50 s). Pour de
> vrais utilisateurs, passer en plan **always-on** (cf. `SCALING.md`).

---

## Applications mobiles

Voir **[MOBILE.md](./MOBILE.md)** : build Android (APK/AAB), iOS (sur Mac **ou**
via le workflow GitHub Actions macOS), icônes/splash, et **checklist de
conformité stores** (politique de confidentialité, CGU, suppression de compte,
modération…).

---

## Montée en charge

Voir **[SCALING.md](./SCALING.md)** : passage always-on, **Redis** optionnel
(rate-limiting, anti-spam, adaptateur Socket.io multi-instances), **pooling
Postgres** (pattern `DATABASE_URL` poolée + `DIRECT_URL` directe), arrêt propre.

---

## Sécurité & confidentialité

- JWT signé (secret obligatoire ≥16 car. en prod) ; token natif en stockage
  sécurisé, jamais dans `localStorage` (atténuation XSS).
- Mots de passe **hachés** (bcrypt), OTP expirant + anti-bruteforce.
- **Rate-limiting** sur login/OTP/reset ; **anti-spam** messages.
- Vérifications d'autorisation (IDOR) sur les routes de modification.
- Bornes de taille sur les champs texte (anti-DoS).
- Pages légales servies : `/privacy.html`, `/terms.html`.

---

## Tests

```bash
npm run lint    # typecheck
npm test        # Vitest (utils : recommandation, accomplissements, âge)
```
