/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Garde-fou de build : vérifie que l'URL du backend est bien GRAVÉE dans le
 * bundle client. C'est la panne exacte qui a empêché l'APK de se connecter :
 * VITE_API_URL absent au build → API_BASE vide → l'app native appelle
 * `https://localhost/api` (l'appareil lui-même) au lieu du serveur.
 *
 * Échoue (exit 1) si aucune URL de backend n'est trouvée → le build casse au
 * lieu de produire un APK silencieusement inutilisable.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ASSETS_DIR = 'dist/assets';

let bundle = '';
try {
  for (const f of readdirSync(ASSETS_DIR)) {
    if (f.endsWith('.js')) bundle += readFileSync(join(ASSETS_DIR, f), 'utf8');
  }
} catch {
  console.error('[verify-build] ÉCHEC : dist/assets introuvable — le build Vite a-t-il tourné ?');
  process.exit(1);
}

const envUrl = process.env.VITE_API_URL || '';
let expectedHost = 'onrender.com'; // repli natif gravé dans src/utils/api.ts
try {
  if (envUrl) expectedHost = new URL(envUrl).host;
} catch {
  /* URL invalide → on retombe sur le repli */
}

if (!bundle.includes(expectedHost)) {
  console.error(`\n[verify-build] ÉCHEC : l'URL du backend ("${expectedHost}") est ABSENTE du bundle.`);
  console.error("  → Sans elle, l'APK appelle https://localhost/api et NE PEUT PAS se connecter.");
  console.error('  → Définis VITE_API_URL au build, ou vérifie le repli natif dans src/utils/api.ts.\n');
  process.exit(1);
}

console.log(`[verify-build] OK : URL backend "${expectedHost}" présente dans le bundle.`);
