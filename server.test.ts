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
