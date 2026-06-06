# PLUME

Plateforme moderne de lecture, d'écriture et de partage d'histoires francophones.

## Prérequis

- Node.js 20+
- npm

## Installation

```bash
npm install
cp .env.example .env
```

Éditez `.env` et configurez au minimum `DATABASE_URL` et `JWT_SECRET`.

## Base de données

Le projet utilise **SQLite** via Prisma.

```bash
# Générer le client Prisma
npm run db:generate

# Appliquer les migrations (crée prisma/dev.db)
npm run db:migrate

# Interface visuelle (optionnel)
npm run db:studio
```

### Migrer d'anciennes données JSON

Si vous disposez d'un fichier `data/db.json` :

```bash
npx tsx scripts/migrate-json-to-prisma.ts
```

## Lancer en développement

```bash
npm run dev
```

L'application est accessible sur [http://localhost:3000](http://localhost:3000).

## Scripts utiles

| Commande | Description |
|----------|-------------|
| `npm run dev` | Serveur Express + Vite (hot reload) |
| `npm run build` | Build frontend + bundle serveur |
| `npm start` | Démarrer en production |
| `npm run lint` | Vérification TypeScript |
| `npm test` | Tests Vitest |
| `npm run db:migrate` | Migrations Prisma |
| `npm run db:studio` | Prisma Studio |

## Variables d'environnement

| Variable | Obligatoire | Description |
|----------|-------------|-------------|
| `DATABASE_URL` | Oui | `file:./prisma/dev.db` (SQLite) |
| `JWT_SECRET` | Prod | Secret de signature des tokens |
| `SMTP_*` | Non | Envoi d'e-mails OTP (sinon console) |
| `VITE_CLOUDINARY_*` | Non | Upload couvertures et avatars |
| `GEMINI_API_KEY` | Non | IA (non branchée actuellement) |

## Architecture

- **Frontend** : React 19 + Vite + Tailwind CSS
- **Backend** : Express + Socket.io
- **ORM** : Prisma (SQLite)
- **Mobile** : Capacitor (Android)

```
src/
  components/   # Vues React (lecture, écriture, profil, messagerie…)
  server/       # Client Prisma
  utils/        # Utilitaires (âge, achievements, upload)
server.ts       # API REST + WebSocket
prisma/         # Schéma et migrations
```

## Application Android

```bash
npm run build
npx cap sync android
npx cap open android
```

## Tests

```bash
npm test
```
