/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  recommendStories,
  isEligible,
  bayesianRating,
  hotScore,
  coldStartBoost,
  DEFAULT_WEIGHTS,
  weightsForDiscovery,
  explorationRatioForDiscovery,
} from './recommendation';
import { Story, User } from '../types';

const NOW = new Date('2026-06-10T12:00:00.000Z').getTime();

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'reader',
    username: 'Reader',
    email: 'r@example.com',
    role: 'Lecteur',
    avatar: '',
    bio: '',
    followers: [],
    following: [],
    isVerified: false,
    signUpDate: '2025-01-01',
    favoriteGenres: [],
    birthDate: '1990-01-01',
    readingHistory: [],
    blockedUsers: [],
    ...overrides,
  } as User;
}

function makeStory(overrides: Partial<Story> = {}): Story {
  return {
    id: 'story',
    title: 'Titre',
    description: 'desc',
    authorId: 'author_1',
    authorName: 'Author',
    authorAvatar: '',
    authorVerified: false,
    cover: '',
    genre: 'Science-Fiction',
    category: '',
    ambiance: '',
    format: '',
    language: 'fr',
    chapters: [],
    likes: 0,
    likedBy: [],
    favoritesCount: 0,
    favoritedBy: [],
    tags: [],
    status: 'Publié',
    publishDate: new Date(NOW - 3 * 86_400_000).toISOString(),
    views: 0,
    viewedBy: [],
    reads: 0,
    rating: 0,
    isFlagged: false,
    ...overrides,
  } as Story;
}

describe('isEligible', () => {
  it('exclut les brouillons, signalements, ses propres récits et auteurs bloqués', () => {
    const user = makeUser({ id: 'me', blockedUsers: ['bad'] });
    expect(isEligible(user, makeStory({ status: 'Brouillon' }), NOW)).toBe(false);
    expect(isEligible(user, makeStory({ isFlagged: true }), NOW)).toBe(false);
    expect(isEligible(user, makeStory({ authorId: 'me' }), NOW)).toBe(false);
    expect(isEligible(user, makeStory({ authorId: 'bad' }), NOW)).toBe(false);
    expect(isEligible(user, makeStory(), NOW)).toBe(true);
  });

  it('respecte la classification d\'âge', () => {
    const minor = makeUser({ birthDate: '2014-01-01' }); // ~12 ans en 2026
    expect(isEligible(minor, makeStory({ ageRating: '18' }), NOW)).toBe(false);
    expect(isEligible(minor, makeStory({ ageRating: 'all' }), NOW)).toBe(true);
    const adult = makeUser({ birthDate: '1990-01-01' });
    expect(isEligible(adult, makeStory({ ageRating: '18' }), NOW)).toBe(true);
  });
});

describe('bayesianRating', () => {
  it('lisse vers la moyenne globale quand le récit est peu lu', () => {
    const global = 3;
    const fewReads = bayesianRating(makeStory({ rating: 5, reads: 1 }), global, 30);
    const manyReads = bayesianRating(makeStory({ rating: 5, reads: 1000 }), global, 30);
    // 5★ confirmées par 1000 lectures pèsent bien plus que 5★ sur 1 lecture.
    expect(manyReads).toBeGreaterThan(fewReads);
    // La note peu lue est tirée vers la moyenne globale (3/5 = 0.6).
    expect(fewReads).toBeLessThan(0.8);
    expect(fewReads).toBeGreaterThan(0.6);
  });
});

describe('hotScore', () => {
  it('décline avec l\'âge à engagement égal', () => {
    const fresh = hotScore(makeStory({ likes: 100, publishDate: new Date(NOW - 2 * 3_600_000).toISOString() }), NOW, 1.5);
    const old = hotScore(makeStory({ likes: 100, publishDate: new Date(NOW - 500 * 3_600_000).toISOString() }), NOW, 1.5);
    expect(fresh).toBeGreaterThan(old);
  });
});

