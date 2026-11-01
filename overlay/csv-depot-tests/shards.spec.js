'use strict';

/**
 * Sharding: routing, splitting, merging, manifest, incremental loading and the
 * large-file fallback.
 */

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { createHarness, commentData, userData, apiCallsMatching } = require('./helpers');

const shardFilesOf = (mock, table) =>
  [...mock.listFiles().keys()].filter(
    (path) => path.startsWith(`data/${table}/`) && path.endsWith('.csv') && !path.endsWith('_manifest.csv'),
  );

// Shard content downloads the mock served (manifests excluded).
const shardDownloadsOf = (mock, table) =>
  mock.requestLog.filter(
    (entry) => entry.path.includes(`/contents/data/${table}/`) && !entry.path.includes('_manifest.csv'),
  );

test('shard routing: one shard per url, distinct urls land apart', async (t) => {
  const harness = await createHarness();

  t.after(() => harness.dispose());

  const comment = harness.model('Comment');

  for (let index = 0; index < 3; index += 1) {
    await comment.add(commentData({ url: '/same-post', comment: `same-${index}` }));
  }
  await comment.add(commentData({ url: '/other-post', comment: 'other' }));
  await harness.depot.queue.flush();

  const files = shardFilesOf(harness.mock, 'comments');

  assert.equal(files.length, 2, '3 comments on one post + 1 elsewhere should produce 2 shards');
  // Every shard carries a header whose first column is objectId
  for (const path of files) {
    assert.match(harness.mock.readText(path).split('\n')[0], /^objectId,/u);
  }

  // The manifest records row counts, SHAs and key bounds
  const manifest = harness.mock.readText(harness.depot.manager.manifestPath('Comment'));
  const lines = manifest.trim().split('\n');

  assert.equal(lines[0], 'shard_path,row_count,sha,updated_at,min_key,max_key');
  assert.equal(lines.length, 3);

  const rows = lines.slice(1).map((line) => line.split(','));

  assert.deepEqual(rows.map((row) => row[1]).sort(), ['1', '3']);
  for (const row of rows) {
    assert.match(row[2], /^[0-9a-f]{40}$/u, 'manifest must record the real blob SHA');
    assert.equal(row[4], row[5], 'min_key and max_key match for a single-url shard');
  }
});

test('Users shard by the first two chars of objectId, file name equals directory', async (t) => {
  const harness = await createHarness();

  t.after(() => harness.dispose());

  const users = harness.model('Users');

  for (let index = 0; index < 30; index += 1) {
    await users.add(userData({ email: `u${index}@x.com` }));
  }
  await harness.depot.queue.flush();

  const files = shardFilesOf(harness.mock, 'users');

  assert.ok(files.length > 1);
  for (const path of files) {
    const matched = /^data\/users\/(?<dir>[^/]+)\/(?<name>[^/]+?)(?:-\d+)?\.csv$/u.exec(path);

    assert.ok(matched, `not a valid shard name: ${path}`);
    assert.equal(matched.groups.dir, matched.groups.name);
  }
  assert.equal(await users.count(), 30);
});

test('shard splitting: past SHARD_MAX_ROWS a new shard appears, data still reads back', async (t) => {
  const harness = await createHarness({ shardMaxRows: 5 });

  t.after(() => harness.dispose());

  const comment = harness.model('Comment');

  for (let index = 0; index < 12; index += 1) {
    await comment.add(commentData({ url: '/hot-post', comment: `c-${index}` }));
  }
  await harness.depot.queue.flush();

  const files = shardFilesOf(harness.mock, 'comments');

  assert.equal(files.length, 3, '12 comments with a 5-row cap should split into 3 shards');
  for (const path of files) {
    const rowCount = harness.mock.readText(path).trim().split('\n').length - 1;

    assert.ok(rowCount <= 5, `shard ${path} has ${rowCount} rows, above the cap`);
  }

  // After splitting, one url's comments are spread over several shards, but
  // queries must still return them all
  assert.equal(await comment.count({ url: '/hot-post' }), 12);

  const all = await comment.select({ url: '/hot-post' }, { limit: 100 });

  assert.equal(all.length, 12);
  assert.equal(new Set(all.map((row) => row.objectId)).size, 12);

  const { model } = await harness.coldStart();

  assert.equal(await model('Comment').count({ url: '/hot-post' }), 12);
});

test('shard merging: once rows fall back under the cap the family compresses', async (t) => {
  const harness = await createHarness({ shardMaxRows: 5 });

  t.after(() => harness.dispose());

  const comment = harness.model('Comment');
  const ids = [];

  for (let index = 0; index < 12; index += 1) {
    const created = await comment.add(commentData({ url: '/hot-post', comment: `c-${index}` }));

    ids.push(created.objectId);
  }
  await harness.depot.queue.flush();

  assert.equal(shardFilesOf(harness.mock, 'comments').length, 3);

  // Keep only 4 (below the cap); compaction should fold 3 shards into 1
  await comment.delete({ objectId: ['IN', ids.slice(0, 8)] });

  const compacted = await harness.depot.cache.compact('Comment');

  await harness.depot.queue.flush();

  assert.equal(compacted.merged, 1);
  assert.equal(shardFilesOf(harness.mock, 'comments').length, 1);
  assert.equal(await comment.count({ url: '/hot-post' }), 4);

  const { model } = await harness.coldStart();

  assert.equal(await model('Comment').count({ url: '/hot-post' }), 4);
  assert.equal(await model('Comment').count({ objectId: ['IN', ids.slice(0, 8)] }), 0);
});

