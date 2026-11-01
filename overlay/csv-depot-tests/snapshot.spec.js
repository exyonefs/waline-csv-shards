'use strict';

/**
 * Snapshots: create, list, retention policy and restore.
 */

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { createHarness, commentData } = require('./helpers');

const blobUploads = (mock) =>
  mock.requestLog.filter((entry) => entry.method === 'POST' && entry.path.endsWith('/git/blobs')).length;

// Walk parents from head to get the reachable history depth (the mock never
// deletes history objects).
const historyDepth = (mock) => {
  let depth = 0;
  let sha = mock.headCommit;

  while (sha) {
    depth += 1;
    sha = mock.commits.get(sha)?.parents?.[0] ?? null;
  }

  return depth;
};

test('a snapshot is a reference manifest: only the manifest uploads, data uploads nothing', async (t) => {
  const harness = await createHarness();

  t.after(() => harness.dispose());

  await harness.model('Comment').add(commentData({ url: '/a', comment: 'a' }));
  await harness.depot.queue.flush();

  const before = harness.mock.listFiles();
  const headBefore = harness.mock.headCommit;

  harness.mock.requestLog.length = 0;

  const created = await harness.depot.snapshot.createSnapshot('2026-09-24');

  assert.equal(created.skipped, false);
  assert.equal(created.files, before.size);
  assert.equal(blobUploads(harness.mock), 1, 'only the snapshot manifest blob should upload');

  const manifestPath = 'data/_snapshots/2026-09-24.csv';
  const listed = await harness.depot.snapshot.snapshotFiles('2026-09-24');

  assert.deepEqual([...listed.keys()].sort(), [...before.keys()].sort());
  for (const [path, meta] of before) {
    assert.equal(listed.get(path)?.sha, meta.sha, `manifest must reference the original blob for ${path}`);
  }

  // Exactly one extra file in the repository: the count no longer scales with
  // shards x retention days
  assert.equal(harness.mock.listFiles().size, before.size + 1);
  assert.notEqual(harness.mock.headCommit, headBefore);
  assert.deepEqual(await harness.depot.snapshot.listSnapshots(), ['2026-09-24']);
  assert.equal(harness.mock.readText(manifestPath).split('\n')[0], 'path,sha');
});

test('legacy directory snapshots can still be restored (backwards compatible)', async (t) => {
  const harness = await createHarness();

  t.after(() => harness.dispose());

  const comment = harness.model('Comment');

  await comment.add(commentData({ url: '/legacy', comment: 'legacy-me' }));
  await harness.depot.queue.flush();

  // Build a "legacy format" snapshot by hand: a copy under _snapshots/<date>/
  const files = harness.mock.listFiles();
  const legacy = new Map();

  for (const [path, meta] of files) {
    legacy.set(`data/_snapshots/2026-01-01/${path}`, harness.mock.blobs.get(meta.sha));
  }
  harness.mock.externalCommit(legacy);

  assert.deepEqual(await harness.depot.snapshot.listSnapshots(), ['2026-01-01']);

  // Wipe current data, then restore from the legacy snapshot
  await comment.add(commentData({ url: '/newer', comment: 'newer-me' }));
  await harness.depot.queue.flush();
  assert.equal(await comment.count({}), 2);

  const restored = await harness.depot.snapshot.restore('2026-01-01');

  assert.equal(restored.restored > 0, true);
  assert.equal(await comment.count({}), 1, 'the legacy snapshot should restore fully, overwriting newer writes');
  assert.equal(await comment.count({ url: '/legacy' }), 1);
});

test('reset repository: history commits are dropped, current data is kept', async (t) => {
  const harness = await createHarness();

  t.after(() => harness.dispose());

  const comment = harness.model('Comment');

  await comment.add(commentData({ url: '/a', comment: 'a' }));
  await harness.depot.queue.flush();
  await harness.depot.snapshot.createSnapshot('2026-09-24');

  // Generate history commits (and fill the snapshot tree along the way)
  for (let index = 0; index < 5; index += 1) {
    await comment.add(commentData({ url: '/a', comment: `noise-${index}` }));
    await harness.depot.queue.flush();
  }

  assert.equal(historyDepth(harness.mock) > 5, true);

  const result = await harness.depot.snapshot.resetRepository();

  assert.equal(result.reset, true);

  // After the reset: reachable history is a single commit with no parents
  assert.equal(historyDepth(harness.mock), 1, 'history commits should be discarded wholesale');
  assert.deepEqual(harness.mock.commits.get(harness.mock.headCommit).parents, [], 'the reset commit has no parents');

  // The snapshot tree goes with it, but the data itself is intact
  assert.deepEqual(await harness.depot.snapshot.listSnapshots(), []);
  assert.equal(await comment.count({}), 6, 'a reset must not lose data');

  const { model } = await harness.coldStart();

  assert.equal(await model('Comment').count({}), 6);
  assert.equal(await model('Comment').count({ url: '/a' }), 6);
});

