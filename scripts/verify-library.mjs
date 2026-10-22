// Run with a local development server and a local test database. Fixtures are cleaned up.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
assert(['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname), 'Local database required');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Local server required');
const prisma = new PrismaClient();
const id = `library-test-${randomUUID()}`, stranger = `${id}-stranger`;
const call = async (user, method, path, body) => {
  const token = jwt.sign({ userId: user }, process.env.JWT_SECRET || 'plume_secret_dev_change_later', { expiresIn: '5m' });
  const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json().catch(() => null), cache: response.headers.get('cache-control') };
};
try {
  for (const user of [id, stranger]) await prisma.user.create({ data: { id: user, username: user, email: `${user}@example.invalid` } });
  await prisma.story.create({ data: { id, title: 'Private shelves', genre: 'Fantasy', description: '', authorId: stranger, status: 'PUBLIE' } });
  await prisma.chapter.create({ data: { id, title: 'Chapter', content: 'One\n\nTwo', order: 1, storyId: id, isPublished: true } });
  const preflight = await fetch(`${base}/api/me/collections/probe`, { method: 'OPTIONS', headers: { Origin: 'https://localhost', 'Access-Control-Request-Method': 'PATCH', 'Access-Control-Request-Headers': 'authorization,content-type' } });
  assert.equal(preflight.status, 204);
  assert(preflight.headers.get('access-control-allow-methods').split(',').includes('PATCH'));
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://localhost');
  const anonymous = await fetch(`${base}/api/me/library`); assert.equal(anonymous.status, 401);
  assert.equal((await call(id, 'POST', '/api/me/collections', { name: ' ' })).status, 400);
  const created = await call(id, 'POST', '/api/me/collections', { name: 'Lectures du soir' });
  assert.equal(created.status, 201); const collection = created.body.id;
  assert.equal((await call(id, 'POST', '/api/me/collections', { name: 'Lectures du soir' })).status, 409);
  for (const [method, suffix, body] of [['PATCH', '', { name: 'Hacked' }], ['DELETE', '', undefined], ['PUT', `/books/${id}`, undefined], ['DELETE', `/books/${id}`, undefined]]) {
    assert.equal((await call(stranger, method, `/api/me/collections/${collection}${suffix}`, body)).status, 404);
  }
  for (let i = 0; i < 2; i++) assert.equal((await call(id, 'PUT', `/api/me/collections/${collection}/books/${id}`)).status, 204);
  let snapshot = await call(id, 'GET', '/api/me/library');
  assert.equal(snapshot.cache, 'private, no-store');
  assert.equal(snapshot.body.collections[0].books.length, 1);
  assert.equal(snapshot.body.entries[0].list, 'later');
  assert.equal((await call(stranger, 'GET', '/api/me/library')).body.collections.length, 0);
  for (const status of ['currently', 'completed', 'later']) {
    assert.equal((await call(id, 'PUT', `/api/me/library/books/${id}/status`, { status })).status, 200);
    const entries = await prisma.readingListEntry.findMany({ where: { userId: id, storyId: id } });
    assert.equal(entries.length, 1); assert.equal(entries[0].list, status);
  }
  await call(id, 'POST', `/api/chapters/${id}/progress`, { progressPercent: 62, paragraphIndex: 9 });
  snapshot = await call(id, 'GET', '/api/me/library'); assert.equal(snapshot.body.progress[0].progressPercent, 62); assert.equal(snapshot.body.progress[0].paragraphIndex, 9);
  assert.equal((await call(id, 'GET', `/api/me/progress/${id}`)).body.paragraphIndex, 9);
  assert.equal((await call(id, 'POST', `/api/chapters/${id}/progress`, { progressPercent: 62, paragraphIndex: -1 })).status, 400);
  await call(id, 'POST', `/api/chapters/${id}/progress`, { progressPercent: 62 });
  assert.equal((await call(id, 'GET', `/api/me/progress/${id}`)).body.paragraphIndex, null);
  assert.equal((await call(id, 'PATCH', `/api/me/collections/${collection}`, { name: 'Fantasy' })).status, 200);
  assert.equal((await call(id, 'GET', '/api/me/library')).body.collections[0].name, 'Fantasy');
  assert.equal((await call(id, 'DELETE', `/api/me/collections/${collection}/books/${id}`)).status, 204);
  assert.equal((await call(id, 'GET', '/api/me/library')).body.collections[0].books.length, 0);
  assert.equal((await call(id, 'DELETE', `/api/me/collections/${collection}`)).status, 204);
  assert.equal((await call(id, 'GET', '/api/me/library')).body.collections.length, 0);
  assert.equal(await prisma.readingListEntry.count({ where: { userId: id, storyId: id } }), 1);
  assert.equal(await prisma.readingProgress.count({ where: { userId: id } }), 1);
  const cascade = await call(id, 'POST', '/api/me/collections', { name: 'Cleanup' });
  await call(id, 'PUT', `/api/me/collections/${cascade.body.id}/books/${id}`);
  await prisma.user.delete({ where: { id } });
  assert.equal(await prisma.bookCollection.count({ where: { userId: id } }), 0);
  assert.equal(await prisma.collectionBook.count({ where: { collectionId: cascade.body.id } }), 0);
  console.log('PASS: private collections, creation/rename/deletion, idempotent membership, exclusive statuses, 62% real progress, retained books, account cascade cleanup.');
} finally {
  await prisma.story.deleteMany({ where: { id } });
  await prisma.user.deleteMany({ where: { id: { in: [id, stranger] } } });
  await prisma.$disconnect();
}
