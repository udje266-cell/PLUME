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
  scrollRatio: number; // 0..1 dans le chapitre courant (repli historique)
  paragraphIndex?: number; // index du paragraphe en cours -> reprise a la ligne
  percent: number;     // 0..100 sur l'ensemble du livre (calcule sur les paragraphes)
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
  p: { chapterIndex: number; scrollRatio: number; percent: number; paragraphIndex?: number },
): void {
  try {
    const all = readAll(userId);
    all[storyId] = {
      chapterIndex: p.chapterIndex,
      scrollRatio: Math.max(0, Math.min(1, p.scrollRatio)),
      paragraphIndex: typeof p.paragraphIndex === 'number' && p.paragraphIndex >= 0 ? Math.round(p.paragraphIndex) : undefined,
      percent: Math.max(0, Math.min(100, Math.round(p.percent))),
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(keyFor(userId), JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

// ── Progression basée sur les PARAGRAPHES (helpers PURS, testables) ──

export interface ParaMeta {
  counts: number[];      // nombre de paragraphes par chapitre (>= 1)
  cumulative: number[];  // paragraphes cumulés AVANT chaque chapitre
  total: number;         // total des paragraphes du livre (>= 1)
}

/** Construit les métriques de paragraphes à partir du compte par chapitre. */
export function buildParaMeta(paragraphCounts: number[]): ParaMeta {
  const counts = (paragraphCounts || []).map((c) => Math.max(1, Math.floor(c) || 1));
  const cumulative: number[] = [];
  let acc = 0;
  for (const c of counts) { cumulative.push(acc); acc += c; }
  return { counts, cumulative, total: Math.max(1, acc) };
}

/**
 * Pourcentage de lecture du LIVRE (0..100) calculé sur les paragraphes :
 * (paragraphes des chapitres précédents + paragraphe courant) / total.
 */
export function bookPercentFromParagraph(meta: ParaMeta, chapterIndex: number, paraIndex: number): number {
  if (!meta || !meta.counts.length) return 0;
  const ci = Math.max(0, Math.min(chapterIndex, meta.counts.length - 1));
  const chapCount = meta.counts[ci] || 1;
  const p = Math.max(0, Math.min(paraIndex, chapCount));
  const readParas = (meta.cumulative[ci] || 0) + p;
  return Math.max(0, Math.min(100, Math.round((readParas / meta.total) * 100)));
}

/** Fraction (0..100) de paragraphes lus DANS le chapitre courant (pour le serveur). */
export function chapterParaFraction(paraIndex: number, chapterParaCount: number): number {
  const count = Math.max(1, chapterParaCount);
  return Math.max(0, Math.min(100, Math.round((Math.max(0, paraIndex) / count) * 100)));
}

/** Reconvertit une fraction serveur (0..1) en index de paragraphe cible. */
export function paragraphFromChapterFraction(fraction: number, chapterParaCount: number): number {
  const count = Math.max(1, chapterParaCount);
  const f = Math.max(0, Math.min(1, fraction));
  return Math.min(count - 1, Math.max(0, Math.round(f * count)));
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
