/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Système de niveaux (XP) de PLUME. Deux jauges séparées : Lecteur et Auteur.
 * Partagé entre le serveur (attribution d'XP autoritative) et le client
 * (affichage). Aucune dépendance externe.
 *
 * Courbe : XP cumulé pour ATTEINDRE le niveau L = floor(100 × (L-1)^1.5).
 *   Niveau 1 = 0 XP · Niv.2 = 100 · Niv.3 = 283 · Niv.6 = 1118 · Niv.11 = 3162.
 */

const BASE = 100;
const EXP = 1.5;

/** XP cumulé nécessaire pour atteindre un niveau donné (niveau 1 = 0 XP). */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(BASE * Math.pow(level - 1, EXP));
}

/** Niveau correspondant à un total d'XP (commence à 1). */
export function levelFromXp(xp: number): number {
  const x = Math.max(0, Number(xp) || 0);
  return Math.floor(Math.pow(x / BASE, 1 / EXP)) + 1;
}

export interface LevelProgress {
  level: number;
  xp: number;
  /** XP au seuil du niveau courant. */
  currentLevelXp: number;
  /** XP au seuil du niveau suivant. */
  nextLevelXp: number;
  /** XP gagné dans le niveau courant. */
  inLevel: number;
  /** XP total requis pour passer ce niveau. */
  levelSpan: number;
  /** Progression 0–100 (%). */
  percent: number;
  title: string;
}

/** Détail de progression pour l'affichage d'une jauge. */
export function levelProgress(xp: number): LevelProgress {
  const safeXp = Math.max(0, Math.floor(Number(xp) || 0));
  const level = levelFromXp(safeXp);
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const levelSpan = Math.max(1, nextLevelXp - currentLevelXp);
  const inLevel = safeXp - currentLevelXp;
  const percent = Math.min(100, Math.round((inLevel / levelSpan) * 100));
  return { level, xp: safeXp, currentLevelXp, nextLevelXp, inLevel, levelSpan, percent, title: titleForLevel(level) };
}

/** Titre thématique selon le niveau. */
export function titleForLevel(level: number): string {
  if (level >= 50) return "Légende de l'Archipel";
  if (level >= 35) return 'Maître Plume';
  if (level >= 20) return 'Conteur·se';
  if (level >= 10) return 'Plume Confirmée';
  if (level >= 5) return 'Plume Novice';
  return 'Apprenti·e';
}
