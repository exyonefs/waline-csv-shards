'use strict';

/**
 * Reliability: each case targets a failure mode that looks fine until concurrency
 * or throttling turns it into silent data loss or a confusing error.
 *
 *   1. Writes arriving during an in-flight commit (flush reusing the in-flight
 *      promise answers 200 without persisting).
 *   2. MAX_BATCH_SIZE not actually batching, plus shards outside the batch whose
 *      manifest is never rewritten.
 *   3. Concurrent counter increments ("local wins" silently drops the other +1).
 *   4. GitHub's secondary rate limit answering 403, which turns into a 500 unless
 *      it is retried.
 */

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { gitBlobSha } = require('../csv-depot/github-client');
const { createHarness, commentData } = require('./helpers');

test('writes that arrive during an in-flight commit are not lost by promise reuse', async (t) => {
  const harness = await createHarness();

  t.after(() => harness.dispose());

  const comment = harness.model('Comment');
  const queue = harness.depot.queue;

  await comment.add(commentData({ url: '/seed', comment: 'seed' }));
  await queue.flush();

  // Reproduce the race exactly: let the in-flight runFlush finish its own loop
  // and then pause, which is the real window between "runFlush did its last
  // isDirty check" and "the promise returns to the caller". The old
  // implementation handed that in-flight promise to the second request, so the
  // request ended with "200 but still only in memory" and the instance froze.
  const realRunFlush = queue.runFlush.bind(queue);
  let release = () => {};
  let markRunDone = () => {};
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const runDone = new Promise((resolve) => {
    markRunDone = resolve;
  });

  queue.runFlush = async () => {
    const result = await realRunFlush();

    // At this point runFlush has done its last isDirty check and will not look
    // back at pending
    markRunDone();
    await gate;

    return result;
  };

  await comment.add(commentData({ url: '/first', comment: 'first' }));
  const first = queue.flush(); // A's commit: in flight

  await runDone;
  await comment.add(commentData({ url: '/late', comment: 'late' })); // B's write lands inside the window
  const late = queue.flush(); // B's own flush, while the in-flight promise has not settled

  release();
  await Promise.all([first, late]);

  assert.equal(harness.depot.cache.pending.size, 0, 'nothing may stay unpersisted once both flushes return');

  const { model } = await harness.coldStart();
  const comments = (await model('Comment').select({}, { limit: 100 })).map((row) => row.comment).sort();

  assert.deepEqual(comments, ['first', 'late', 'seed'], 'a comment written during an in-flight commit must not be lost');
});

test('MAX_BATCH_SIZE really batches, and every table manifest matches its shards', async (t) => {
  const harness = await createHarness({ maxBatch: 1 });

  t.after(() => harness.dispose());

  const comment = harness.model('Comment');
  const counter = harness.model('Counter');

  await comment.add(commentData({ url: '/a', comment: 'a' }));
  await comment.add(commentData({ url: '/b', comment: 'b' }));
  await counter.add({ url: '/a', time: 1 });

  assert.equal(harness.depot.cache.pending.size, 3, 'three shards pending');

  await harness.depot.queue.flush();

  assert.equal(harness.depot.queue.stats.commits, 3, 'maxBatch=1 should produce three commits');

  // commitOnce used to commit shards outside the batch while only rewriting the
  // manifest of the table inside it, leaving "shard content disagrees with
  // manifest" behind in the repository
  for (const table of ['Comment', 'Counter']) {
    const manifestPath = harness.depot.manager.manifestPath(table);
    const entries = harness.depot.manager.parseManifest(harness.mock.readText(manifestPath) ?? '');

    assert.equal(entries.size > 0, true, `${table} manifest must not be empty`);

    for (const [path, entry] of entries) {
      const content = harness.mock.readText(path);

      assert.equal(content !== null, true, `${path} must really exist`);
      assert.equal(entry.sha, gitBlobSha(content), `manifest sha for ${path} must match its content`);
    }
  }

  const { model } = await harness.coldStart();

  assert.equal(await model('Comment').count({}), 2);
  assert.equal(await model('Counter').count({}), 1);
});

