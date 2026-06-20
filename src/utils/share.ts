/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Partage de récits : URL réelle, Web Share API native et liens d'intention
 * vers les réseaux. Remplace l'ancien partage factice (alertes + domaine
 * inexistant `plume.app`).
 */

// URL PUBLIQUE CANONIQUE de PLUME : le backend deploye sert AUSSI la SPA et gere
// les liens profonds (`?recit=`, `?joingroup=`). C'est le repli ultime garanti
// pour que les liens partages aient TOUJOURS un domaine reel et fonctionnel
// (notamment dans l'app native, ou window.location.origin = localhost/capacitor
// et ou VITE_API_URL peut ne pas etre injecte au build). A mettre a jour ici en
// cas de domaine personnalise.
const PLUME_PUBLIC_URL = 'https://plume-app-fudd.onrender.com';

/**
 * URL de base réelle et atteignable de l'application. Renvoie TOUJOURS un domaine
 * absolu (jamais une chaine vide ni un lien sans hote) :
 *  1. en web, l'origine courante si elle est partageable (le backend sert la SPA) ;
 *  2. sinon `VITE_API_URL` si fourni au build ;
 *  3. sinon l'URL publique canonique ci-dessus.
 */
export function appBaseUrl(): string {
  try {
    const origin = window.location.origin || '';
    const isShareable = /^https?:\/\//i.test(origin) && !/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(origin);
    if (isShareable) return origin.replace(/\/+$/, '');
  } catch {
    /* window indisponible */
  }
  const apiUrl = ((import.meta.env.VITE_API_URL as string | undefined) || '').trim();
  if (/^https?:\/\//i.test(apiUrl)) return apiUrl.replace(/\/+$/, '');
  return PLUME_PUBLIC_URL;
}

/** Lien profond réel vers un récit. Format par CHEMIN (`/r/<id>`) pour permettre
 *  les App Links Android (ouverture directe dans l'app). Compat : l'ancienne
 *  forme `?recit=<id>` reste consommée par l'app. */
export function storyShareUrl(storyId: string): string {
  return `${appBaseUrl()}/r/${encodeURIComponent(storyId)}`;
}

/** Lien d'invitation réel vers un groupe (`/g/<code>`), App-Links-compatible. */
export function groupInviteUrl(code: string): string {
  return `${appBaseUrl()}/g/${encodeURIComponent(code)}`;
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
