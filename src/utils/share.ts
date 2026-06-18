/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Partage de récits : URL réelle, Web Share API native et liens d'intention
 * vers les réseaux. Remplace l'ancien partage factice (alertes + domaine
 * inexistant `plume.app`).
 */

/**
 * URL de base réelle et atteignable de l'application.
 * - En web, c'est l'origine courante (le backend sert la SPA).
 * - En natif (Capacitor : origine `capacitor://`, `http://localhost`, …),
 *   l'origine n'est pas partageable : on retombe sur `VITE_API_URL`, qui
 *   pointe vers le backend déployé qui sert aussi la SPA.
 */
export function appBaseUrl(): string {
  const apiUrl = (import.meta.env.VITE_API_URL as string | undefined) || '';
  try {
    const origin = window.location.origin || '';
    const isShareable = /^https?:\/\//i.test(origin) && !/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(origin);
    if (isShareable) return origin.replace(/\/+$/, '');
  } catch {
    /* window indisponible */
  }
  return apiUrl.replace(/\/+$/, '');
}

/** Lien profond réel vers un récit (consommé au démarrage via `?recit=`). */
export function storyShareUrl(storyId: string): string {
  const base = appBaseUrl();
  return base ? `${base}/?recit=${encodeURIComponent(storyId)}` : `?recit=${encodeURIComponent(storyId)}`;
}

/**
 * Partage natif via la Web Share API (feuille de partage système du téléphone).
 * Renvoie `true` si la feuille a bien été ouverte, `false` si l'API est absente
 * ou si l'utilisateur a annulé / une erreur est survenue (l'appelant peut alors
 * afficher son propre repli).
 */
export async function shareStoryNative(data: { title: string; text: string; url: string }): Promise<boolean> {
  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
  if (typeof nav.share !== 'function') return false;
  try {
    await nav.share({ title: data.title, text: data.text, url: data.url });
    return true;
  } catch {
    // AbortError (annulation) ou indisponibilité : repli géré par l'appelant.
    return false;
  }
}

export type ShareNetwork = 'whatsapp' | 'facebook' | 'twitter' | 'telegram';

/** Construit un lien d'intention réel vers le réseau social demandé. */
export function shareIntentUrl(network: ShareNetwork, opts: { url: string; text: string }): string {
  const u = encodeURIComponent(opts.url);
  const t = encodeURIComponent(opts.text);
  switch (network) {
    case 'whatsapp':
      return `https://wa.me/?text=${encodeURIComponent(`${opts.text} ${opts.url}`)}`;
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${u}`;
    case 'twitter':
      return `https://twitter.com/intent/tweet?text=${t}&url=${u}`;
    case 'telegram':
      return `https://t.me/share/url?url=${u}&text=${t}`;
  }
}

/** Ouvre un lien de partage dans un nouvel onglet, sans fuite d'opener. */
export function openShareIntent(network: ShareNetwork, opts: { url: string; text: string }): void {
  const href = shareIntentUrl(network, opts);
  window.open(href, '_blank', 'noopener,noreferrer');
}
