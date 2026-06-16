/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Télémétrie d'erreurs client → serveur (/api/client-error). Permet de détecter
 * les crashs (écran noir, exceptions) dans les logs serveur SANS dépendre d'une
 * capture d'écran de l'utilisateur. Best-effort, jamais bloquant.
 */

// Dédoublonnage : on n'envoie pas dix fois la même erreur dans une session.
const alreadySent = new Set<string>();

export function reportClientError(error: unknown, info?: string): void {
  try {
    const err = error as any;
    const message = String(err?.message ?? err ?? 'unknown').slice(0, 500);
    const key = (message + '|' + (info ?? '').slice(0, 80)).slice(0, 600);
    if (alreadySent.has(key)) return;
    alreadySent.add(key);

    let userId = '';
    try {
      userId = JSON.parse(localStorage.getItem('plume_current_user') || '{}')?.id || '';
    } catch {
      /* ignore */
    }

    const body = JSON.stringify({
      message,
      stack: String(err?.stack ?? '').slice(0, 2000),
      info: String(info ?? '').slice(0, 1500),
      url: typeof location !== 'undefined' ? location.href : '',
      userId,
      ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    });

    // On passe par window.fetch (patché dans api.ts) → l'URL `/api/...` est
    // réécrite vers le backend absolu en natif. keepalive: survit au crash/unload.
    fetch('/api/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      /* best-effort : on n'aggrave jamais un crash en cours */
    });
  } catch {
    /* ignore */
  }
}
