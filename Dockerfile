# ── Étape 1 : Build de l'application ──────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copie des fichiers de dépendances et du schéma Prisma
COPY package*.json ./
COPY prisma ./prisma/

# Installation de toutes les dépendances (nécessaires pour le build)
RUN npm ci

# Copie du reste du code source
COPY . .

# Génération du client Prisma et build (Vite + Server bundle)
RUN npx prisma generate
RUN npm run build

# ── Étape 2 : Runner de Production ────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

# Copie des dépendances et du dossier Prisma pour les migrations
COPY package*.json ./
COPY prisma ./prisma/

# Installation de toutes les dépendances
# Note : Nous installons toutes les dépendances (y compris de dev) afin de conserver le CLI Prisma 
# disponible pour exécuter automatiquement 'prisma migrate deploy' lors du démarrage du conteneur.
RUN npm ci

# Copie des fichiers compilés depuis l'étape de build
COPY --from=builder /app/dist ./dist

# Port par défaut de l'application
EXPOSE 3000

# Commande de lancement (exécute les migrations puis démarre le serveur)
CMD ["npm", "start"]
