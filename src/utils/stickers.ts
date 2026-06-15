/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Stickers de la messagerie. Un sticker est envoyé comme un message dont le
 * contenu est encodé `[sticker]<valeur>` (même principe que les notes vocales) :
 *   - valeur = un emoji  → sticker de base (gérés ici)
 *   - valeur = une URL   → sticker personnalisé (image téléversée par l'utilisateur)
 */

export const STICKER_PREFIX = '[sticker]';

/** Stickers de base, fournis et gérés par l'application (grands emojis). */
export const BASE_STICKERS: string[] = [
  '🪶', '📖', '✍️', '❤️', '🔥', '🎉', '😂', '🥹', '😍', '🥳',
  '😎', '🤔', '👏', '🙌', '👍', '🙏', '💜', '🌟', '✨', '🌹',
  '☕', '🌙', '😭', '🤯', '👀', '💯', '🫶', '🤝', '😴', '🌊',
];

const KEY = 'plume_custom_stickers_v1';

/** Stickers personnalisés (URLs d'images) créés par l'utilisateur. */
export function getCustomStickers(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function addCustomSticker(url: string): void {
  try {
    const list = getCustomStickers().filter((u) => u !== url);
    list.unshift(url);
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 60)));
  } catch {
    /* ignore */
  }
}

export function removeCustomSticker(url: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(getCustomStickers().filter((u) => u !== url)));
  } catch {
    /* ignore */
  }
}

/** Encode une valeur de sticker en contenu de message. */
export function encodeSticker(value: string): string {
  return `${STICKER_PREFIX}${value}`;
}

/** Si le contenu est un sticker, renvoie sa valeur (emoji ou URL), sinon null. */
export function parseSticker(content: string): string | null {
  if (typeof content === 'string' && content.startsWith(STICKER_PREFIX)) {
    return content.slice(STICKER_PREFIX.length);
  }
  return null;
}

export function isStickerUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/** Vrai si le sticker est une VIDÉO (URL de livraison vidéo Cloudinary). */
export function isVideoSticker(value: string): boolean {
  return /\/video\/upload\//i.test(value) || /\.(mp4|webm|mov)(\?|#|$)/i.test(value);
}

/**
 * Construit l'URL d'un sticker vidéo rogné (carré) et découpé à partir de l'URL
 * Cloudinary d'origine. Le rognage (x/y/w/h en pixels source) et la découpe
 * (start/end en secondes) sont appliqués à la livraison — léger et instantané.
 */
export function buildVideoStickerUrl(
  secureUrl: string,
  opts: { x: number; y: number; w: number; h: number; start: number; end: number },
): string {
  const marker = '/upload/';
  const i = secureUrl.indexOf(marker);
  if (i === -1) return secureUrl;
  const head = secureUrl.slice(0, i + marker.length);
  // Force l'extension .mp4 pour une lecture fiable dans <video> (Cloudinary
  // transcode grâce à f_mp4 quel que soit le format source).
  const tail = secureUrl.slice(i + marker.length).replace(/\.[a-z0-9]+(\?.*)?$/i, '.mp4');
  const x = Math.max(0, Math.round(opts.x));
  const y = Math.max(0, Math.round(opts.y));
  const w = Math.max(1, Math.round(opts.w));
  const h = Math.max(1, Math.round(opts.h));
  const start = Math.max(0, Number(opts.start.toFixed(2)));
  const end = Math.max(start + 0.2, Number(opts.end.toFixed(2)));
  // 1) découpe (so_/eo_) · 2) rognage carré dans la source · 3) mise à l'échelle + mp4.
  const transforms = [
    `so_${start},eo_${end}`,
    `c_crop,x_${x},y_${y},w_${w},h_${h}`,
    `c_fill,w_400,h_400,q_auto:good,f_mp4`,
  ].join('/');
  return `${head}${transforms}/${tail}`;
}
