/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Client Redis OPTIONNEL pour la montée en charge multi-instances.
 *
 * - Si `REDIS_URL` n'est pas défini : `redis` vaut `null` et l'app retombe sur
 *   ses implémentations en mémoire (rate-limiting, anti-spam) et Socket.io sans
 *   adaptateur. Parfait pour le développement et le mono-instance.
 * - Si `REDIS_URL` est défini : le rate-limiting, l'anti-spam et la diffusion
 *   Socket.io deviennent COHÉRENTS entre toutes les instances du backend.
 */

import { Redis } from 'ioredis';

let client: Redis | null = null;

if (process.env.REDIS_URL) {
  client = new Redis(process.env.REDIS_URL, {
    // Évite que des commandes restent bloquées indéfiniment si Redis tombe.
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  });
  client.on('error', (e) => console.error('[REDIS] erreur :', e?.message || e));
  client.on('connect', () => console.log('[REDIS] connecté — mode multi-instances actif.'));
}

export const redis = client;
export const isRedisEnabled = !!client;
