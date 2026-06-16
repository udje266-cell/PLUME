import { describe, it, expect, beforeEach } from 'vitest';
import {
  getUserStats,
  saveUserStats,
  generateReaderAchievements,
  generateAuthorAchievements,
  countAndEvaluateCertification,
  INITIAL_STATS,
  type UserStats
} from './achievements';

// Global localStorage mock setup
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true
});

describe('achievements and certifications utility', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getUserStats', () => {
    it('should return initial stats fallback for a generic user', () => {
      const stats = getUserStats('user_generic');
      expect(stats).toEqual(INITIAL_STATS);
    });

    it('should NOT fabricate preset stats from role alone (real users)', () => {
      // Un vrai utilisateur (id non démo) avec un rôle ne doit pas hériter des
      // statistiques fictives : on retombe sur les stats initiales neutres.
      const stats = getUserStats('real_user_42', 'Lecteur', 'jean_dupont');
      expect(stats).toEqual(INITIAL_STATS);
      expect(stats.chaptersRead).not.toBe(105);
    });

    it('should no longer fabricate stats for the removed demo accounts', () => {
      // Les comptes de démonstration (user_reader/user_author/user_mixed) ont été
      // retirés : ces identifiants ne doivent plus produire de stats fictives.
      for (const id of ['user_reader', 'user_author', 'user_mixed']) {
        expect(getUserStats(id)).toEqual(INITIAL_STATS);
      }
    });

    it('should return stored stats from localStorage if they exist', () => {
      const customStats: UserStats = {
        chaptersRead: 50,
        commentsPosted: 10,
        likesGiven: 20,
        favoritesAdded: 5,
        activeDays: 15,
        completedReadCycles: 3,
        wordsWritten: 5000,
        storiesCreated: 2,
        chaptersPublished: 4,
        viewsReceived: 100,
        likesReceived: 10,
        decorChanges: 2,
        genresReadCount: 3,
        authorsFollowedCount: 4
      };
      saveUserStats('user_test', customStats);

      const retrievedStats = getUserStats('user_test');
      expect(retrievedStats).toEqual(customStats);
    });
  });

  describe('generateReaderAchievements', () => {
    it('should generate exactly 125 achievements', () => {
      const list = generateReaderAchievements(INITIAL_STATS, 'user_reader_test');
      expect(list.length).toBe(125);
      list.forEach((ach) => {
        expect(ach.category).toBe('reader');
        expect(ach.id).toContain('reader_');
      });
    });

    it('should correctly unlock achievements when requirements are met', () => {
      const highStats: UserStats = {
        ...INITIAL_STATS,
        chaptersRead: 25, // Unlocks Lieur Passionné levels 1 to 25
        commentsPosted: 5, // Unlocks Critique de Salon levels 1 to 5
      };

      const list = generateReaderAchievements(highStats, 'user_reader_unlocked');
      
      // reader_1 should be unlocked because chaptersRead (25) >= 1
      const ach1 = list.find(a => a.id === 'reader_1');
      expect(ach1?.isUnlocked).toBe(true);
      expect(ach1?.unlockedDate).toBeDefined();

      // reader_25 should be unlocked because chaptersRead (25) >= 25
      const ach25 = list.find(a => a.id === 'reader_25');
      expect(ach25?.isUnlocked).toBe(true);

      // reader_26 should be Critique de Salon Niv.1 (needs commentsPosted >= 1)
      const ach26 = list.find(a => a.id === 'reader_26');
      expect(ach26?.isUnlocked).toBe(true);
    });

    it('should keep achievements locked when requirements are not met', () => {
      const lowStats: UserStats = {
        chaptersRead: 0,
        commentsPosted: 0,
        likesGiven: 0,
        favoritesAdded: 0,
        activeDays: 0,
        completedReadCycles: 0,
        wordsWritten: 0,
        storiesCreated: 0,
        chaptersPublished: 0,
        viewsReceived: 0,
        likesReceived: 0,
        decorChanges: 0
      };

      const list = generateReaderAchievements(lowStats, 'user_reader_locked');
      const ach1 = list.find(a => a.id === 'reader_1');
      expect(ach1?.isUnlocked).toBe(false);
      expect(ach1?.unlockedDate).toBeUndefined();
    });
  });

  describe('generateAuthorAchievements', () => {
    it('should generate exactly 100 achievements', () => {
      const list = generateAuthorAchievements(INITIAL_STATS, 'user_author_test');
      expect(list.length).toBe(100);
      list.forEach((ach) => {
        expect(ach.category).toBe('author');
        expect(ach.id).toContain('author_');
      });
    });

    it('should correctly unlock author achievements when requirements are met', () => {
      const authorStats: UserStats = {
        ...INITIAL_STATS,
        chaptersPublished: 1, // author_1: Première Plume
        storiesCreated: 1, // author_2: Naissance d'un Monde
        wordsWritten: 1000 // author_8: Plume Active (needs 1000)
      };

      const list = generateAuthorAchievements(authorStats, 'user_author_unlocked');

      const ach1 = list.find(a => a.id === 'author_1');
      expect(ach1?.isUnlocked).toBe(true);
      expect(ach1?.title).toBe('Première Plume');

      const ach2 = list.find(a => a.id === 'author_2');
      expect(ach2?.isUnlocked).toBe(true);
      expect(ach2?.title).toBe("Naissance d'un Monde");

      const ach8 = list.find(a => a.id === 'author_8');
      expect(ach8?.isUnlocked).toBe(true);
      expect(ach8?.title).toBe('Plume Active');
    });
  });

  describe('countAndEvaluateCertification', () => {
    it('should not certify a reader under 80%', () => {
      const stats: UserStats = {
        ...INITIAL_STATS,
        chaptersRead: 5 // Unlocks only a few achievements (5/125 is 4%)
      };
      const result = countAndEvaluateCertification('Lecteur', stats, 'user_cert_1');
      expect(result.shouldCertify).toBe(false);
      expect(result.readerPercent).toBeLessThan(80);
    });

    it('never certifies a reader, even with maxed-out reader achievements', () => {
      const stats: UserStats = {
        chaptersRead: 100000,
        commentsPosted: 100000,
        likesGiven: 100000,
        favoritesAdded: 100000,
        activeDays: 100000,
        completedReadCycles: 100000,
        wordsWritten: 0,
        storiesCreated: 0,
        chaptersPublished: 0,
        viewsReceived: 0,
        likesReceived: 0,
        decorChanges: 100000,
        genresReadCount: 100000,
        authorsFollowedCount: 100000,
      };

      const result = countAndEvaluateCertification('Lecteur', stats, 'user_cert_2');
      expect(result.readerPercent).toBeGreaterThanOrEqual(80);
      // Les lecteurs conservent leurs accomplissements mais ne sont jamais certifiés.
      expect(result.shouldCertify).toBe(false);
    });

    it('certifies an author with >= 80% author achievements', () => {
      const stats: UserStats = {
        chaptersRead: 100000,
        commentsPosted: 100000,
        likesGiven: 100000,
        favoritesAdded: 100000,
        activeDays: 100000,
        completedReadCycles: 100000,
        wordsWritten: 1000000,
        storiesCreated: 100000,
        chaptersPublished: 100000,
        viewsReceived: 1000000,
        likesReceived: 1000000,
        decorChanges: 100000,
        genresReadCount: 100000,
        authorsFollowedCount: 100000,
      };

      const result = countAndEvaluateCertification('Auteur', stats, 'user_cert_3');
      expect(result.authorPercent).toBeGreaterThanOrEqual(80);
      expect(result.shouldCertify).toBe(true);
    });

    it('does not certify an author below 80%', () => {
      const stats: UserStats = { ...INITIAL_STATS, storiesCreated: 1 };
      const result = countAndEvaluateCertification('Auteur', stats, 'user_cert_4');
      expect(result.authorPercent).toBeLessThan(80);
      expect(result.shouldCertify).toBe(false);
    });
  });
});
