/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Algorithme de diffusion / recommandation des récits PLUME.
 *
 * But : classer, pour un lecteur donné, les récits à pousser sur sa page
 * (sections « Pour toi », « Tendances », « Découvertes »…), en équilibrant
 * pertinence personnelle et découverte (nouveaux livres / nouveaux auteurs),
 * afin que chaque livre ait une vraie chance d'être diffusé.
 *
 * Le score d'un couple (lecteur, livre) combine 6 briques, chacune normalisée
 * sur l'ensemble des candidats puis pondérée :
 *   - affinité    : genres/tags/ambiance ∩ goûts (favoris + historique de lecture)
 *   - social      : auteur suivi + appréciation dans le réseau du lecteur
 *   - qualité     : note lissée (bayésienne, via les lectures) + ratio de likes
 *   - popularité  : (reads + likes + favoris) AVEC déclin temporel
 *   - fraîcheur   : récence de publication
 *   - coup de pouce: boost dégressif des nouveautés sous-exposées (cold-start)
 *
 * Pure / sans effet de bord → entièrement testable. Aucune dépendance réseau.
 */

import { Story, User } from '../types';
import { calculateAge, isUserAgeAllowed } from './age';

export interface RecommendationWeights {
  affinity: number;
  social: number;
  quality: number;
  popularity: number;
  freshness: number;
  coldStart: number;
}

/** Profil « équilibré » : pertinent, mais avec une vraie place pour la découverte. */
export const DEFAULT_WEIGHTS: RecommendationWeights = {
  affinity: 3,
  social: 2.5,
  quality: 2,
  popularity: 2,
  freshness: 1.5,
  coldStart: 2,
};

export interface RecommendationOptions {
  weights?: RecommendationWeights;
  /** Horodatage de référence (ms). Injectable pour les tests. Défaut: Date.now(). */
  now?: number;
  /** Part d'emplacements réservés à l'exploration (0..1). Défaut: 0.15. */
  explorationRatio?: number;
  /** Déclin temporel de la popularité (style HN). Défaut: 1.5. */
  gravity?: number;
  /** Lissage de la note (nb de lectures « fictives » à la moyenne globale). Défaut: 30. */
  ratingSmoothing?: number;
  /** Échelle du cold-start : nb de lectures où le boost retombe à ~37%. Défaut: 50. */
  coldStartScale?: number;
  /** Récits à exclure totalement (ex. déjà lus en entier). */
  excludeStoryIds?: string[];
  /** Générateur aléatoire injectable (tests déterministes). Défaut: Math.random. */
  random?: () => number;
  /** Limite du nombre de résultats renvoyés. Défaut: tous les éligibles. */
  limit?: number;
}

export interface ScoredStory {
  story: Story;
  score: number;
  reasons: string[];
  isExploration: boolean;
}

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/**
 * Un récit est-il éligible à être diffusé au lecteur ?
 * Exclut : brouillons, contenus signalés, ses propres récits, auteurs bloqués,
 * et les contenus dont la classification d'âge dépasse l'âge du lecteur.
 */
export function isEligible(user: User, story: Story, now: number = Date.now()): boolean {
  if (story.status !== 'Publié') return false;
  if (story.isFlagged) return false;
  if (story.authorId === user.id) return false;
  if (user.blockedUsers && user.blockedUsers.includes(story.authorId)) return false;
  const age = calculateAge(user.birthDate);
  if (!isUserAgeAllowed(age, story.ageRating)) return false;
  // Un récit publié dans le futur (date incohérente) n'est pas diffusé.
  if (new Date(story.publishDate).getTime() > now + DAY_MS) return false;
  return true;
}

/**
 * Note « lissée » facon bayésienne : une note isolée sur un récit peu lu pèse
 * moins qu'une note confirmée par de nombreuses lectures. On utilise `reads`
 * comme proxy de confiance (faute de compteur de votes).
 * Renvoie une valeur normalisée 0..1.
 */
export function bayesianRating(story: Story, globalMean: number, smoothing: number): number {
  const reads = Math.max(0, story.reads || 0);
  const r = Math.max(0, Math.min(5, story.rating || 0));
  const adjusted = (reads * r + smoothing * globalMean) / (reads + smoothing || 1);
  return adjusted / 5;
}

/**
 * Popularité « chaude » avec déclin temporel (style Hacker News / Reddit) :
 * un récit récent et engageant remonte, un vieux hit finit par redescendre,
 * ce qui fait tourner le contenu diffusé. Valeur brute (non bornée).
 */
export function hotScore(story: Story, now: number, gravity: number): number {
  const engagement = (story.reads || 0) + 3 * (story.likes || 0) + 5 * (story.favoritesCount || 0);
  const ageHours = Math.max(0, (now - new Date(story.publishDate).getTime()) / HOUR_MS);
  return engagement / Math.pow(ageHours + 2, gravity);
}

