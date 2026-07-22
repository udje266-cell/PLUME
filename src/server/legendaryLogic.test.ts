/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect } from 'vitest';
import {
  yearsBetween,
  hasCompletedOldWork,
  coversAllGenres,
  hasWeeklyStreak,
  hasFlawlessWork,
  hasLivingUniverse,
} from './legendaryLogic';

const DAY = 24 * 60 * 60 * 1000;
const YEAR = 365.25 * DAY;
const NOW = Date.UTC(2026, 0, 1); // reference deterministe

describe('yearsBetween', () => {
  it('mesure les annees ecoulees', () => {
    expect(yearsBetween(NOW - 5 * YEAR, NOW)).toBeCloseTo(5, 1);
  });
});

describe('hasCompletedOldWork', () => {
  it('vrai si une œuvre terminee a demarre il y a >= 5 ans', () => {
    expect(hasCompletedOldWork([NOW - 5.2 * YEAR], NOW, 5)).toBe(true);
  });
  it('faux si toutes les œuvres sont plus recentes', () => {
    expect(hasCompletedOldWork([NOW - 2 * YEAR, NOW - 4.9 * YEAR], NOW, 5)).toBe(false);
  });
  it('faux si aucune œuvre terminee', () => {
    expect(hasCompletedOldWork([], NOW, 5)).toBe(false);
  });
});

describe('coversAllGenres', () => {
  const ALL = ['Fantasy', 'Romance', 'Drame'];
  it('vrai quand tous les genres sont couverts (casse/espaces ignores)', () => {
    expect(coversAllGenres([' fantasy ', 'ROMANCE', 'Drame'], ALL)).toBe(true);
  });
  it('faux quand un genre manque', () => {
    expect(coversAllGenres(['Fantasy', 'Romance'], ALL)).toBe(false);
  });
  it('faux quand la liste de reference est vide', () => {
    expect(coversAllGenres(['Fantasy'], [])).toBe(false);
  });
});

describe('hasWeeklyStreak', () => {
  it('vrai pour une publication chaque semaine pendant 3 ans', () => {
    const events: number[] = [];
    const weeks = Math.ceil((3 * YEAR) / (7 * DAY)) + 4;
    for (let w = 0; w <= weeks; w++) events.push(NOW - 3 * YEAR + w * 7 * DAY);
    expect(hasWeeklyStreak(events, 3)).toBe(true);
  });
  it('faux s\'il manque une semaine (interruption)', () => {
    const events: number[] = [];
    const weeks = Math.ceil((3 * YEAR) / (7 * DAY)) + 4;
    for (let w = 0; w <= weeks; w++) {
      if (w === 40) continue; // trou d'une semaine => streak rompu, aucune sous-serie n'atteint 3 ans
      events.push(NOW - 3 * YEAR + w * 7 * DAY);
    }
    expect(hasWeeklyStreak(events, 3)).toBe(false);
  });
  it('vrai meme si la serie est achevee dans le passe', () => {
    const events: number[] = [];
    const weeks = Math.ceil((3 * YEAR) / (7 * DAY)) + 4;
    // Serie terminee il y a ~2 ans (aucun lien avec "maintenant").
    for (let w = 0; w <= weeks; w++) events.push(NOW - 6 * YEAR + w * 7 * DAY);
    expect(hasWeeklyStreak(events, 3)).toBe(true);
  });
  it('faux pour trop peu d\'evenements', () => {
    expect(hasWeeklyStreak([NOW - DAY, NOW], 3)).toBe(false);
  });
  it('faux pour une liste vide', () => {
    expect(hasWeeklyStreak([], 3)).toBe(false);
  });
});

describe('hasFlawlessWork', () => {
  it('vrai pour une œuvre complete jamais re-editee', () => {
    expect(hasFlawlessWork([{ publishedChapters: 5, maxEditGapMs: 500, complete: true }], 3, 1000)).toBe(true);
  });
  it('faux si un chapitre a ete modifie apres publication', () => {
    expect(hasFlawlessWork([{ publishedChapters: 5, maxEditGapMs: 10 * DAY, complete: true }], 3, 1000)).toBe(false);
  });
  it('faux si l\'œuvre est trop courte', () => {
    expect(hasFlawlessWork([{ publishedChapters: 1, maxEditGapMs: 0, complete: true }], 3, 1000)).toBe(false);
  });
  it('faux si l\'œuvre n\'est pas complete', () => {
    expect(hasFlawlessWork([{ publishedChapters: 5, maxEditGapMs: 0, complete: false }], 3, 1000)).toBe(false);
  });
});

describe('hasLivingUniverse', () => {
  it('vrai quand un marqueur relie assez d\'œuvres', () => {
    expect(hasLivingUniverse([1, 3, 2], 3)).toBe(true);
  });
  it('faux quand aucun marqueur ne relie assez d\'œuvres', () => {
    expect(hasLivingUniverse([1, 2, 2], 3)).toBe(false);
  });
});
