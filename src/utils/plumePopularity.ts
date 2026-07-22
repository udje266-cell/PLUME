/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * POPULARITE PLUME — reservee aux AUTEURS.
 *
 * Un niveau de popularite (0 a 7) calcule a partir de trois metriques reelles :
 *   - 📖 lectures cumulees des œuvres,
 *   - ❤️ mentions (j'aime recus sur les œuvres),
 *   - 👥 abonnes.
 *
 * Un palier est ATTEINT quand les trois seuils du niveau sont satisfaits. La
 * BARRE de progression vers le palier suivant est ponderee selon l'importance de
 * chaque metrique : lectures 40 %, mentions 25 %, abonnes 35 %.
 *
 * Les comptes LECTEURS n'ont pas de popularite Plume (voir l'appelant).
 */

export interface PlumeLevelDef {
  level: number;
  icon: string;
  name: string;
  reads: number;
  mentions: number;
  subscribers: number;
}

// Paliers officiels. L'ordre est croissant sur les trois metriques.
export const PLUME_LEVELS: PlumeLevelDef[] = [
  { level: 0, icon: '🪶', name: 'Nouvelle Page',      reads: 0,         mentions: 0,       subscribers: 0 },
  { level: 1, icon: '📃', name: 'Nouvelle Histoire',  reads: 500,       mentions: 20,      subscribers: 10 },
  { level: 2, icon: '📖', name: 'Auteur en Devenir',  reads: 5_000,     mentions: 200,     subscribers: 100 },
  { level: 3, icon: '✒️', name: 'Conteur',            reads: 25_000,    mentions: 1_000,   subscribers: 500 },
  { level: 4, icon: '🔥', name: 'Belle Signature',    reads: 100_000,   mentions: 5_000,   subscribers: 2_000 },
  { level: 5, icon: '⭐', name: 'Maître Plume',       reads: 500_000,   mentions: 25_000,  subscribers: 10_000 },
  { level: 6, icon: '👑', name: 'Grand Auteur',       reads: 1_000_000, mentions: 50_000,  subscribers: 50_000 },
  { level: 7, icon: '🏆', name: 'Plume Légendaire',   reads: 10_000_000, mentions: 500_000, subscribers: 100_000 },
];

// Ponderation du CALCUL de popularite (barre de progression). Somme = 1.
export const PLUME_WEIGHTS = { reads: 0.40, mentions: 0.25, subscribers: 0.35 } as const;

export interface PlumePopularity {
  level: number;
  icon: string;
  name: string;
  /** Palier suivant (null si niveau maximal atteint). */
  next: PlumeLevelDef | null;
  /** Progression PONDEREE vers le palier suivant (0..100 ; 100 au max). */
  percentToNext: number;
}

/**
 * Calcule le niveau de popularite Plume d'un auteur. Un palier est atteint quand
 * les TROIS seuils sont satisfaits ; la progression affichee vers le suivant est
 * la moyenne ponderee (40/25/35) des trois fractions plafonnees a 100 %.
 */
export function computePlumePopularity(reads: number, mentions: number, subscribers: number): PlumePopularity {
  const r = Math.max(0, Number(reads) || 0);
  const m = Math.max(0, Number(mentions) || 0);
  const s = Math.max(0, Number(subscribers) || 0);

  // Les seuils croissent sur les trois axes : des qu'un palier echoue, tous les
  // suivants echouent aussi -> on s'arrete au premier non atteint.
  let currentIdx = 0;
  for (let i = 0; i < PLUME_LEVELS.length; i++) {
    const L = PLUME_LEVELS[i];
    if (r >= L.reads && m >= L.mentions && s >= L.subscribers) currentIdx = i;
    else break;
  }

  const current = PLUME_LEVELS[currentIdx];
  const next = PLUME_LEVELS[currentIdx + 1] || null;

  let percentToNext = 100;
  if (next) {
    const fr = next.reads ? Math.min(1, r / next.reads) : 1;
    const fm = next.mentions ? Math.min(1, m / next.mentions) : 1;
    const fs = next.subscribers ? Math.min(1, s / next.subscribers) : 1;
    percentToNext = Math.round(
      (PLUME_WEIGHTS.reads * fr + PLUME_WEIGHTS.mentions * fm + PLUME_WEIGHTS.subscribers * fs) * 100,
    );
  }

  return { level: current.level, icon: current.icon, name: current.name, next, percentToNext };
}