/**
 * Boost dégressif des nouveautés sous-exposées : ~1 pour un récit jamais lu,
 * tend vers 0 à mesure que les lectures s'accumulent. Donne leur chance aux
 * nouveaux livres/auteurs. Valeur 0..1.
 */
export function coldStartBoost(story: Story, scale: number): number {
  return Math.exp(-Math.max(0, story.reads || 0) / Math.max(1, scale));
}

/** Profil de goût dérivé des favoris déclarés + des tags des récits déjà lus. */
interface TasteProfile {
  genres: Set<string>;
  tagWeights: Map<string, number>;
}

function normalizeLabel(value: string): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

function buildTasteProfile(user: User, storiesById: Map<string, Story>): TasteProfile {
  const genres = new Set<string>((user.favoriteGenres || []).map(normalizeLabel).filter(Boolean));
  const tagWeights = new Map<string, number>();
  // Les récits déjà lus révèlent les goûts réels : on agrège leurs tags/genres.
  for (const storyId of user.readingHistory || []) {
    const s = storiesById.get(storyId);
    if (!s) continue;
    genres.add(normalizeLabel(s.genre));
    for (const tag of s.tags || []) {
      const key = normalizeLabel(tag);
      if (!key) continue;
      tagWeights.set(key, (tagWeights.get(key) || 0) + 1);
    }
  }
  return { genres, tagWeights };
}

/** Affinité de goût (brute) : match de genre + recoupement de tags + ambiance. */
function affinityRaw(story: Story, taste: TasteProfile): number {
  let score = 0;
  const genre = normalizeLabel(story.genre);
  if (taste.genres.has(genre)) score += 2;
  else if ([...taste.genres].some((g) => g && (genre.includes(g) || g.includes(genre)))) score += 1;
  for (const tag of story.tags || []) {
    const w = taste.tagWeights.get(normalizeLabel(tag));
    if (w) score += Math.min(2, w); // un tag très présent dans l'historique compte plus
  }
  return score;
}

/** Signal social (brut) : auteur suivi + appréciation au sein du réseau suivi. */
function socialRaw(user: User, story: Story): { value: number; followsAuthor: boolean } {
  const following = new Set(user.following || []);
  const followsAuthor = following.has(story.authorId);
  let value = followsAuthor ? 4 : 0;
  // Preuve sociale : combien de gens que TU suis ont aimé/mis en favori ce récit.
  const advocates = new Set<string>([...(story.likedBy || []), ...(story.favoritedBy || [])]);
  let networkHits = 0;
  for (const id of advocates) if (following.has(id)) networkHits++;
  value += Math.min(4, networkHits);
  return { value, followsAuthor };
}

interface RawComponents {
  story: Story;
  affinity: number;
  social: number;
  quality: number;
  popularity: number;
  freshness: number;
  coldStart: number;
  followsAuthor: boolean;
  networkProof: boolean;
}

function normalize(value: number, max: number): number {
  return max > 0 ? value / max : 0;
}

/**
 * Classe les récits à diffuser pour un lecteur.
 * Renvoie une liste triée (meilleur score d'abord) d'éléments scorés, avec une
 * dose d'exploration interleavée pour garantir la découverte de nouveautés.
 */
