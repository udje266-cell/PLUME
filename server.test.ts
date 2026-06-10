import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createServerInstance } from './server';
import { prisma } from './src/server/prisma';

// Mock the prisma client exported by src/server/prisma.ts
vi.mock('./src/server/prisma', () => {
  return {
    prisma: {
      user: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      story: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      storyLike: {
        upsert: vi.fn(),
        delete: vi.fn(),
      },
      blockedUser: {
        findFirst: vi.fn(),
      },
      follow: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
      report: {
        upsert: vi.fn(),
        count: vi.fn(),
      },
      readingHistory: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      chapter: {
        update: vi.fn(),
      },
      otp: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
      },
    },
  };
});

describe('API Integration Tests (Express routes)', () => {
  let app: any;
  const JWT_SECRET = process.env.JWT_SECRET || 'plume_secret_dev_change_later';

  beforeAll(async () => {
    // Build the server instance (Vite is bypassed in test mode)
    const instance = await createServerInstance();
    app = instance.app;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/stories', () => {
    it('should return 200 and a list of serialized stories', async () => {
      const mockStories = [
        {
          id: 'story-1',
          title: 'L\'Archipel Céleste',
          description: 'Un voyage au-dessus des nuages',
          tags: '["aventure", "fantasy"]',
          status: 'PUBLIE',
          ageRating: 'ALL',
          authorId: 'user-author-id',
          author: {
            id: 'user-author-id',
            username: 'AuteurPlume',
            role: 'AUTEUR',
            gender: 'HOMME',
            createdAt: new Date('2026-01-01'),
          },
          chapters: [],
          likes: [],
          favorites: [],
        },
      ];

      vi.mocked(prisma.story.findMany).mockResolvedValue(mockStories as any);

      const res = await request(app)
        .get('/api/stories')
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBe(1);

      const story = res.body[0];
      expect(story.title).toBe('L\'Archipel Céleste');
      expect(story.status).toBe('Publié'); // Mapped status
      expect(story.ageRating).toBe('all'); // Mapped ageRating
      expect(story.tags).toEqual(['aventure', 'fantasy']); // Parsed tags JSON
      expect(story.authorName).toBe('AuteurPlume');
    });
  });

  describe('Story mass-assignment protection (H2)', () => {
    const authorId = 'author-1';
    const authorUser = {
      id: authorId,
      email: 'author@example.com',
      username: 'author',
      role: 'Auteur',
      gender: 'HOMME',
      createdAt: new Date('2026-01-01'),
      followers: [],
      following: [],
      blockedUsers: [],
    };
    const token = jwt.sign({ userId: authorId }, JWT_SECRET, { expiresIn: '1h' });

    const serializableStory = {
      id: 'story-x',
      title: 'T',
      tags: '[]',
      status: 'BROUILLON',
      ageRating: 'ALL',
      authorId,
      author: authorUser,
      chapters: [],
      likes: [],
      favorites: [],
    };

    it('POST /api/stories ignores client-supplied views/reads/rating/isFlagged', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(authorUser as any);
      vi.mocked(prisma.story.create).mockResolvedValue(serializableStory as any);

      await request(app)
        .post('/api/stories')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'T', views: 9999, reads: 9999, rating: 5, isFlagged: true })
        .expect(201);

      const data = vi.mocked(prisma.story.create).mock.calls[0][0].data as any;
      expect(data.views).toBeUndefined();
      expect(data.reads).toBeUndefined();
      expect(data.rating).toBeUndefined();
      expect(data.isFlagged).toBeUndefined();
      expect(data.authorId).toBe(authorId); // author forced from token
    });

    it('PUT /api/stories/:id does not let a non-admin author unflag or fake stats', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(authorUser as any);
      vi.mocked(prisma.story.findUnique).mockResolvedValue({ id: 'story-x', authorId, isFlagged: true } as any);
      vi.mocked(prisma.story.update).mockResolvedValue(serializableStory as any);

      await request(app)
        .put('/api/stories/story-x')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'T2', views: 9999, reads: 9999, rating: 5, isFlagged: false })
        .expect(200);

      const data = vi.mocked(prisma.story.update).mock.calls[0][0].data as any;
      expect(data.views).toBeUndefined();
      expect(data.reads).toBeUndefined();
      expect(data.rating).toBeUndefined();
      expect(data.isFlagged).toBeUndefined(); // moderation flag reserved to admins
      expect(data.flagReason).toBeUndefined();
    });
  });

  describe('Draft visibility (M1)', () => {
    it('GET /api/stories only lists published stories for anonymous visitors', async () => {
      vi.mocked(prisma.story.findMany).mockResolvedValue([] as any);

      await request(app).get('/api/stories').expect(200);

      const args = vi.mocked(prisma.story.findMany).mock.calls[0][0] as any;
      expect(args.where).toEqual({ status: 'PUBLIE' });
    });
  });

  describe('OTP enumeration & brute-force protection (M5/M6)', () => {
    beforeEach(() => {
      // Les helpers OTP appellent .catch() sur ces promesses : les mocks
      // doivent donc résoudre une promesse (sinon TypeError → 500).
      vi.mocked(prisma.otp.delete).mockResolvedValue(undefined as any);
      vi.mocked(prisma.otp.update).mockResolvedValue(undefined as any);
      vi.mocked(prisma.otp.deleteMany).mockResolvedValue(undefined as any);
      vi.mocked(prisma.otp.create).mockResolvedValue(undefined as any);
    });

    it('otp/request reset returns a generic message and creates no code for unknown emails', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null as any);

      const res = await request(app)
        .post('/api/auth/otp/request')
        .send({ email: 'nobody@example.com', reason: 'reset' })
        .expect(200);

      expect(res.body.message).toMatch(/si un compte existe/i);
      expect(vi.mocked(prisma.otp.create)).not.toHaveBeenCalled();
    });

    it('verify-otp invalidates the code after too many wrong attempts', async () => {
      vi.mocked(prisma.otp.findUnique).mockResolvedValue({
        email: 'user@example.com',
        code: '111111',
        attempts: 4, // next wrong attempt reaches the limit
        expiresAt: new Date(Date.now() + 60_000),
      } as any);

      const res = await request(app)
        .post('/api/auth/verify-otp')
        .send({ email: 'user@example.com', code: '000000' })
        .expect(429);

      expect(res.body.error).toMatch(/trop de tentatives/i);
      expect(vi.mocked(prisma.otp.delete)).toHaveBeenCalled();
    });

    it('verify-otp returns a generic error (no oracle) on a wrong but non-final attempt', async () => {
      vi.mocked(prisma.otp.findUnique).mockResolvedValue({
        email: 'user@example.com',
        code: '111111',
        attempts: 0,
        expiresAt: new Date(Date.now() + 60_000),
      } as any);

      const res = await request(app)
        .post('/api/auth/verify-otp')
        .send({ email: 'user@example.com', code: '000000' })
        .expect(400);

      expect(res.body.error).toBe('Code OTP invalide ou expiré.');
      expect(vi.mocked(prisma.otp.update)).toHaveBeenCalled();
    });
  });

  describe('Block & privacy enforcement (M2/M3)', () => {
    const me = { id: 'me', email: 'me@example.com', username: 'me', role: 'Lecteur', followers: [], following: [], blockedUsers: [] };
    const token = jwt.sign({ userId: 'me' }, JWT_SECRET, { expiresIn: '1h' });

    it('POST /api/users/:id/follow is refused when a block exists', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(me as any); // requireAuth + target
      vi.mocked(prisma.blockedUser.findFirst).mockResolvedValue({ id: 'b1' } as any);

      const res = await request(app)
        .post('/api/users/target-1/follow')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(res.body.error).toMatch(/blocage/i);
      expect(vi.mocked(prisma.follow.upsert)).not.toHaveBeenCalled();
    });

    it('POST /api/users/:id/follow is refused when target disabled new followers', async () => {
      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce(me as any) // requireAuth
        .mockResolvedValueOnce({ whoCanFollow: 'none' } as any); // target lookup

      const res = await request(app)
        .post('/api/users/target-1/follow')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(res.body.error).toMatch(/abonn/i);
      expect(vi.mocked(prisma.follow.upsert)).not.toHaveBeenCalled();
    });
  });

  describe('Report abuse protection (M4)', () => {
    const token = jwt.sign({ userId: 'me' }, JWT_SECRET, { expiresIn: '1h' });

    it('rejects self-reporting', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'me', role: 'Lecteur' } as any);

      const res = await request(app)
        .post('/api/users/me/report')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(res.body.error).toMatch(/vous-même/i);
    });

    it('does not flag an account below the report threshold', async () => {
      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce({ id: 'me', role: 'Lecteur' } as any) // requireAuth
        .mockResolvedValueOnce({ id: 'target', isFlagged: false } as any); // target lookup
      vi.mocked(prisma.report.upsert).mockResolvedValue({} as any);
      vi.mocked(prisma.report.count).mockResolvedValue(1 as any);

      const res = await request(app)
        .post('/api/users/target/report')
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'spam' })
        .expect(200);

      expect(res.body.isFlagged).toBe(false);
      expect(res.body.reportCount).toBe(1);
      expect(vi.mocked(prisma.user.update)).not.toHaveBeenCalled();
    });
  });

  describe('Read-count inflation protection (M7)', () => {
    const token = jwt.sign({ userId: 'me' }, JWT_SECRET, { expiresIn: '1h' });

    it('does not increment counters for a recent repeated read', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'me', role: 'Lecteur' } as any);
      vi.mocked(prisma.readingHistory.findFirst).mockResolvedValue({ id: 'recent' } as any);
      vi.mocked(prisma.readingHistory.create).mockResolvedValue({ id: 'h1' } as any);

      await request(app)
        .post('/api/stories/story-1/read')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      expect(vi.mocked(prisma.story.update)).not.toHaveBeenCalled();
    });
  });

  describe('Server-authoritative certification (H1)', () => {
    const token = jwt.sign({ userId: 'me' }, JWT_SECRET, { expiresIn: '1h' });

    it('ignores a client-sent isVerified on profile update for non-admins', async () => {
      const meUser = {
        id: 'me',
        email: 'me@example.com',
        username: 'me',
        role: 'Lecteur',
        isVerified: false,
        followers: [],
        following: [],
        blockedUsers: [],
      };
      vi.mocked(prisma.user.findUnique).mockResolvedValue(meUser as any);
      vi.mocked(prisma.user.update).mockResolvedValue(meUser as any);

      const res = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ bio: 'hello', isVerified: true })
        .expect(200);

      // The client cannot grant itself the badge; a reader stays unverified.
      expect(res.body.isVerified).toBe(false);
      const updateData = vi.mocked(prisma.user.update).mock.calls[0][0].data as any;
      expect(updateData.isVerified).toBeUndefined();
    });
  });

  describe('POST /api/auth/login', () => {
    const mockPassword = 'safe-password-123';
    const mockPasswordHash = bcrypt.hashSync(mockPassword, 10);

    it('should login successfully with correct credentials', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'user@example.com',
        username: 'user1',
        passwordHash: mockPasswordHash,
        role: 'LECTEUR',
        gender: 'HOMME',
        createdAt: new Date('2026-01-01'),
        followers: [],
        following: [],
        blockedUsers: [],
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@example.com', password: mockPassword })
        .expect(200);

      expect(res.body.token).toBeDefined();
      expect(res.body.user.username).toBe('user1');
      expect(res.body.user.role).toBe('Lecteur');
    });

    it('should set an httpOnly auth cookie on successful login', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'user@example.com',
        username: 'user1',
        passwordHash: mockPasswordHash,
        role: 'LECTEUR',
        gender: 'HOMME',
        createdAt: new Date('2026-01-01'),
        followers: [],
        following: [],
        blockedUsers: [],
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@example.com', password: mockPassword })
        .expect(200);

      const setCookie = res.headers['set-cookie'] as unknown as string[];
      expect(setCookie).toBeDefined();
      const authCookie = setCookie.find((c) => c.startsWith('plume_token='));
      expect(authCookie).toBeDefined();
      expect(authCookie).toMatch(/HttpOnly/i);
    });

    it('should fail with 401 when password does not match', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'user@example.com',
        username: 'user1',
        passwordHash: mockPasswordHash,
        role: 'LECTEUR',
        gender: 'HOMME',
        createdAt: new Date('2026-01-01'),
        followers: [],
        following: [],
        blockedUsers: [],
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@example.com', password: 'wrong-password' })
        .expect(401);

      expect(res.body.error).toBe('Identifiants incorrects');
      expect(res.body.token).toBeUndefined();
    });

    it('should fail with 400 when parameters are missing', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@example.com' })
        .expect(400);

      await request(app)
        .post('/api/auth/login')
        .send({ password: 'some-password' })
        .expect(400);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should reject requests without authorization token with 401', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(res.body.error).toBe('Non connecté');
    });

    it('should return user info when valid authorization header is present', async () => {
      const mockUser = {
        id: 'user-authenticated',
        email: 'auth-user@example.com',
        username: 'authuser',
        role: 'LECTEUR',
        gender: 'HOMME',
        createdAt: new Date('2026-01-01'),
        followers: [],
        following: [],
        blockedUsers: [],
      };

      // Mock user lookup inside the requireAuth middleware and the endpoint
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

      // Create a valid jwt token
      const token = jwt.sign({ userId: mockUser.id }, JWT_SECRET, { expiresIn: '1h' });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.username).toBe('authuser');
      expect(res.body.email).toBe('auth-user@example.com');
      expect(res.body.role).toBe('Lecteur');
    });

    it('should authenticate via the httpOnly cookie (no Authorization header)', async () => {
      const mockUser = {
        id: 'user-authenticated',
        email: 'auth-user@example.com',
        username: 'authuser',
        role: 'LECTEUR',
        gender: 'HOMME',
        createdAt: new Date('2026-01-01'),
        followers: [],
        following: [],
        blockedUsers: [],
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      const token = jwt.sign({ userId: mockUser.id }, JWT_SECRET, { expiresIn: '1h' });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', `plume_token=${token}`)
        .expect(200);

      expect(res.body.username).toBe('authuser');
    });

    it('should return 401 for expired or malformed token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token-string')
        .expect(401);

      expect(res.body.error).toBe('Session invalide');
    });
  });
});