test('committing with only some shards loaded still writes every shard to the manifest', async (t) => {
  const harness = await createHarness();

  t.after(() => harness.dispose());

  const comment = harness.model('Comment');

  for (let index = 0; index < 4; index += 1) {
    await comment.add(commentData({ url: `/p${index}`, comment: `c-${index}` }));
  }
  await harness.depot.queue.flush();

  const before = harness.depot.manager.parseManifest(harness.mock.readText('data/comments/_manifest.csv'));

  assert.equal(before.size, 4);

  // After a cold start, query only /p0 (one family loaded), then write to /p3
  const { depot, model } = await harness.coldStart();

  await model('Comment').select({ url: '/p0' });
  await model('Comment').add(commentData({ url: '/p3', comment: 'late' }));
  await depot.queue.flush();
  depot.queue.stop();

  // The key point: the manifest is a projection of the authoritative listing, so
  // an unloaded shard must not disappear from it
  const after = harness.depot.manager.parseManifest(harness.mock.readText('data/comments/_manifest.csv'));

  assert.equal(after.size, 4, 'unloaded shards must stay in the manifest');

  for (const [path, entry] of after) {
    assert.equal(entry.sha, gitBlobSha(harness.mock.readText(path)), `${path} sha must match its content`);
  }

  const { model: fresh } = await harness.coldStart();

  assert.equal(await fresh('Comment').count({}), 5, 'every comment must still be there');
  assert.equal(await fresh('Comment').count({ url: '/p3' }), 2);
  assert.equal(await fresh('Comment').count({ url: '/p1' }), 1);
});

test('two instances incrementing a view counter concurrently: both +1 survive', async (t) => {
  const harness = await createHarness();

  t.after(() => harness.dispose());

  const counterA = harness.model('Counter');

  await counterA.add({ url: '/view', time: 1 });
  await harness.depot.queue.flush();

  const second = await harness.coldStart();
  const counterB = second.model('Counter');

  // Both A and B start from time=1 and add 1, which is how Waline counters work
  await counterA.update((row) => ({ time: (Number(row.time) || 0) + 1 }), { url: '/view' });
  await harness.depot.queue.flush();

  await counterB.update((row) => ({ time: (Number(row.time) || 0) + 1 }), { url: '/view' });
  await second.depot.queue.flush();
  second.depot.queue.stop();

  const { model } = await harness.coldStart();
  const [row] = await model('Counter').select({ url: '/view' });

  assert.equal(Number(row.time), 3, 'both +1 must land (local-wins merging drops one and leaves 2)');
});

test('secondary rate limit: 403 with rate limit wording must retry, not surface', async (t) => {
  const harness = await createHarness();

  t.after(() => harness.dispose());

  await harness.model('Comment').add(commentData({ comment: 'throttled' }));
  harness.mock.failNext('/git/blobs', 403, 1, 'API rate limit exceeded for user ID 1');

  await harness.depot.queue.flush();

  assert.equal(harness.depot.queue.stats.rollbacks, 0);
  assert.equal(harness.mock.headCommit !== null, true);

  const { model } = await harness.coldStart();

  assert.equal(await model('Comment').count({}), 1);
});

test('an authentication 403 must not be retried as if it were throttling', async (t) => {
  const harness = await createHarness();

  t.after(() => harness.dispose());

  await harness.model('Comment').add(commentData({ comment: 'forbidden' }));
  harness.mock.failNext('/git/blobs', 403, 5, 'Resource not accessible by integration');

  await assert.rejects(() => harness.depot.queue.flush(), /Resource not accessible/u);
});

test('a rate limit response carrying Retry-After is waited out', async (t) => {
  const harness = await createHarness();

  t.after(() => harness.dispose());

  await harness.model('Comment').add(commentData({ comment: 'retry-after' }));
  harness.mock.setResponseHeaders('/git/blobs', { 'retry-after': '1' });
  harness.mock.failNext('/git/blobs', 403, 1, 'You have exceeded a secondary rate limit');

  const started = Date.now();

  await harness.depot.queue.flush();

  assert.equal(Date.now() - started >= 1000, true, 'Retry-After must be honoured instead of retrying immediately');
  assert.equal(harness.depot.queue.stats.rollbacks, 0);

  const { model } = await harness.coldStart();

  assert.equal(await model('Comment').count({}), 1);
});
