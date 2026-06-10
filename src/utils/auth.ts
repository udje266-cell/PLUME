/**
 * Gestion du token d'authentification côté client.
 *
 * Web (servi same-origin) : le token est conservé UNIQUEMENT en mémoire (jamais
 * dans localStorage) — atténuation XSS — et le serveur pose en complément un
 * cookie httpOnly qui ré-authentifie après un rechargement de page.
 *
 * Natif (Capacitor) : il n'y a pas de cookie cross-origin envoyé au backend, et
 * le token en mémoire est perdu à chaque ouverture de l'app → on PERSISTE donc
 * le token dans le stockage natif (Capacitor Preferences) pour rester connecté.
 * Cette persistance n'a lieu QUE sur plateforme native, jamais en web.
 */

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const TOKEN_KEY = 'plume_auth_token';
const isNative = Capacitor.isNativePlatform();

let inMemoryToken: string | null = null;

export function setAuthToken(token: string | null): void {
  inMemoryToken = token || null;
  // Persistance réservée au natif (cf. en-tête de fichier).
  if (isNative) {
    if (token) {
      Preferences.set({ key: TOKEN_KEY, value: token }).catch(() => {});
    } else {
      Preferences.remove({ key: TOKEN_KEY }).catch(() => {});
    }
  }
}

export function getAuthToken(): string | null {
  return inMemoryToken;
}

/**
 * Réhydrate le token persistant au démarrage (natif uniquement). À appeler très
 * tôt, avant le premier appel API authentifié. No-op en web.
 * @returns le token restauré, ou null.
 */
export async function restoreAuthToken(): Promise<string | null> {
  if (!isNative) return null;
  try {
    const { value } = await Preferences.get({ key: TOKEN_KEY });
    if (value) inMemoryToken = value;
    return value || null;
  } catch {
    return null;
  }
}

/**
 * Construit les en-têtes d'une requête authentifiée. Ajoute Authorization
 * seulement si un token mémoire est disponible ; sinon on s'appuie sur le
 * cookie httpOnly (envoyé automatiquement en same-origin).
 */
export function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    ...extra,
    ...(inMemoryToken ? { Authorization: `Bearer ${inMemoryToken}` } : {}),
  };
}
