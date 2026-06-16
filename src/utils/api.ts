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
 * au build via `VITE_API_URL` (ex. https://plume-app-fudd.onrender.com).
 *
 * Ce module patche `window.fetch` UNE fois, au plus tôt (importé en tête de
 * main.tsx), afin de :
 *   - réécrire les URLs `/api/...` vers `${API_BASE}/api/...` ;
 *   - joindre automatiquement le token d'auth (Authorization: Bearer …) — requis
 *     en natif où le cookie httpOnly cross-origin n'est pas envoyé ;
 *   - activer `credentials: 'include'` (cookie en web same-origin).
 */

import { getAuthToken } from './auth';
import { Capacitor } from '@capacitor/core';

// URL du backend de production (publique, déjà dans .env.example). Elle sert de
// REPLI pour l'application native lorsque VITE_API_URL n'a pas été injecté au
// build : sans elle, l'APK appellerait `https://localhost/api/...` (l'appareil
// lui-même, où aucun backend ne tourne) et la connexion serait IMPOSSIBLE.
// En web (servi same-origin par Express), on garde une base vide → `/api` relatif.
const DEFAULT_NATIVE_API_BASE = 'https://plume-app-fudd.onrender.com';
const envApiBase = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export const API_BASE = envApiBase || (Capacitor.isNativePlatform() ? DEFAULT_NATIVE_API_BASE : '');

/** Construit une URL absolue vers le backend pour un chemin `/api/...`. */
export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return path.startsWith('/api') ? `${API_BASE}${path}` : path;
}

/**
 * POST JSON vers l'API avec un timeout et des messages d'erreur DIAGNOSTIQUES.
 * Distingue clairement : serveur injoignable (réseau/CORS), délai dépassé
 * (démarrage à froid possible), et erreur applicative — au lieu d'un opaque
 * « erreur de connexion ». Lève une Error dont le `message` est affichable.
 */
export async function apiPost<T = any>(path: string, body: unknown, timeoutMs = 20000): Promise<T> {
  const target = API_BASE || 'le serveur';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new Error(`Le serveur (${target}) met trop de temps à répondre. Il est peut-être en cours de démarrage — patientez ~30 s puis réessayez.`);
    }
    throw new Error(`Impossible de joindre le serveur (${target}). Vérifiez votre connexion internet, puis réessayez.`);
  } finally {
    clearTimeout(timer);
  }
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data && data.error) || `Erreur serveur (${res.status}).`);
  }
  return data as T;
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
