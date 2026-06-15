/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Progression de lecture PERSISTANTE et PAR LIVRE. On mémorise, pour chaque
 * récit, le chapitre en cours, la position de défilement et le pourcentage réel
 * → on reprend exactement là où on s'était arrêté, même après avoir lu d'autres
 * livres entre-temps.
 */

export interface BookProgress {
  chapterIndex: number;
  scrollRatio: number; // 0..1 dans le chapitre courant
  percent: number;     // 0..100 sur l'ensemble du livre
  updatedAt: string;
}

const keyFor = (userId?: string) => `plume_book_progress_${userId || 'guest'}`;

function readAll(userId?: string): Record<string, BookProgress> {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === 'object' ? obj : {};
  } catch {
    return {};
  }
}

export function getBookProgress(userId: string | undefined, storyId: string): BookProgress | null {
  return readAll(userId)[storyId] || null;
}

export function saveBookProgress(
  userId: string | undefined,
  storyId: string,
  p: { chapterIndex: number; scrollRatio: number; percent: number },
): void {
  try {
    const all = readAll(userId);
    all[storyId] = {
      chapterIndex: p.chapterIndex,
      scrollRatio: Math.max(0, Math.min(1, p.scrollRatio)),
      percent: Math.max(0, Math.min(100, Math.round(p.percent))),
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(keyFor(userId), JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

/** Trouve l'ancêtre défilable d'un élément (sinon null → window). */
export function getScrollParent(el: HTMLElement | null): HTMLElement | null {
  let p = el?.parentElement || null;
  while (p) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight + 4) return p;
    p = p.parentElement;
  }
  return null;
}
