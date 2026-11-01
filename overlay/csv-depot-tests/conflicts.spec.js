'use strict';

/**
 * Concurrency: batched commits, conflict detection and rollback.
 *
 * These cases are the main evidence for "no data loss under concurrency", so they
 * are all end to end: a second writer is really constructed, a ref update is
 * really made to fail, and the repository's final content is really inspected.
 */

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { gitBlobSha } = require('../csv-depot/github-client');
const { createHarness, commentData } = require('./helpers');

/**
 * Simulate "another instance" appending a row to the same shard.
 *
 * The shard and the manifest must both change, because our own writes commit
 * those two files atomically and the manifest is the only signal for "which
 * shard changed".
 */
function externalAppendFiles(mock, manager, table, shardPath, row) {
  const rows = manager.parseShard(mock.readText(shardPath) ?? '');

  rows.push(manager.normalizeRow(table, row, { defaults: true }));

  const content = manager.serializeShard(table, rows, manager.buildColumns(table, rows));
  const manifestPath = manager.manifestPath(table);
  const entries = manager.parseManifest(mock.readText(manifestPath) ?? '');

  entries.set(shardPath, manager.manifestEntry(table, shardPath, rows, gitBlobSha(content)));

  return [
    [shardPath, content],
    [manifestPath, manager.serializeManifest(entries)],
  ];
}

test('multiple writes in one request collapse into a single commit', async (t) => {
  const harness = await createHarness();

  t.after(() => harness.dispose());

  const comment = harness.model('Comment');
  const created = await comment.add(commentData({ url: '/a', comment: 'a1' }));

  await comment.add(commentData({ url: '/a', comment: 'a2' }));
  await comment.add(commentData({ url: '/b', comment: 'b1' }));
  await comment.update({ status: 'waiting' }, { objectId: created.objectId });
  await comment.delete({ url: '/b' });

  await harness.depot.queue.flush();

  assert.equal(harness.mock.commits.size, 1, 'one request should produce exactly one commit');
  assert.equal(harness.depot.queue.stats.commits, 1);
  assert.equal(await comment.count({ url: '/a' }), 2);
  assert.equal(await comment.count({ url: '/b' }), 0);
  assert.equal((await comment.select({ objectId: created.objectId }))[0].status, 'waiting');
});

test('write conflict: another instance edits the same shard, both sides survive the retry', async (t) => {
  const harness = await createHarness();

  t.after(() => harness.dispose());

  const comment = harness.model('Comment');

  await comment.add(commentData({ url: '/shared', comment: 'mine' }));
  await harness.depot.queue.flush();

  const shardPath = [...harness.mock.listFiles().keys()].find((path) => path.includes('/comments/'));

  await comment.add(commentData({ url: '/shared', comment: 'mine-2' }));

  // Insert "someone else's commit" before our ref update lands: head moves
  // forward, so the non-fast-forward update is rejected
  harness.mock.hooks.refPatch = (mock) => {
    mock.externalCommit(
      externalAppendFiles(mock, harness.depot.manager, 'Comment', shardPath, {
        objectId: 'remote-row',
        url: '/shared',
        comment: 'theirs',
        status: 'approved',
        insertedAt: new Date('2026-09-25T11:00:00.000Z'),
      }),
    );
  };

  await harness.depot.queue.flush();

  assert.equal(harness.depot.queue.stats.conflicts, 1, 'a real write conflict should happen');
  assert.equal(harness.depot.queue.stats.rollbacks, 0, 'a conflict must not trigger a rollback');

  const { model } = await harness.coldStart();
  const rows = await model('Comment').select({ url: '/shared' }, { limit: 100 });

  assert.deepEqual(
    rows.map((row) => row.comment).sort(),
    ['mine', 'mine-2', 'theirs'],
    'writes from both this and the remote instance must survive',
  );
});

test('two instances writing different shards concurrently: everything lands', async (t) => {
  const harness = await createHarness();

  t.after(() => harness.dispose());

  const second = await harness.coldStart();
  const first = harness.model('Comment');
  const other = second.model('Comment');

  await first.add(commentData({ url: '/instance-a', comment: 'from-a' }));
  await other.add(commentData({ url: '/instance-b', comment: 'from-b' }));

  // Committing at the same time: one lands first, the other has to catch up
  // through conflict retries
  await Promise.all([harness.depot.queue.flush(), second.depot.queue.flush()]);
  second.depot.queue.stop();

  const { model } = await harness.coldStart();
  const comment = model('Comment');

  assert.equal(await comment.count({}), 2);
  assert.equal(await comment.count({ url: '/instance-a' }), 1);
  assert.equal(await comment.count({ url: '/instance-b' }), 1);
});

test('retries exhausted: memory rolls back and the error surfaces, remote unchanged', async (t) => {
  const harness = await createHarness({ maxRetries: 2 });

  t.after(() => harness.dispose());

  const comment = harness.model('Comment');

  await comment.add(commentData({ comment: 'will-fail' }));
  // Keep the commit step failing, as if GitHub were down for a while
  harness.mock.failNext('/git/commits', 500, 50);

  await assert.rejects(() => harness.depot.queue.flush(), /分片提交失败/u);

  assert.equal(harness.depot.queue.stats.rollbacks, 1);
  assert.equal(harness.mock.headCommit, null, 'no commit should reach the remote');
  assert.equal(await comment.count({}), 0, 'memory must roll back, so the caller never thinks the write succeeded');
});

test('transient 5xx is retried inside the client and then succeeds', async (t) => {
  const harness = await createHarness();

  t.after(() => harness.dispose());

  const comment = harness.model('Comment');

  await comment.add(commentData({ comment: 'flaky' }));
  harness.mock.failNext('/git/blobs', 500, 1);

  await harness.depot.queue.flush();

  assert.equal(harness.depot.queue.stats.rollbacks, 0);
  assert.equal(harness.mock.headCommit !== null, true);

  const { model } = await harness.coldStart();

  assert.equal(await model('Comment').count({}), 1);
});