test('refresh is incremental: unchanged shards are never re-downloaded', async (t) => {
  const harness = await createHarness();

  t.after(() => harness.dispose());

  const comment = harness.model('Comment');

  // Both posts written, so both families count as loaded and "incremental" means
  // something below
  await comment.add(commentData({ url: '/a', comment: 'a' }));
  await comment.add(commentData({ url: '/b', comment: 'b' }));
  await harness.depot.queue.flush();

  // The commit just happened, so locally computed blob SHAs should match the
  // remote and a forced refresh should download no shard at all
  harness.mock.requestLog.length = 0;
  await harness.depot.cache.refresh({ force: true });

  assert.equal(harness.mock.requestLog.length, 3, 'one request per table manifest');
  assert.equal(shardDownloadsOf(harness.mock, 'comments').length, 0, 'no shard needed re-downloading');

  // Another "instance" appends to /b; only that shard should be re-downloaded
  const second = await harness.coldStart();

  await second.model('Comment').add(commentData({ url: '/b', comment: 'b2' }));
  await second.depot.queue.flush();
  second.depot.queue.stop();

  harness.mock.requestLog.length = 0;
  await harness.depot.cache.refresh({ force: true });

  assert.equal(shardDownloadsOf(harness.mock, 'comments').length, 1, 'only the changed shard should re-download');
  assert.equal(await comment.count({}), 3);
});

test('on-demand loading: querying one post downloads no other post', async (t) => {
  const harness = await createHarness();

  t.after(() => harness.dispose());

  const comment = harness.model('Comment');

  // 5 posts x 3 comments = 5 shard families
  for (let index = 0; index < 5; index += 1) {
    for (let inner = 0; inner < 3; inner += 1) {
      await comment.add(commentData({ url: `/p${index}`, comment: `c-${index}-${inner}` }));
    }
  }
  await harness.depot.queue.flush();

  // Cold start, querying only /p2
  const { depot, model } = await harness.coldStart();

  harness.mock.requestLog.length = 0;

  const rows = await model('Comment').select({ url: '/p2' }, { limit: 100 });

  assert.equal(rows.length, 3, 'a per-post query must be complete');
  assert.equal(shardDownloadsOf(harness.mock, 'comments').length, 1, 'only the matching family should download');
  assert.equal([...depot.cache.tables.Comment.shards.keys()].length <= 2, true, 'unqueried shards stay out of memory');

  // A global view (no url condition) is what pulls the whole table in
  assert.equal(await model('Comment').count({}), 15);
  assert.equal(depot.cache.tables.Comment.allLoaded, true);
});

test('after hand-editing the repository, rebuild reconciles and fixes the manifest', async (t) => {
  const harness = await createHarness();

  t.after(() => harness.dispose());

  const comment = harness.model('Comment');

  await comment.add(commentData({ url: '/a', comment: 'original' }));
  await harness.depot.queue.flush();

  const manager = harness.depot.manager;
  const shardPath = shardFilesOf(harness.mock, 'comments')[0];
  const rows = manager.parseShard(harness.mock.readText(shardPath));

  rows[0].comment = 'edited-by-hand';
  // Edit the shard only, leaving the manifest alone, which is what editing on
  // github.com looks like
  harness.mock.externalCommit([[shardPath, manager.serializeShard('Comment', rows, manager.buildColumns('Comment', rows))]]);

  assert.equal((await comment.select({ url: '/a' }))[0].comment, 'original', 'a plain refresh does not read unchanged shards');

  const rebuilt = await harness.depot.cache.syncFromTree();

  await harness.depot.queue.flush();

  assert.equal(rebuilt.changed, 1);
  assert.equal((await comment.select({ url: '/a' }))[0].comment, 'edited-by-hand');

  const manifest = manager.parseManifest(harness.mock.readText(manager.manifestPath('Comment')));

  assert.equal(manifest.get(shardPath).sha, harness.mock.listFiles().get(shardPath).sha, 'manifest should be corrected to the real SHA');

  const { model } = await harness.coldStart();

  assert.equal((await model('Comment').select({ url: '/a' }))[0].comment, 'edited-by-hand');
});

test('shards over 1MB fall back to the Blob API without losing data', async (t) => {
  const harness = await createHarness({}, { contentsMaxBytes: 512 });

  t.after(() => harness.dispose());

  const comment = harness.model('Comment');
  const bigComment = 'x'.repeat(4096);

  await comment.add(commentData({ comment: bigComment }));
  await harness.depot.queue.flush();

  const shardPath = shardFilesOf(harness.mock, 'comments')[0];

  assert.ok(harness.mock.readText(shardPath).length > 512, 'the shard should exceed the Contents API inline cap');

  harness.mock.requestLog.length = 0;

  const { model } = await harness.coldStart();
  const [reloaded] = await model('Comment').select({ url: '/post-1' });

  assert.equal(reloaded.comment, bigComment);
  assert.equal(harness.mock.requestLog.some((entry) => entry.path.includes('/git/blobs/')), true, 'should use the Blob API');
});
