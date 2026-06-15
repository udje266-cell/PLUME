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
