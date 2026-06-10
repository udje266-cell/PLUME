/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Configuration de l'accès au backend.
 *
 * En web (servi par le serveur Express), les appels sont same-origin et `/api`
 * suffit. Dans le build natif (Capacitor), l'app tourne sur une origine locale
 * (capacitor://localhost) sans serveur : les appels relatifs `/api` échouent.
 * On préfixe donc tous les appels `/api` par l'URL absolue du backend, fournie
 * au build via `VITE_API_URL` (ex. https://plume-app.onrender.com).
 *
 * Ce module patche `window.fetch` UNE fois, au plus tôt (importé en tête de
 * main.tsx), afin de :
 *   - réécrire les URLs `/api/...` vers `${API_BASE}/api/...` ;
 *   - joindre automatiquement le token d'auth (Authorization: Bearer …) — requis
 *     en natif où le cookie httpOnly cross-origin n'est pas envoyé ;
 *   - activer `credentials: 'include'` (cookie en web same-origin).
 */

import { getAuthToken } from './auth';

export const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

/** Construit une URL absolue vers le backend pour un chemin `/api/...`. */
export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return path.startsWith('/api') ? `${API_BASE}${path}` : path;
}

function isApiPath(url: string): boolean {
  return url.startsWith('/api') || (!!API_BASE && url.startsWith(`${API_BASE}/api`));
}

if (typeof window !== 'undefined' && !(window as any).__plumeFetchPatched) {
  (window as any).__plumeFetchPatched = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    try {
      let url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;

      if (isApiPath(url)) {
        // Réécriture de l'URL vers le backend absolu (no-op si API_BASE vide).
        const absolute = apiUrl(url);

        // Fusion des en-têtes + injection du token d'auth si présent.
        const headers = new Headers(
          input instanceof Request ? input.headers : init?.headers || {},
        );
        const token = getAuthToken();
        if (token && !headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${token}`);
        }

        const nextInit: RequestInit = { credentials: 'include', ...init, headers };

        if (input instanceof Request) {
          return originalFetch(new Request(absolute, input), nextInit);
        }
        return originalFetch(absolute, nextInit);
      }
    } catch {
      /* en cas de souci d'analyse, on laisse passer la requête telle quelle */
    }
    return originalFetch(input as any, init);
  };
}
