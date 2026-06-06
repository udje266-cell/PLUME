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

    it('should return custom preset stats for user_reader', () => {
      const stats = getUserStats('user_reader');
      expect(stats.chaptersRead).toBe(105);
      expect(stats.wordsWritten).toBe(0);
    });

    it('should return custom preset stats for user_author', () => {
      const stats = getUserStats('user_author');
      expect(stats.wordsWritten).toBe(85000);
      expect(stats.chaptersPublished).toBe(12);
    });

    it('should return custom preset stats for user_mixed', () => {
      const stats = getUserStats('user_mixed');
      expect(stats.chaptersRead).toBe(31);
      expect(stats.wordsWritten).toBe(4800);
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

    it('should certify a reader with >= 80% achievements', () => {
      // We need to unlock 80% of 125 reader achievements = 100 achievements.
      // Let's create stats high enough to unlock 100 reader achievements.
      // - reader_1 to reader_25: chaptersRead >= 25
      // - reader_26 to reader_45: commentsPosted >= 20
      // - reader_46 to reader_65: likesGiven >= 40
      // - reader_66 to reader_75: favoritesAdded >= 10
      // - reader_76 to reader_90: chaptersRead >= 175
      // - reader_91 to reader_100: commentsPosted >= 42
      // - level-based 101-125: activeDays, completedReadCycles, etc.
      // Total 100 can be reached easily by maximizing chaptersRead, commentsPosted, likesGiven, favoritesAdded.
      const stats: UserStats = {
        chaptersRead: 200, // Unlocks 1-25 (25), 76-90 (15), lvl-based 101-105 (5) = 45 achievements
        commentsPosted: 50, // Unlocks 26-45 (20), 91-100 (10) = 30 achievements
        likesGiven: 50, // Unlocks 46-65 (20) = 20 achievements
        favoritesAdded: 10, // Unlocks 66-75 (10) = 10 achievements
        activeDays: 30, // Unlocks lvl-based 106-110 (5) = 5 achievements
        completedReadCycles: 8, // Unlocks lvl-based 111-115 (5) = 5 achievements
        wordsWritten: 0,
        storiesCreated: 0,
        chaptersPublished: 0,
        viewsReceived: 0,
        likesReceived: 0,
        decorChanges: 0,
        genresReadCount: 5, // Unlocks lvl-based 116-120 (5) = 5 achievements
        authorsFollowedCount: 10 // Unlocks lvl-based 121-125 (5) = 5 achievements
      };

      const result = countAndEvaluateCertification('Lecteur', stats, 'user_cert_2');
      expect(result.unlockedReaderCount).toBeGreaterThanOrEqual(100);
      expect(result.readerPercent).toBeGreaterThanOrEqual(80);
      expect(result.shouldCertify).toBe(true);
    });

    it('should certify a mixed user with >= 60% reader AND >= 60% author achievements', () => {
      // 60% reader = 75 achievements
      // 60% author = 60 achievements
      const stats: UserStats = {
        // Reader unlocks (need 75):
        chaptersRead: 30, // Unlocks 1-25 (25)
        commentsPosted: 25, // Unlocks 26-45 (20)
        likesGiven: 40, // Unlocks 46-65 (20)
        favoritesAdded: 10, // Unlocks 66-75 (10)
        // Total so far = 75 reader achievements
        activeDays: 45, // Unlocks author_18,19,21,22,24,25,41,42,52,53,58,59,61 (13 achievements)
        completedReadCycles: 1,

        // Author unlocks (need 60):
        wordsWritten: 60000, // Unlocks author_8,9,10,23,29,35,43,44,45,50,51,55,56,60,68 (15 achievements)
        storiesCreated: 6, // Unlocks author_2,3,4,5,26,27,28,38,39,46 (10 achievements)
        chaptersPublished: 12, // Unlocks author_1,6,7,36,37,40,47 (7 achievements)
        viewsReceived: 250, // Unlocks author_11,13,14,15,16,17,20,54,64 (9 achievements)
        likesReceived: 25, // Unlocks author_12,30,31,32,33,34,62 (7 achievements)
        decorChanges: 0,
      };

      const result = countAndEvaluateCertification('Utilisateur Mixte', stats, 'user_cert_3');
      expect(result.readerPercent).toBeGreaterThanOrEqual(60);
      expect(result.authorPercent).toBeGreaterThanOrEqual(60);
      expect(result.shouldCertify).toBe(true);
    });
  });
});
