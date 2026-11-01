'use strict';

/**
 * Adapter CRUD integration tests: CsvModel is driven exactly the way Waline's
 * controllers drive it, over real HTTP, real shard files and a real manifest.
 */

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { createHarness, commentData, userData } = require('./helpers');

test('add: readable immediately after write, still there after a cold start', async (t) => {
  const harness = await createHarness();

  t.after(() => harness.dispose());

  const comment = harness.model('Comment');
  const created = await comment.add(commentData({ comment: 'first' }));

  assert.ok(created.objectId, 'add must return an objectId');
  assert.equal(typeof created.objectId, 'string');

  // Not flushed yet, but already visible in this process, so a comment never
  // reads as "committed but gone after refresh"
  const visible = await comment.select({ url: '/post-1' });

  assert.equal(visible.length, 1);
  assert.equal(visible[0].objectId, created.objectId);

  await harness.depot.queue.flush();
  assert.equal(harness.mock.headCommit !== null, true, 'flush must produce a commit');

  const { model } = await harness.coldStart();
  const reloaded = await model('Comment').select({ url: '/post-1' });

  assert.equal(reloaded.length, 1);
  assert.equal(reloaded[0].objectId, created.objectId);
  assert.equal(reloaded[0].comment, 'first');
  assert.equal(reloaded[0].insertedAt, '2026-09-25T10:00:00.000Z');
  assert.equal(reloaded[0].status, 'approved');
});

test('select / count / count(group): filter by url and status', async (t) => {
  const harness = await createHarness();

  t.after(() => harness.dispose());

  const comment = harness.model('Comment');

  await comment.add(commentData({ url: '/a', comment: '#1' }));
  await comment.add(commentData({ url: '/a', comment: '#2', status: 'waiting' }));
  await comment.add(commentData({ url: '/b', comment: '#3' }));
  await harness.depot.queue.flush();

  assert.equal(await comment.count({ url: '/a' }), 2);
  assert.equal(await comment.count({ url: ['IN', ['/a', '/b']] }), 3);
  assert.equal(await comment.count({ status: ['NOT IN', ['waiting', 'spam']] }), 2);
  assert.equal(await comment.count({}), 3);
  assert.equal(await comment.count({ url: '/nope' }), 0);

  const grouped = await comment.count({}, { group: ['url'] });

  assert.deepEqual(
    grouped.sort((a, b) => (a.url < b.url ? -1 : 1)),
    [
      { count: 2, url: '/a' },
      { count: 1, url: '/b' },
    ],
  );
});

test('select: rid=undefined takes roots, rid IN takes children (pagination)', async (t) => {
  const harness = await createHarness();

  t.after(() => harness.dispose());

  const comment = harness.model('Comment');
  const root = await comment.add(commentData({ comment: 'root' }));

  await comment.add(commentData({ comment: 'child-1', rid: root.objectId, pid: root.objectId }));
  await comment.add(commentData({ comment: 'child-2', rid: root.objectId, pid: root.objectId }));

  const roots = await comment.select({ url: '/post-1', rid: undefined });

  assert.equal(roots.length, 1);
  assert.equal(roots[0].objectId, root.objectId);

  const children = await comment.select({ url: '/post-1', rid: ['IN', [root.objectId]] });

  assert.equal(children.length, 2);
  assert.equal(await comment.count({ url: '/post-1', rid: undefined }), 1);
});

test('select: field projection keeps objectId and honours the upstream id alias', async (t) => {
  const harness = await createHarness();

  t.after(() => harness.dispose());

  const comment = harness.model('Comment');

  await comment.add(commentData({ comment: 'hello' }));

  const [projected] = await comment.select({ url: '/post-1' }, { field: ['comment', 'status'] });

  assert.deepEqual(Object.keys(projected).sort(), ['comment', 'objectId', 'status']);

  const [withAlias] = await comment.select({ url: '/post-1' }, { field: ['id', 'email'] });

  assert.equal(typeof withAlias.objectId, 'string');
  assert.equal('email' in withAlias, false);
});

