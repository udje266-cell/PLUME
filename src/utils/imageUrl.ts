/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Optimisation des images Cloudinary à la livraison. On injecte des
 * transformations dans l'URL (format auto WebP/AVIF, qualité auto, largeur
 * cible) → images 30-70 % plus légères, sans rien changer au stockage ni à la
 * mise en page. Les URLs non-Cloudinary sont renvoyées telles quelles.
 */

const UPLOAD_MARKER = '/image/upload/';

/**
 * Renvoie une URL Cloudinary optimisée.
 * @param url URL d'origine (Cloudinary ou autre)
 * @param width largeur cible en px (la hauteur suit le ratio). Omise → pas de redimensionnement.
 * @param opts.square recadre en carré (avatars/stickers) au lieu de préserver le ratio.
 */
export function optimizedImage(
  url: string | undefined | null,
  width?: number,
  opts?: { square?: boolean },
): string {
  if (!url || typeof url !== 'string') return url || '';
  const i = url.indexOf(UPLOAD_MARKER);
  if (i === -1) return url; // pas une image Cloudinary → inchangée

  // Évite de doubler les transformations si l'URL en contient déjà.
  const after = url.slice(i + UPLOAD_MARKER.length);
  if (/^(f_|q_|c_|w_|h_|e_)/.test(after)) return url;

  const parts = ['f_auto', 'q_auto'];
  if (width && width > 0) {
    // DPR jusqu'à 2 pour les écrans haute densité (mobile), plafonné raisonnablement.
    const w = Math.min(Math.round(width * 2), 1600);
    parts.push(`w_${w}`);
    if (opts?.square) parts.push(`h_${w}`, 'c_fill', 'g_auto');
    else parts.push('c_limit');
  }
  const transform = parts.join(',');
  return `${url.slice(0, i + UPLOAD_MARKER.length)}${transform}/${after}`;
}
