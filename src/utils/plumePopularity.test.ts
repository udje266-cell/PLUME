/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect } from 'vitest';
import { computePlumePopularity, PLUME_LEVELS } from './plumePopularity';

describe('computePlumePopularity', () => {
  it('niveau 0 pour un nouveau compte', () => {
    const p = computePlumePopularity(0, 0, 0);
    expect(p.level).toBe(0);
    expect(p.name).toBe('Nouvelle Page');
    expect(p.next?.level).toBe(1);
  });

  it('atteint le niveau 1 quand les trois seuils sont satisfaits', () => {
    const p = computePlumePopularity(500, 20, 10);
    expect(p.level).toBe(1);
    expect(p.name).toBe('Nouvelle Histoire');
  });

  it('ne monte PAS de niveau si une seule metrique manque', () => {
    // Lectures et mentions OK, mais abonnes insuffisants -> reste niveau 0.
    const p = computePlumePopularity(5_000, 200, 9);
    expect(p.level).toBe(0);
  });

  it('choisit le PLUS HAUT palier entierement atteint', () => {
    const p = computePlumePopularity(25_000, 1_000, 500);
    expect(p.level).toBe(3);
    expect(p.name).toBe('Conteur');
  });

  it('plafonne au niveau maximal', () => {
    const p = computePlumePopularity(50_000_000, 2_000_000, 500_000);
    expect(p.level).toBe(7);
    expect(p.name).toBe('Plume Légendaire');
    expect(p.next).toBeNull();
    expect(p.percentToNext).toBe(100);
  });

  it('progression ponderee vers le niveau suivant (40/25/35)', () => {
    // Niveau 0 atteint ; vers le niveau 1 (500/20/10) : lectures a 50 %,
    // mentions a 0 %, abonnes a 100 % -> 0.40*0.5 + 0.25*0 + 0.35*1 = 0.55.
    const p = computePlumePopularity(250, 0, 10);
    expect(p.level).toBe(0);
    expect(p.percentToNext).toBe(55);
  });

  it('la progression plafonne chaque metrique a 100 %', () => {
    // Enormement de lectures mais 0 abonne : reste niveau 0, progression bornee.
    const p = computePlumePopularity(10_000_000, 0, 0);
    expect(p.level).toBe(0);
    // lectures plafonnees a 100 % -> 0.40 ; le reste 0 -> 40 %.
    expect(p.percentToNext).toBe(40);
  });

  it('gere des entrees invalides sans planter', () => {
    const p = computePlumePopularity(NaN, -5, undefined as any);
    expect(p.level).toBe(0);
    expect(p.percentToNext).toBe(0);
  });

  it('les paliers sont strictement croissants sur les trois axes', () => {
    for (let i = 1; i < PLUME_LEVELS.length; i++) {
      expect(PLUME_LEVELS[i].reads).toBeGreaterThan(PLUME_LEVELS[i - 1].reads);
      expect(PLUME_LEVELS[i].mentions).toBeGreaterThan(PLUME_LEVELS[i - 1].mentions);
      expect(PLUME_LEVELS[i].subscribers).toBeGreaterThanOrEqual(PLUME_LEVELS[i - 1].subscribers);
    }
  });
});
