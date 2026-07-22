/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Predicats PURS (sans base de donnees) utilises pour evaluer les trophees
 * LEGENDAIRES et SECRETS de PLUME. Module SERVEUR uniquement : il n'est importe
 * que par `src/server/legendary.ts` (jamais par du code client), donc il ne se
 * retrouve PAS dans le bundle web/natif. Aucune condition chiffree ne doit fuir
 * cote client — c'est ici (serveur) qu'elle vit.
 *
 * Ces fonctions sont isolees du reste (pas d'acces Prisma) precisement pour etre
 * testables de façon deterministe (voir legendaryLogic.test.ts) : on leur passe
 * les donnees deja extraites + un `now` explicite.
 */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

/** Nombre d'annees ecoulees entre deux instants (ms). */
export function yearsBetween(fromMs: number, toMs: number): number {
  return (toMs - fromMs) / YEAR_MS;
}

/**
 * Vrai s'il existe une œuvre TERMINEE par le lecteur dont la publication a
 * commence il y a au moins `minYears` ans. `startTimestamps` = dates de debut de
 * publication (ms) des œuvres terminees par le lecteur.
 */
export function hasCompletedOldWork(startTimestamps: number[], nowMs: number, minYears: number): boolean {
  return startTimestamps.some((t) => yearsBetween(t, nowMs) >= minYears);
}

/**
 * Vrai si l'ensemble des genres couverts contient TOUS les genres disponibles.
 * La comparaison est insensible a la casse et aux espaces superflus.
 */
export function coversAllGenres(coveredGenres: Iterable<string>, allGenres: string[]): boolean {
  const norm = (g: string) => g.trim().toLowerCase();
  const set = new Set<string>();
  for (const g of coveredGenres) if (g) set.add(norm(g));
  return allGenres.length > 0 && allGenres.every((g) => set.has(norm(g)));
}

/** Index de semaine ISO-approche : bucket de 7 jours depuis l'epoch. */
function weekBucket(ms: number): number {
  return Math.floor(ms / WEEK_MS);
}

/**
 * Vrai s'il existe une serie de `years` annees pendant laquelle CHAQUE semaine
 * contient au moins un evenement (ex. publication d'un chapitre), SANS aucune
 * interruption. Sert a « publier au moins un chapitre chaque semaine pendant N
 * annees consecutives sans interruption ».
 *
 * Methode : on projette les evenements sur des « seaux » hebdomadaires puis on
 * cherche la plus longue suite de seaux STRICTEMENT consecutifs (chacun a +1 du
 * precedent = aucune semaine manquante). Une serie passee achevee compte aussi
 * (on ne fixe pas la fin a « maintenant »). Le nombre de semaines requis est
 * arrondi au superieur pour exiger une couverture pleine des N annees.
 */
export function hasWeeklyStreak(eventTimestamps: number[], years: number): boolean {
  if (eventTimestamps.length === 0) return false;
  const requiredWeeks = Math.ceil((years * YEAR_MS) / WEEK_MS);
  if (requiredWeeks <= 0) return false;

  const buckets = Array.from(new Set(eventTimestamps.map(weekBucket))).sort((a, b) => a - b);
  let best = 1;
  let run = 1;
  for (let i = 1; i < buckets.length; i++) {
    run = buckets[i] === buckets[i - 1] + 1 ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best >= requiredWeeks;
}

/**
 * Vrai si au moins une œuvre est « sans faute » : publiee et dont AUCUN chapitre
 * publie n'a ete modifie apres sa publication initiale. `works` decrit chaque
 * œuvre par le nombre de chapitres publies et le plus grand ecart (ms) constate
 * entre publication et derniere modification d'un de ses chapitres.
 * `toleranceMs` absorbe les micro-ecarts techniques (horodatage createdAt vs
 * updatedAt a l'insertion).
 */
export function hasFlawlessWork(
  works: { publishedChapters: number; maxEditGapMs: number; complete: boolean }[],
  minChapters: number,
  toleranceMs: number,
): boolean {
  return works.some(
    (w) => w.complete && w.publishedChapters >= minChapters && w.maxEditGapMs <= toleranceMs,
  );
}

/**
 * Vrai si l'auteur a bati un « univers vivant » : plusieurs œuvres reliees par un
 * fil commun (au moins `minWorks` œuvres partageant un meme marqueur d'univers,
 * ex. un tag partage). `groupsBySharedMarker` = pour chaque marqueur, le nombre
 * d'œuvres qui le portent.
 */
export function hasLivingUniverse(worksPerMarker: number[], minWorks: number): boolean {
  return worksPerMarker.some((n) => n >= minWorks);
}
