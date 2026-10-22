// Start the local dev server first. Uses disposable fixtures on a loopback database only.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
assert(['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname), 'Local database required');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Local server required');
const db = new PrismaClient(), id = 'inbox-test-' + randomUUID(), other = id + '-other', stranger = id + '-stranger';
const call = async (userId, method, path, body) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET || 'plume_secret_dev_change_later', { expiresIn: '5m' });
  const response = await fetch(base + path, { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json(), cache: response.headers.get('cache-control') };
};
try {
  for (const userId of [id, other, stranger]) await db.user.create({ data: { id: userId, username: userId, email: userId + '@example.invalid' } });
  await db.conversation.create({ data: { id, participants: { connect: [{ id }, { id: other }] }, messages: { create: [{ id, senderId: other, content: 'Une nouvelle lecture' }, { id: id+'-deleted', senderId: other, content: '', deletedForEveryone: true }] } } });
  assert.equal((await fetch(base + `/api/conversations/${id}/pin`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pinned: true }) })).status, 401);
  assert.equal((await call(stranger, 'PUT', `/api/conversations/${id}/pin`, { pinned: true })).status, 404);
  assert.equal((await call(id, 'PUT', `/api/conversations/${id}/pin`, { pinned: 'true' })).status, 400);
  const first = await call(id, 'PUT', `/api/conversations/${id}/pin`, { pinned: true });
  assert.equal(first.status, 200); assert.equal(first.body.isPinned, true);
  assert.equal((await call(id, 'PUT', `/api/conversations/${id}/pin`, { pinned: true })).body.pinnedAt, first.body.pinnedAt);
  assert.equal(await db.conversationPin.count({ where: { conversationId: id } }), 1);
  let snapshot = await call(id, 'GET', '/api/conversations');
  assert.equal(snapshot.cache, 'private, no-store'); assert.equal(snapshot.body[0].isPinned, true); assert.equal(snapshot.body[0].unreadCount, 1); assert.equal(snapshot.body[0].pins, undefined);
  snapshot = await call(other, 'GET', '/api/conversations'); assert.equal(snapshot.body[0].isPinned, false); assert.equal(snapshot.body[0].pinnedAt, null);
  assert.equal((await call(other, 'PUT', `/api/conversations/${id}/pin`, { pinned: true })).status, 200);
  assert.equal((await call(id, 'PUT', `/api/conversations/${id}/pin`, { pinned: false })).body.isPinned, false);
  assert.equal((await call(id, 'PUT', `/api/conversations/${id}/pin`, { pinned: false })).body.isPinned, false);
  assert.equal((await call(other, 'GET', '/api/conversations')).body[0].isPinned, true);
  await db.user.delete({ where: { id: other } }); assert.equal(await db.conversationPin.count({ where: { userId: other } }), 0);
  await call(id, 'PUT', `/api/conversations/${id}/pin`, { pinned: true });
  await db.conversation.delete({ where: { id } }); assert.equal(await db.conversationPin.count({ where: { conversationId: id } }), 0);
  console.log('PASS inbox API: authentication, participant isolation, valid booleans, idempotent private pins, per-user independence, accurate unread counts, account and conversation cascades.');
} finally {
  await db.conversation.deleteMany({ where: { id } });
  await db.user.deleteMany({ where: { id: { in: [id, other, stranger] } } });
  await db.$disconnect();
}
