// Integration smoke test. Run against an already-started local server and local test DB.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { io } from 'socket.io-client';

const database = new URL(process.env.DATABASE_URL);
assert(['localhost', '127.0.0.1'].includes(database.hostname), 'Use a local test database only');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Use a local test server only');
const db = new PrismaClient();
const prefix = `live-test-${randomUUID()}`;
const ids = ['reader', 'viewer', 'outsider'].map(x => `${prefix}-${x}`);
const [reader, viewer, outsider] = ids;
const secret = process.env.JWT_SECRET || 'plume_secret_dev_change_later';
const token = id => jwt.sign({ userId: id }, secret, { expiresIn: '5m' });
const call = async (id, path, body) => {
  const response = await fetch(base + path, { method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token(id)}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json().catch(() => null) };
};
const socket = io(base, { auth: { token: token(viewer) }, autoConnect: false, reconnection: false });
try {
  for (const id of ids) await db.user.create({ data: { id, username: id, email: `${id}@example.invalid`, showBooksRead: true } });
  const story = await db.story.create({ data: { id: prefix, title: 'Live test', description: '', genre: 'Fantasy', authorId: outsider, status: 'PUBLIE' } });
  const chapter = await db.chapter.create({ data: { id: prefix, title: 'Chapter', content: 'Test', order: 1, storyId: story.id, isPublished: true } });
  await db.readingGroup.create({ data: { id: prefix, name: 'Live group', creatorId: viewer, storyId: story.id, members: { connect: [{ id: viewer }, { id: reader }] } } });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Socket connect timeout')), 5000);
    socket.once('connect', () => { clearTimeout(timeout); resolve(); });
    socket.once('connect_error', error => { clearTimeout(timeout); reject(error); });
    socket.connect();
  });
  for (const percent of [12, 58, 100]) {
    const change = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Missing live progress event')), 3000);
      socket.once('reading_progress_changed', () => { clearTimeout(timeout); resolve(); });
    });
    assert.equal((await call(reader, `/api/chapters/${chapter.id}/progress`, { progressPercent: percent })).status, 200);
    await change;
    for (const scope of [`userId=${reader}`, `storyId=${story.id}`, `groupId=${prefix}`]) {
      const snapshot = await call(viewer, `/api/live-reading?${scope}`);
      assert.equal(snapshot.status, 200);
      assert.equal(snapshot.body.find(row => row.userId === reader)?.progressPercent, percent);
    }
  }
  assert.equal((await call(outsider, `/api/live-reading?groupId=${prefix}`)).status, 403);
  await db.user.update({ where: { id: reader }, data: { showBooksRead: false } });
  assert.deepEqual((await call(viewer, `/api/live-reading?userId=${reader}`)).body, []);
  assert.equal((await call(reader, `/api/live-reading?userId=${reader}`)).body.length, 1);
  await db.user.update({ where: { id: reader }, data: { showBooksRead: true, privateProfile: true } });
  assert.deepEqual((await call(viewer, `/api/live-reading?storyId=${story.id}`)).body, []);
  await db.user.update({ where: { id: reader }, data: { privateProfile: false } });
  for (const [blockerId, blockedId] of [[reader, viewer], [viewer, reader]]) {
    await db.blockedUser.create({ data: { blockerId, blockedId } });
    assert.deepEqual((await call(viewer, `/api/live-reading?userId=${reader}`)).body, []);
    await db.blockedUser.deleteMany({ where: { blockerId, blockedId } });
  }
  await db.chapter.update({ where: { id: chapter.id }, data: { isPublished: false } });
  assert.deepEqual((await call(viewer, `/api/live-reading?storyId=${story.id}`)).body, []);
  console.log('PASS: two accounts, three scopes, 12 → 58 → 100%, Socket.io delivery, group access, privacy, blocks, unpublished chapter.');
} finally {
  socket.disconnect();
  await db.readingGroup.deleteMany({ where: { id: prefix } });
  await db.story.deleteMany({ where: { id: prefix } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
}
