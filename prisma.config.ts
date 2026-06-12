/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Configuration Prisma (remplace le bloc déprécié `package.json#prisma`).
 * Avec ce fichier, Prisma ne charge plus `.env` automatiquement → on l'importe
 * ici pour le développement local. En production (Render), les variables sont
 * déjà dans l'environnement, donc `dotenv/config` est sans effet.
 */
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
});