test('select: order / desc / limit / offset and sticky null ordering', async (t) => {
  const harness = await createHarness();

  t.after(() => harness.dispose());

  const comment = harness.model('Comment');

  for (const [index, sticky] of [
    ['1', '1'],
    ['2', ''],
    ['3', '1'],
    ['4', ''],
    ['5', ''],
  ]) {
    await comment.add(
      commentData({
        comment: `c${index}`,
        sticky: sticky || undefined,
        insertedAt: new Date(`2026-09-2${index}T10:00:00.000Z`),
      }),
    );
  }

  const ordered = await comment.select(
    { url: '/post-1' },
    {
      limit: 2,
      offset: 0,
      order: [
        { field: 'sticky', direction: 'desc', nulls: 'last' },
        { field: 'insertedAt', direction: 'desc' },
      ],
    },
  );

  // The two sticky rows come first in reverse time order, then the empty ones
  assert.deepEqual(ordered.map((row) => row.comment), ['c3', 'c1']);

  const secondPage = await comment.select(
    { url: '/post-1' },
    {
      limit: 2,
      offset: 2,
      order: [
        { field: 'sticky', direction: 'desc', nulls: 'last' },
        { field: 'insertedAt', direction: 'desc' },
      ],
    },
  );

  assert.deepEqual(secondPage.map((row) => row.comment), ['c5', 'c4']);

  const byDesc = await comment.select({ url: '/post-1' }, { desc: 'insertedAt', limit: 1 });

  assert.equal(byDesc[0].comment, 'c5');

  await assert.rejects(() => comment.select({}, { order: [{ field: 'comment', direction: 'up' }] }), TypeError);
});

test('update: object patch, function patch and function returning an object', async (t) => {
  const harness = await createHarness();

  t.after(() => harness.dispose());

  const comment = harness.model('Comment');
  const created = await comment.add(commentData({ comment: 'before' }));

  const [byObject] = await comment.update({ comment: 'after-object' }, { objectId: created.objectId });

  assert.equal(byObject.comment, 'after-object');
  assert.equal(byObject.objectId, created.objectId);

  // Function returning a patch, as article.js does for counter increments
  const [byReturned] = await comment.update(
    (row) => ({ comment: `after-${row.comment}` }),
    { objectId: created.objectId },
  );

  assert.equal(byReturned.comment, 'after-after-object');

  // In-place mutation, which upstream also allows
  await comment.update(
    (row) => {
      row.comment = 'after-mutation';
    },
    { objectId: created.objectId },
  );

  const [final] = await comment.select({ objectId: created.objectId });

  assert.equal(final.comment, 'after-mutation');

  // The primary key cannot be overwritten by a patch
  await comment.update({ objectId: 'hacked', comment: 'x' }, { objectId: created.objectId });
  assert.equal((await comment.select({ objectId: 'hacked' })).length, 0);
});

test('delete: delete by condition, empty the table and remove shard files', async (t) => {
  const harness = await createHarness();

  t.after(() => harness.dispose());

  const comment = harness.model('Comment');
  const root = await comment.add(commentData({ comment: 'root' }));

  await comment.add(commentData({ comment: 'child', rid: root.objectId, pid: root.objectId }));

  // Cascade delete, as controller deleteAction does with _complex + or
  await comment.delete({
    _complex: { _logic: 'or', objectId: root.objectId, pid: root.objectId, rid: root.objectId },
  });

  assert.equal(await comment.count({}), 0);

  await comment.add(commentData({ comment: 'again' }));
  await harness.depot.queue.flush();

  const shardFiles = () =>
    [...harness.mock.listFiles().keys()].filter(
      (path) => path.startsWith('data/comments/') && path.endsWith('.csv') && !path.endsWith('_manifest.csv'),
    );

  assert.equal(shardFiles().length, 1);

  // db.js "reset data" button: delete({})
  await comment.delete({});
  await harness.depot.queue.flush();

  assert.equal(await comment.count({}), 0);
  assert.deepEqual(shardFiles(), [], 'an emptied shard file must be deleted from the repository');
  assert.equal(harness.mock.readText(harness.depot.manager.manifestPath('Comment')).trim(), 'shard_path,row_count,sha,updated_at,min_key,max_key');
});

