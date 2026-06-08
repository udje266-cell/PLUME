/**
 * Gestion du token d'authentification côté client.
 *
 * Le token est conservé UNIQUEMENT en mémoire (jamais dans localStorage) : il
 * n'est donc pas récupérable par un script malveillant via le stockage
 * persistant (atténuation XSS). Il est envoyé en en-tête Authorization pour la
 * session active. En complément, le serveur pose aussi un cookie httpOnly qui
 * permet de ré-authentifier après un rechargement de page (le token mémoire
 * étant alors perdu).
 */

let inMemoryToken: string | null = null;

export function setAuthToken(token: string | null): void {
  inMemoryToken = token || null;
}

export function getAuthToken(): string | null {
  return inMemoryToken;
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
