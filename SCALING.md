# Montée en charge (production / millions d'utilisateurs)

PLUME est conçu pour scaler horizontalement (auth **JWT stateless**, images sur
**Cloudinary**). Ce guide liste ce qui est prêt et ce qu'il reste à faire pour
servir un grand nombre d'utilisateurs.

## 1. Toujours actif (fini la mise en veille)

Le plan **gratuit** Render met le service en veille après 15 min → ~30-50 s de
réveil. Pour de vrais utilisateurs : passer en plan **payant always-on**
(Render Starter ~7 $/mois), ou un hébergeur always-on (Railway, Fly.io, VPS,
AWS/GCP). Aucun changement de code nécessaire.

> 💡 **Option 100 % gratuite et always-on** : héberger sur une VM **Oracle Cloud
> Always Free** (gratuite à vie, jamais en veille) — guide pas-à-pas dans
> [ORACLE_DEPLOY.md](./ORACLE_DEPLOY.md).

## 2. Multi-instances : Redis (déjà intégré, optionnel)

Quand on lance **plusieurs instances** du backend (autoscaling), les états en
mémoire ne sont plus partagés. Le code bascule automatiquement sur **Redis**
dès que la variable `REDIS_URL` est définie — sinon il garde le mode mémoire
(mono-instance / dev). Concerné :

- **Rate-limiting** (login / OTP / reset) — compteur partagé via Redis.
- **Anti-spam messages** — verrou partagé via Redis (`SET NX PX`).
- **Socket.io** — adaptateur Redis : une notification émise par l'instance A
  atteint un client connecté à l'instance B.

### Activer
1. Provisionner un Redis managé (Render Key Value, Upstash, Redis Cloud…).
2. Définir `REDIS_URL=redis://…` (ou `rediss://…`) dans l'environnement.
3. Redémarrer. Le log doit afficher `[REDIS] connecté` et
   `[SOCKET.IO] Adaptateur Redis actif`.

## 3. Base de données : pooling de connexions (déjà câblé)

Prisma ouvre un pool **par instance**. Avec beaucoup d'instances, on épuise vite
les connexions PostgreSQL. Le schéma utilise désormais le pattern Prisma
recommandé **deux URLs** :

- **`DATABASE_URL`** → connexion **poolée** (runtime). En mode pooler, ajouter
  les paramètres, ex. :
  `postgresql://…/db?pgbouncer=true&connection_limit=5&pool_timeout=20`
- **`DIRECT_URL`** → connexion **directe** (migrations / introspection ; un
  pooler en mode « transaction » ne peut pas migrer).

> En **mono-instance / sans pooler**, rien à faire : le script `start` fait
> automatiquement `DIRECT_URL = DATABASE_URL` s'il n'est pas défini. `prisma
> generate` et le runtime fonctionnent sans `DIRECT_URL` (testé).

### Passer en mode pooler (3 étapes)
1. Activer un pooler : **PgBouncer**, le **Connection Pooler** de
   Render/Supabase/Neon, ou **Prisma Accelerate**.
2. `DATABASE_URL` → l'URL **poolée** (avec `pgbouncer=true&connection_limit=…`).
3. `DIRECT_URL` → l'URL **directe** de la base (pour les migrations).

Le client Prisma est déjà un **singleton** (`src/server/prisma.ts`) et le serveur
se **déconnecte proprement** à l'arrêt (SIGTERM/SIGINT) → pas de fuite de
connexions lors des redéploiements/autoscaling.

## 4. Autres points pour la grande échelle

- **Assets web & images** : servis via CDN (Cloudinary pour les images ; mettre
  un CDN devant les fichiers statiques `dist/` si le trafic grossit).
- **Observabilité** : ajouter logs structurés + monitoring (Sentry, métriques).
- **OTP / e-mails** : Brevo doit être configuré (`BREVO_API_KEY`) et a ses
  propres quotas — surveiller à fort volume.
- **Sauvegardes** Postgres et plan de reprise.

## Récapitulatif « prêt à scaler »

| Élément | État |
|---|---|
| Auth stateless (JWT) | ✅ |
| Rate-limit / anti-spam multi-instances | ✅ (via `REDIS_URL`) |
| Socket.io multi-instances | ✅ (via `REDIS_URL`) |
| Arrêt propre (connexions DB) | ✅ |
| Always-on (pas de cold start) | ⏳ plan payant |
| Pooling Postgres | ⏳ PgBouncer / pooler managé |
| CDN / observabilité | ⏳ selon le trafic |