export function recommendStories(
  stories: Story[],
  user: User,
  options: RecommendationOptions = {},
): ScoredStory[] {
  const weights = options.weights || DEFAULT_WEIGHTS;
  const now = options.now ?? Date.now();
  const gravity = options.gravity ?? 1.5;
  const smoothing = options.ratingSmoothing ?? 30;
  const coldStartScale = options.coldStartScale ?? 50;
  const explorationRatio = options.explorationRatio ?? 0.15;
  const random = options.random ?? Math.random;
  const excluded = new Set(options.excludeStoryIds || []);

  const eligible = stories.filter((s) => !excluded.has(s.id) && isEligible(user, s, now));
  if (eligible.length === 0) return [];

  const storiesById = new Map(stories.map((s) => [s.id, s]));
  const taste = buildTasteProfile(user, storiesById);

  // Moyenne globale des notes (pondérée présence) pour le lissage bayésien.
  const rated = eligible.filter((s) => (s.reads || 0) > 0 && (s.rating || 0) > 0);
  const globalMean = rated.length > 0
    ? rated.reduce((sum, s) => sum + (s.rating || 0), 0) / rated.length
    : 3.5;

  // 1) Composantes brutes.
  const raw: RawComponents[] = eligible.map((story) => {
    const social = socialRaw(user, story);
    const daysSince = Math.max(0, (now - new Date(story.publishDate).getTime()) / DAY_MS);
    return {
      story,
      affinity: affinityRaw(story, taste),
      social: social.value,
      quality: bayesianRating(story, globalMean, smoothing),
      popularity: hotScore(story, now, gravity),
      freshness: 1 / (daysSince + 1),
      coldStart: coldStartBoost(story, coldStartScale),
      followsAuthor: social.followsAuthor,
      networkProof: social.value - (social.followsAuthor ? 4 : 0) > 0,
    };
  });

  // 2) Maxima pour normaliser chaque composante sur 0..1.
  const max = {
    affinity: Math.max(...raw.map((r) => r.affinity), 0),
    social: Math.max(...raw.map((r) => r.social), 0),
    quality: Math.max(...raw.map((r) => r.quality), 0),
    popularity: Math.max(...raw.map((r) => r.popularity), 0),
    freshness: Math.max(...raw.map((r) => r.freshness), 0),
    coldStart: Math.max(...raw.map((r) => r.coldStart), 0),
  };

  // 3) Score pondéré + explications.
  const scored: ScoredStory[] = raw.map((r) => {
    const nAffinity = normalize(r.affinity, max.affinity);
    const nSocial = normalize(r.social, max.social);
    const nQuality = normalize(r.quality, max.quality);
    const nPopularity = normalize(r.popularity, max.popularity);
    const nFreshness = normalize(r.freshness, max.freshness);
    const nColdStart = normalize(r.coldStart, max.coldStart);

    const score =
      weights.affinity * nAffinity +
      weights.social * nSocial +
      weights.quality * nQuality +
      weights.popularity * nPopularity +
      weights.freshness * nFreshness +
      weights.coldStart * nColdStart;

    const reasons: string[] = [];
    if (r.followsAuthor) reasons.push('Par un auteur que tu suis');
    if (r.networkProof) reasons.push('Apprécié dans ton réseau');
    if (nAffinity >= 0.5) reasons.push('Dans tes genres favoris');
    if (nPopularity >= 0.6) reasons.push('Tendance en ce moment');
    if (nColdStart >= 0.8 && (r.story.reads || 0) < coldStartScale) reasons.push('Pépite à découvrir');

    return { story: r.story, score, reasons, isExploration: false };
  });

  // 4) Tri par score décroissant, puis diversité (pas plus de 2 récits d'affilée
  //    du même auteur) et injection d'exploration (nouveautés sous-exposées).
  scored.sort((a, b) => b.score - a.score);
  const diversified = enforceAuthorDiversity(scored);
  const withExploration = injectExploration(diversified, explorationRatio, random);

  return typeof options.limit === 'number'
    ? withExploration.slice(0, options.limit)
    : withExploration;
}

/**
 * Évite qu'un même auteur occupe plus de 2 positions consécutives : on ne
 * dévie de l'ordre par score que si les deux derniers récits placés sont du
 * même auteur ET qu'une alternative existe plus bas dans la file.
 */
function enforceAuthorDiversity(scored: ScoredStory[]): ScoredStory[] {
  const result: ScoredStory[] = [];
  const queue = [...scored];

  while (queue.length > 0) {
    let pickedIndex = 0;
    const n = result.length;
    const twoSameTrailing = n >= 2 &&
      result[n - 1].story.authorId === result[n - 2].story.authorId;
    if (twoSameTrailing) {
      const blockedAuthor = result[n - 1].story.authorId;
      const alt = queue.findIndex((s) => s.story.authorId !== blockedAuthor);
      if (alt !== -1) pickedIndex = alt;
    }
    const [picked] = queue.splice(pickedIndex, 1);
    result.push(picked);
  }
  return result;
}

/**
 * Réserve une fraction d'emplacements à des « découvertes » : on remonte des
 * récits récents et peu exposés depuis le bas du classement vers des positions
 * visibles, marqués `isExploration`. Garantit que tout livre peut être diffusé.
 */
function injectExploration(
  ranked: ScoredStory[],
  ratio: number,
  random: () => number,
): ScoredStory[] {
  if (ratio <= 0 || ranked.length < 4) return ranked;

  const slots = Math.floor(ranked.length * ratio);
  if (slots <= 0) return ranked;

  // Candidats à l'exploration : moitié basse du classement, triés par cold-start
  // (nouveautés sous-exposées en tête).
  const cut = Math.ceil(ranked.length / 2);
  const head = ranked.slice(0, cut);
  const tail = ranked.slice(cut);
  if (tail.length === 0) return ranked;

  const picks: ScoredStory[] = [];
  const remaining = [...tail];
  for (let i = 0; i < slots && remaining.length > 0; i++) {
    const idx = Math.floor(random() * remaining.length);
    const [pick] = remaining.splice(idx, 1);
    picks.push({ ...pick, isExploration: true, reasons: ['Découverte'] });
  }

  // On insère les découvertes à intervalles réguliers dans la tête de liste.
  const result = [...head];
  const step = Math.max(1, Math.floor(result.length / (picks.length + 1)));
  picks.forEach((pick, i) => {
    const pos = Math.min(result.length, (i + 1) * step + i);
    result.splice(pos, 0, pick);
  });
  return [...result, ...remaining];
}