test('Users: email lookup, objectId filter, type banning', async (t) => {
  const harness = await createHarness();

  t.after(() => harness.dispose());

  const users = harness.model('Users');
  const admin = await users.add(userData({ email: 'admin@x.com', type: 'administrator', display_name: 'Admin' }));
  const guest = await users.add(userData({ email: 'guest@x.com', display_name: 'Guest' }));

  assert.equal(await users.count(), 2);

  const [byEmail] = await users.select({ email: 'guest@x.com' });

  assert.equal(byEmail.objectId, guest.objectId);

  const byIds = await users.select({ objectId: ['IN', [admin.objectId, guest.objectId, 'missing']] });

  assert.equal(byIds.length, 2);

  // logic/base.js login check: objectId + type != banned
  const [login] = await users.select({ objectId: guest.objectId, type: ['!=', 'banned'] }, {
    field: ['id', 'email', 'url', 'display_name', 'type', 'avatar', '2fa', 'label'],
  });

  assert.equal(login.objectId, guest.objectId);
  // 2fa is not a canonical Users column (matching upstream CSV_HEADERS), so it is
  // absent until something writes it
  assert.ok(!login['2fa']);
  assert.equal(login.display_name, 'Guest');

  await users.update({ type: 'banned' }, { objectId: guest.objectId });

  assert.equal((await users.select({ objectId: guest.objectId, type: ['!=', 'banned'] })).length, 0);
  assert.equal((await users.select({ objectId: guest.objectId, type: 'banned' })).length, 1);

  // Newest users first, as the admin backend lists them
  const list = await users.select({}, { desc: 'createdAt', limit: 1 });

  assert.equal(list.length, 1);
  assert.ok(list[0].createdAt, 'a new user must get createdAt, or backend sorting is meaningless');

  const deleted = guest.objectId;

  await users.delete({ objectId: deleted });
  assert.equal(await users.count(), 1);
});

test('Counter: create, increment, batch query (the full article.js flow)', async (t) => {
  const harness = await createHarness();

  t.after(() => harness.dispose());

  const counter = harness.model('Counter');
  const first = await counter.add({ url: '/a', time: 1 }, { access: { read: true, write: true } });

  assert.ok(first.objectId);

  // Second visit: update through a function patch
  const resp = await counter.select({ url: '/a' });
  const ret = await counter.update(
    (row) => ({ time: (Number(row.time) || 0) + 1, updatedAt: new Date() }),
    { objectId: ['IN', resp.map((row) => row.objectId)] },
  );

  assert.equal(ret[0].time, '2');

  const second = await counter.add({ url: '/b', time: 1 });

  assert.ok(second.objectId);

  const all = await counter.select({ url: ['IN', ['/a', '/b', '/c']] });

  assert.equal(all.length, 2);

  await harness.depot.queue.flush();

  const { model } = await harness.coldStart();
  const reloaded = await model('Counter').select({ url: '/a' });

  assert.equal(reloaded[0].time, '2');
});

test('add persists dynamic columns (sticky / like / 2fa) for all three tables', async (t) => {
  const harness = await createHarness();

  t.after(() => harness.dispose());

  await harness.model('Comment').add(commentData({ comment: 'x', sticky: true, like: 3 }));
  await harness.model('Users').add(userData({ '2fa': 'secret', twitter: 'alice' }));
  await harness.depot.queue.flush();

  const { model } = await harness.coldStart();
  const [comment] = await model('Comment').select({ url: '/post-1' });
  const [user] = await model('Users').select({ email: 'a@example.com' });

  // Upstream uses fast-csv with headers:true, which drops dynamic columns that
  // were absent from the first written row; they must survive here
  assert.equal(comment.sticky, 'true');
  assert.equal(comment.like, '3');
  assert.equal(user['2fa'], 'secret');
  assert.equal(user.twitter, 'alice');
});

test('dedup window: identical content inside the window returns the existing record', async (t) => {
  const harness = await createHarness({ dedupWindowSeconds: 60 });

  t.after(() => harness.dispose());

  const comment = harness.model('Comment');
  const payload = commentData({ comment: 'same content', insertedAt: new Date() });
  const first = await comment.add(payload);
  const second = await comment.add(payload);

  assert.equal(second.objectId, first.objectId);
  assert.equal(await comment.count({}), 1);

  // Different content still inserts
  const third = await comment.add({ ...payload, comment: 'other content' });

  assert.notEqual(third.objectId, first.objectId);
  assert.equal(await comment.count({}), 2);
});
