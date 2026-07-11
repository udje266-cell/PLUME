/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Temps de lecture estimé. Base : ~220 mots/minute (moyenne adulte en
 * lecture de loisir). Affiché sur les cartes et les chapitres pour aider à
 * décider de commencer (« ai-je 10 minutes ou 2 heures devant moi ? »).
 */

import type { Story, Chapter } from '../types';

const WORDS_PER_MINUTE = 220;

/** Nombre de mots d'un contenu HTML (les balises ne comptent pas). */
export function wordsOf(html: string | null | undefined): number {
  if (!html) return 0;
  return html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
}

/** Minutes estimées pour un chapitre (minimum 1). */
export function chapterMinutes(chapter: Pick<Chapter, 'content'>): number {
  return Math.max(1, Math.round(wordsOf(chapter.content) / WORDS_PER_MINUTE));
}

/** Minutes estimées pour une œuvre entière (chapitres publiés fournis). */
export function storyMinutes(story: Pick<Story, 'chapters'>): number {
  const words = (story.chapters || []).reduce((sum, c) => sum + wordsOf(c.content), 0);
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/** « ~7 min » ou « ~2 h 05 » — court, pour une puce de carte. */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `~${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `~${h} h ${String(m).padStart(2, '0')}` : `~${h} h`;
}
