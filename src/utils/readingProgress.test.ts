/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Tests du calcul de progression de lecture BASÉ SUR LES PARAGRAPHES.
 */

import { describe, it, expect } from 'vitest';
import {
  buildParaMeta,
  bookPercentFromParagraph,
  chapterParaFraction,
  paragraphFromChapterFraction,
} from './readingProgress';

describe('buildParaMeta', () => {
  it('calcule le cumul et le total', () => {
    const meta = buildParaMeta([3, 5, 2]);
    expect(meta.counts).toEqual([3, 5, 2]);
    expect(meta.cumulative).toEqual([0, 3, 8]);
    expect(meta.total).toBe(10);
  });

  it('force au moins 1 paragraphe par chapitre (chapitre vide)', () => {
    const meta = buildParaMeta([0, 4]);
    expect(meta.counts).toEqual([1, 4]);
    expect(meta.total).toBe(5);
  });

  it('gère une liste vide sans planter', () => {
    const meta = buildParaMeta([]);
    expect(meta.total).toBe(1);
    expect(meta.counts).toEqual([]);
  });
});

describe('bookPercentFromParagraph', () => {
  const meta = buildParaMeta([4, 6]); // total 10 paragraphes

  it('0 % au tout début', () => {
    expect(bookPercentFromParagraph(meta, 0, 0)).toBe(0);
  });

  it('avance au sein du 1er chapitre', () => {
    expect(bookPercentFromParagraph(meta, 0, 2)).toBe(20); // 2/10
  });

  it('tient compte des chapitres précédents', () => {
    // chapitre 1 (4 paragraphes cumulés) + paragraphe 3 = 7/10
    expect(bookPercentFromParagraph(meta, 1, 3)).toBe(70);
  });

  it('atteint 100 % à la fin du dernier chapitre', () => {
    expect(bookPercentFromParagraph(meta, 1, 6)).toBe(100); // 4 + 6 = 10/10
  });

  it('borne les index hors limites', () => {
    expect(bookPercentFromParagraph(meta, 1, 999)).toBe(100);
    expect(bookPercentFromParagraph(meta, -5, -5)).toBe(0);
    expect(bookPercentFromParagraph(meta, 99, 0)).toBe(40); // dernier chapitre, para 0 -> 4/10
  });

  it('est monotone croissant au fil de la lecture', () => {
    const seq = [
      bookPercentFromParagraph(meta, 0, 0),
      bookPercentFromParagraph(meta, 0, 3),
      bookPercentFromParagraph(meta, 1, 0),
      bookPercentFromParagraph(meta, 1, 5),
    ];
    for (let i = 1; i < seq.length; i++) expect(seq[i]).toBeGreaterThanOrEqual(seq[i - 1]);
  });
});

describe('chapterParaFraction (envoi serveur) ⇄ paragraphFromChapterFraction (reprise)', () => {
  it('convertit un index de paragraphe en pourcentage de chapitre', () => {
    expect(chapterParaFraction(0, 10)).toBe(0);
    expect(chapterParaFraction(5, 10)).toBe(50);
    expect(chapterParaFraction(10, 10)).toBe(100);
  });

  it('reconvertit une fraction serveur en index de paragraphe', () => {
    expect(paragraphFromChapterFraction(0, 10)).toBe(0);
    expect(paragraphFromChapterFraction(0.5, 10)).toBe(5);
    // borné au dernier paragraphe
    expect(paragraphFromChapterFraction(1, 10)).toBe(9);
  });

  it('aller-retour approximativement stable (± 1 paragraphe)', () => {
    const chapCount = 20;
    for (const para of [0, 3, 7, 12, 19]) {
      const pct = chapterParaFraction(para, chapCount);
      const back = paragraphFromChapterFraction(pct / 100, chapCount);
      expect(Math.abs(back - para)).toBeLessThanOrEqual(1);
    }
  });
});