test('reset repository: keepSnapshots retains snapshots', async (t) => {
  const harness = await createHarness();

  t.after(() => harness.dispose());

  await harness.model('Comment').add(commentData({ url: '/a', comment: 'a' }));
  await harness.depot.queue.flush();
  await harness.depot.snapshot.createSnapshot('2026-09-24');

  await harness.depot.snapshot.resetRepository({ keepSnapshots: true });

  assert.deepEqual(await harness.depot.snapshot.listSnapshots(), ['2026-09-24']);
  assert.equal(historyDepth(harness.mock), 1);
});

test('an invalid restore date is rejected outright', async (t) => {
  const harness = await createHarness();

  t.after(() => harness.dispose());

  await assert.rejects(() => harness.depot.snapshot.restore('../../etc'), /YYYY-MM-DD/u);
  await assert.rejects(() => harness.depot.snapshot.restore(''), /YYYY-MM-DD/u);
});

test('an empty repository produces no empty snapshot', async (t) => {
  const harness = await createHarness();

  t.after(() => harness.dispose());

  const created = await harness.depot.snapshot.createSnapshot('2026-09-24');

  assert.equal(created.skipped, true);
  assert.equal(harness.mock.headCommit, null);
});

test('restore: return the data directory to the snapshot point and remove extra files', async (t) => {
  const harness = await createHarness();

  t.after(() => harness.dispose());

  const comment = harness.model('Comment');

  await comment.add(commentData({ url: '/keep', comment: 'keep-me' }));
  await harness.depot.queue.flush();
  await harness.depot.snapshot.createSnapshot('2026-09-24');

  // Written after the snapshot: it must disappear on restore
  await comment.add(commentData({ url: '/lost', comment: 'lost-me' }));
  await harness.depot.queue.flush();

  assert.equal(await comment.count({}), 2);

  const restored = await harness.depot.snapshot.restore('2026-09-24');

  assert.equal(restored.restored > 0, true);
  assert.equal(await comment.count({}), 1, 'comments written after the snapshot must disappear');
  assert.equal(await comment.count({ url: '/keep' }), 1);
  assert.equal(await comment.count({ url: '/lost' }), 0);

  // Confirm once more from a cold start that the repository really holds the
  // snapshot state
  const { model } = await harness.coldStart();

  assert.equal(await model('Comment').count({}), 1);
  assert.equal(await model('Comment').count({ url: '/keep' }), 1);
});

test('retention policy: only the most recent N days are kept', async (t) => {
  const harness = await createHarness({ snapshotKeepDays: 2 });

  t.after(() => harness.dispose());

  await harness.model('Comment').add(commentData({ url: '/a', comment: 'a' }));
  await harness.depot.queue.flush();

  for (const date of ['2026-09-23', '2026-09-24', '2026-09-25']) {
    await harness.depot.snapshot.createSnapshot(date);
  }

  assert.deepEqual(await harness.depot.snapshot.listSnapshots(), ['2026-09-25', '2026-09-24', '2026-09-23']);

  const pruned = await harness.depot.snapshot.pruneSnapshots();

  assert.deepEqual(pruned.removed, ['2026-09-23']);
  assert.deepEqual(await harness.depot.snapshot.listSnapshots(), ['2026-09-25', '2026-09-24']);

  // Data shards themselves must not be caught by pruning
  assert.equal(await harness.model('Comment').count({}), 1);
});

test('daily snapshot: fires at most once per day after the hour', async (t) => {
  const harness = await createHarness({ snapshotHour: 3 });

  t.after(() => harness.dispose());

  await harness.model('Comment').add(commentData({ url: '/a', comment: 'a' }));
  await harness.depot.queue.flush();

  const early = await harness.depot.snapshot.maybeRunDaily(new Date('2026-09-25T01:00:00'));

  assert.equal(early.skipped, true);
  assert.deepEqual(await harness.depot.snapshot.listSnapshots(), []);

  const first = await harness.depot.snapshot.maybeRunDaily(new Date('2026-09-25T04:00:00'));

  assert.equal(first.skipped, false);
  assert.deepEqual(await harness.depot.snapshot.listSnapshots(), ['2026-09-25']);

  const second = await harness.depot.snapshot.maybeRunDaily(new Date('2026-09-25T22:00:00'));

  assert.equal(second.skipped, true);

  // The next day fires again
  const nextDay = await harness.depot.snapshot.maybeRunDaily(new Date('2026-09-26T04:00:00'));

  assert.equal(nextDay.skipped, false);
  assert.deepEqual(await harness.depot.snapshot.listSnapshots(), ['2026-09-26', '2026-09-25']);
});

test('SNAPSHOT_KEEP_DAYS=0 disables snapshots entirely', async (t) => {
  const harness = await createHarness({ snapshotKeepDays: 0 });

  t.after(() => harness.dispose());

  assert.equal((await harness.depot.snapshot.maybeRunDaily(new Date('2026-09-25T04:00:00'))).skipped, true);
  assert.deepEqual(await harness.depot.snapshot.listSnapshots(), []);
});
