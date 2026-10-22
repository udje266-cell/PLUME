import type { Express, RequestHandler } from 'express';
import type { PrismaClient } from '@prisma/client';
import type { Server } from 'socket.io';

export function registerLibraryRoutes(app: Express, prisma: PrismaClient, requireAuth: RequestHandler, io: Server) {
  const route = (fn: (req: any, res: any) => Promise<any>): RequestHandler => async (req, res) => {
    try { await fn(req, res); } catch (error: any) {
      if (error.code === 'P2002') { res.status(409).json({ error: 'Vous avez déjà une collection avec ce nom.' }); return; }
      if (error.code === 'P2025') { res.status(404).json({ error: 'Collection introuvable.' }); return; }
      console.error('[LIBRARY]', error);
      res.status(500).json({ error: 'La bibliothèque est momentanément indisponible.' });
    }
  };
  const changed = (userId: string) => io.to(`user:${userId}`).emit('reading_progress_changed');
  const validName = (name: unknown): name is string => typeof name === 'string' && name.trim().length > 0 && name.trim().length <= 80;

  app.get('/api/me/library', requireAuth, route(async (req, res) => {
    const userId = req.user.id;
    const [collections, entries, favorites, progress, history, reads] = await Promise.all([
      prisma.bookCollection.findMany({ where: { userId }, orderBy: { createdAt: 'asc' }, include: { books: { orderBy: { addedAt: 'desc' } } } }),
      prisma.readingListEntry.findMany({ where: { userId } }),
      prisma.favorite.findMany({ where: { userId }, select: { storyId: true, createdAt: true } }),
      prisma.readingProgress.findMany({ where: { userId, chapter: { isPublished: true } }, orderBy: { lastReadAt: 'desc' }, distinct: ['storyId'], select: { storyId: true, chapterId: true, progressPercent: true, paragraphIndex: true, lastReadAt: true } }),
      prisma.readingHistory.groupBy({ by: ['storyId'], where: { userId }, _min: { createdAt: true }, _max: { createdAt: true } }),
      prisma.chapterRead.findMany({ where: { userId }, select: { storyId: true, chapterId: true } }),
    ]);
    res.set('Cache-Control', 'private, no-store').json({ collections, entries, favorites, progress,
      history: history.map(row => ({ storyId: row.storyId, addedAt: row._min.createdAt, lastOpenedAt: row._max.createdAt })), reads });
  }));

  app.post('/api/me/collections', requireAuth, route(async (req, res) => {
    if (!validName(req.body?.name)) return res.status(400).json({ error: 'Choisissez un nom de 1 à 80 caractères.' });
    if (await prisma.bookCollection.count({ where: { userId: req.user.id } }) >= 100) return res.status(400).json({ error: 'Vous pouvez créer jusqu’à 100 collections.' });
    const collection = await prisma.bookCollection.create({ data: { userId: req.user.id, name: req.body?.name.trim() }, include: { books: true } });
    changed(req.user.id);
    res.status(201).json(collection);
  }));

  app.patch('/api/me/collections/:id', requireAuth, route(async (req, res) => {
    if (!validName(req.body?.name)) return res.status(400).json({ error: 'Choisissez un nom de 1 à 80 caractères.' });
    const owned = await prisma.bookCollection.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!owned) return res.sendStatus(404);
    res.json(await prisma.bookCollection.update({ where: { id: owned.id }, data: { name: req.body?.name.trim() }, include: { books: true } }));
    changed(req.user.id);
  }));

  app.delete('/api/me/collections/:id', requireAuth, route(async (req, res) => {
    const deleted = await prisma.bookCollection.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
    if (!deleted.count) return res.sendStatus(404);
    changed(req.user.id);
    res.sendStatus(204);
  }));

  // Membership changes are idempotent and ownership is checked on every request.
  for (const method of ['put', 'delete'] as const) {
    app[method]('/api/me/collections/:id/books/:storyId', requireAuth, route(async (req, res) => {
      const owned = await prisma.bookCollection.findFirst({ where: { id: req.params.id, userId: req.user.id } });
      if (!owned) return res.sendStatus(404);
      const where = { collectionId: owned.id, storyId: req.params.storyId };
      if (method === 'put') {
        const story = await prisma.story.findFirst({ where: { id: where.storyId, status: 'PUBLIE', isFlagged: false }, select: { id: true } });
        if (!story) return res.status(404).json({ error: 'Récit indisponible.' });
        await prisma.collectionBook.upsert({ where: { collectionId_storyId: where }, create: where, update: {} });
        // A shelf organizes a personal book; deleting the shelf must not remove it from the library.
        const listed = await prisma.readingListEntry.findFirst({ where: { userId: req.user.id, storyId: story.id } });
        if (!listed) await prisma.readingListEntry.upsert({
          where: { userId_storyId_list: { userId: req.user.id, storyId: story.id, list: 'later' } },
          create: { userId: req.user.id, storyId: story.id, list: 'later' }, update: {},
        });
      } else await prisma.collectionBook.deleteMany({ where });
      changed(req.user.id);
      res.sendStatus(204);
    }));
  }

  app.put('/api/me/library/books/:storyId/status', requireAuth, route(async (req, res) => {
    const list = req.body?.status;
    if (!['currently', 'later', 'completed'].includes(list)) return res.status(400).json({ error: 'État de lecture invalide.' });
    const story = await prisma.story.findUnique({ where: { id: req.params.storyId }, select: { id: true } });
    if (!story) return res.sendStatus(404);
    await prisma.$transaction([
      prisma.readingListEntry.deleteMany({ where: { userId: req.user.id, storyId: story.id, list: { in: ['currently', 'later', 'completed'].filter(value => value !== list) } } }),
      prisma.readingListEntry.upsert({ where: { userId_storyId_list: { userId: req.user.id, storyId: story.id, list } }, create: { userId: req.user.id, storyId: story.id, list }, update: {} }),
    ]);
    changed(req.user.id);
    res.json({ status: list });
  }));
}