describe('coldStartBoost', () => {
  it('vaut ~1 pour un récit neuf et tend vers 0 quand les lectures montent', () => {
    expect(coldStartBoost(makeStory({ reads: 0 }), 50)).toBeCloseTo(1, 5);
    expect(coldStartBoost(makeStory({ reads: 5000 }), 50)).toBeLessThan(0.001);
  });
});

describe('recommendStories', () => {
  const det = { now: NOW, explorationRatio: 0, random: () => 0 };

  it('ne renvoie que des récits éligibles', () => {
    const user = makeUser({ id: 'me' });
    const stories = [
      makeStory({ id: 'ok' }),
      makeStory({ id: 'mine', authorId: 'me' }),
      makeStory({ id: 'draft', status: 'Brouillon' }),
      makeStory({ id: 'flagged', isFlagged: true }),
    ];
    const result = recommendStories(stories, user, det);
    const ids = result.map((r) => r.story.id);
    expect(ids).toContain('ok');
    expect(ids).not.toContain('mine');
    expect(ids).not.toContain('draft');
    expect(ids).not.toContain('flagged');
  });

  it('classe plus haut un récit dans les genres favoris du lecteur', () => {
    const user = makeUser({ favoriteGenres: ['Fantasy'] });
    const stories = [
      makeStory({ id: 'sf', genre: 'Science-Fiction', reads: 10 }),
      makeStory({ id: 'fantasy', genre: 'Fantasy', reads: 10 }),
    ];
    const result = recommendStories(stories, user, det);
    expect(result[0].story.id).toBe('fantasy');
    expect(result[0].reasons).toContain('Dans tes genres favoris');
  });

  it('met en avant un récit écrit par un auteur suivi', () => {
    const user = makeUser({ following: ['followed_author'] });
    const stories = [
      makeStory({ id: 'random', authorId: 'someone' }),
      makeStory({ id: 'followed', authorId: 'followed_author' }),
    ];
    const result = recommendStories(stories, user, det);
    expect(result[0].story.id).toBe('followed');
    expect(result[0].reasons).toContain('Par un auteur que tu suis');
  });

  it('donne sa chance à une nouveauté sous-exposée face à un vieux hit', () => {
    const user = makeUser();
    const oldHit = makeStory({
      id: 'oldhit',
      authorId: 'a1',
      reads: 100000,
      likes: 5000,
      publishDate: new Date(NOW - 720 * 86_400_000).toISOString(),
    });
    const fresh = makeStory({
      id: 'fresh',
      authorId: 'a2',
      reads: 3,
      likes: 2,
      publishDate: new Date(NOW - 6 * 3_600_000).toISOString(),
    });
    const result = recommendStories([oldHit, fresh], user, det);
    const freshScored = result.find((r) => r.story.id === 'fresh')!;
    // La nouveauté est diffusée et signalée comme découverte.
    expect(freshScored).toBeTruthy();
    expect(freshScored.reasons.some((r) => r === 'Pépite à découvrir' || r === 'Tendance en ce moment')).toBe(true);
  });

  it('exclut explicitement les récits listés dans excludeStoryIds', () => {
    const user = makeUser();
    const stories = [makeStory({ id: 'a', authorId: 'a1' }), makeStory({ id: 'b', authorId: 'a2' })];
    const result = recommendStories(stories, user, { ...det, excludeStoryIds: ['a'] });
    expect(result.map((r) => r.story.id)).toEqual(['b']);
  });

  it('évite plus de 2 récits consécutifs du même auteur quand une alternative existe', () => {
    const user = makeUser();
    // 3 récits de A (mieux notés) + 3 de B : l'interleaving est possible.
    // Notes/reads élevés et égaux pour neutraliser cold-start, A passe devant B
    // uniquement via la popularité (reads).
    const stories = [
      makeStory({ id: 'a1', authorId: 'A', reads: 1003, rating: 4 }),
      makeStory({ id: 'a2', authorId: 'A', reads: 1002, rating: 4 }),
      makeStory({ id: 'a3', authorId: 'A', reads: 1001, rating: 4 }),
      makeStory({ id: 'b1', authorId: 'B', reads: 1000, rating: 4 }),
      makeStory({ id: 'b2', authorId: 'B', reads: 999, rating: 4 }),
      makeStory({ id: 'b3', authorId: 'B', reads: 998, rating: 4 }),
    ];
    const result = recommendStories(stories, user, det);
    expect(result).toHaveLength(6);
    const authors = result.map((r) => r.story.authorId);
    for (let i = 2; i < authors.length; i++) {
      const threeSame = authors[i] === authors[i - 1] && authors[i] === authors[i - 2];
      expect(threeSame).toBe(false);
    }
  });

  it('respecte la limite demandée', () => {
    const user = makeUser();
    const stories = Array.from({ length: 10 }, (_, i) =>
      makeStory({ id: `s${i}`, authorId: `author_${i}`, reads: i }),
    );
    const result = recommendStories(stories, user, { ...det, limit: 3 });
    expect(result).toHaveLength(3);
  });

  it('utilise les pondérations par défaut quand aucune n\'est fournie', () => {
    expect(DEFAULT_WEIGHTS.affinity).toBeGreaterThan(0);
    const user = makeUser();
    const result = recommendStories([makeStory({ id: 'x', authorId: 'a1' })], user, { now: NOW });
    expect(result).toHaveLength(1);
  });

  it('filtrage collaboratif : favorise un récit dont le public recoupe celui de tes lectures aimées', () => {
    const user = makeUser({ id: 'me' });
    // L'utilisateur a aimé "liked" (public : alice, bob, carol).
    const liked = makeStory({
      id: 'liked', authorId: 'a0', reads: 50, rating: 4,
      likedBy: ['me', 'alice', 'bob', 'carol'],
    });
    // "near" partage le public d'aimeurs (alice, bob, carol) → fort signal collaboratif.
    const near = makeStory({
      id: 'near', authorId: 'a1', reads: 50, rating: 4,
      likedBy: ['alice', 'bob', 'carol'],
    });
    // "far" a un public disjoint → aucun signal collaboratif.
    const far = makeStory({
      id: 'far', authorId: 'a2', reads: 50, rating: 4,
      likedBy: ['zoe', 'yann', 'xavier'],
    });
    const result = recommendStories([liked, near, far], user, det);
    const nearPos = result.findIndex((r) => r.story.id === 'near');
    const farPos = result.findIndex((r) => r.story.id === 'far');
    expect(nearPos).toBeLessThan(farPos);
    expect(result[nearPos].reasons).toContain('Aimé par des lecteurs comme toi');
  });
});

describe('weightsForDiscovery', () => {
  it('penche vers la pertinence a 0 et la decouverte a 1', () => {
    const relevance = weightsForDiscovery(0);
    const discovery = weightsForDiscovery(1);
    // En mode pertinence, l'affinite domine le cold-start ; l'inverse en decouverte.
    expect(relevance.affinity).toBeGreaterThan(relevance.coldStart);
    expect(discovery.coldStart).toBeGreaterThan(discovery.affinity);
  });

  it('clamp les valeurs hors bornes', () => {
    expect(weightsForDiscovery(-5)).toEqual(weightsForDiscovery(0));
    expect(weightsForDiscovery(9)).toEqual(weightsForDiscovery(1));
  });

  it('explorationRatioForDiscovery croit avec la decouverte', () => {
    expect(explorationRatioForDiscovery(0)).toBeCloseTo(0.05, 5);
    expect(explorationRatioForDiscovery(1)).toBeCloseTo(0.3, 5);
    expect(explorationRatioForDiscovery(0.5)).toBeGreaterThan(explorationRatioForDiscovery(0));
  });
});
