'use strict';

/**
 * Regression tests for "misplaced shards", which a page rename leaves behind.
 *
 * The scenario comes from production data, where /links/ appeared in both
 *   comments/fc/fca4.csv  (where sha1('/links/') says it belongs)
 *   comments/1b/1bd2.csv  (the old shard for sha1('/friends/'), url rewritten)
 * Both rows carry min_key/max_key = /links/, yet none of the three comments in
 * 1bd2 showed up on the page.
 */

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { createHarness, commentData } = require('./helpers');

const shardFilesOf = (mock, table) =>
  [...mock.listFiles().keys()].filter(
    (path) => path.startsWith(`data/${table}/`) && path.endsWith('.csv') && !path.endsWith('_manifest.csv'),
  );

/**
 * Simulate "someone edited the CSV on github.com": rewrite the whole file's url
 * column to a new address, leave the file in place, and update the manifest's
 * min_key/max_key to the new values — exactly what the production data looks like.
 */
function migratePageExternally(mock, manager, table, fromPath, toUrl) {
  const rows = manager.parseShard(mock.readText(fromPath)).map((row) => ({ ...row, url: toUrl }));
  const content = manager.serializeShard(table, rows, manager.buildColumns(table, rows));
  const manifestPath = manager.manifestPath(table);
  const entries = manager.parseManifest(mock.readText(manifestPath));

  entries.set(fromPath, manager.manifestEntry(table, fromPath, rows, mock.listFiles().get(fromPath).sha));

  return mock.externalCommit([
    [fromPath, content],
    [manifestPath, manager.serializeManifest(entries)],
  ]);
}

test('页面迁移后，旧分片里的评论依然能读到，并会自动搬回规范分片', async (t) => {
  const harness = await createHarness();

  t.after(() => harness.dispose());

  const comment = harness.model('Comment');

  for (let index = 0; index < 3; index += 1) {
    await comment.add(commentData({ url: '/friends/', comment: `friend-${index}` }));
  }
  await harness.depot.queue.flush();

  const manager = harness.depot.manager;
  const orphanPath = manager.shardPath('Comment', '/friends/');
  const canonicalPath = manager.shardPath('Comment', '/links/');
  const canonicalPrefix = manager.shardPrefix('Comment', '/links/');

  assert.notEqual(orphanPath, canonicalPath, '/friends/ 与 /links/ 必须落在不同分片');

  migratePageExternally(harness.mock, manager, 'Comment', orphanPath, '/links/');

  // Registration has to be right: a misplaced shard may only land in aliases (a
  // read fallback), never in families (write routing), or new comments would be
  // written into the orphan file and the misplacement would reproduce itself
  const probe = await harness.coldStart();

  await probe.depot.cache.syncTable(
    'Comment',
    manager.parseManifest(harness.mock.readText(manager.manifestPath('Comment'))),
    {},
  );

  const probeState = probe.depot.cache.tables.Comment;

  assert.deepEqual([...(probeState.aliases.get(canonicalPrefix) ?? [])], [orphanPath]);
  assert.equal(probeState.families.get(canonicalPrefix), undefined, '孤儿分片不应被当成 /links/ 的本族分片');
  assert.deepEqual(
    [...probe.depot.cache.familyRowCounts('Comment', canonicalPrefix)],
    [],
    '写入落点里不能出现孤儿分片',
  );

  // Cold start reading the new page: all 3 pre-migration comments must be there
  const { depot, model } = await harness.coldStart();
  const rows = await model('Comment').select({ url: '/links/' }, { limit: 100 });

  assert.equal(rows.length, 3, '迁站前的旧评论必须仍然可读');
  assert.deepEqual([...new Set(rows.map((row) => row.comment))].sort(), ['friend-0', 'friend-1', 'friend-2']);
  assert.equal(await model('Comment').count({}), 3, '搬迁过程中不能产生重复');

  // The heal has to reach the repository: the old file disappears and the data
  // ends up in its canonical shard
  await depot.queue.flush();

  const files = shardFilesOf(harness.mock, 'comments');

  assert.deepEqual(files, [canonicalPath], '错位分片应被合并进规范分片');
  assert.equal(
    manager.parseShard(harness.mock.readText(canonicalPath)).length,
    3,
    '规范分片应持有全部 3 条评论',
  );

  const { model: reloaded } = await harness.coldStart();

  assert.equal((await reloaded('Comment').select({ url: '/links/' }, { limit: 100 })).length, 3);
  assert.equal((await reloaded('Comment').select({ url: '/friends/' }, { limit: 100 })).length, 0);
  const finalState = depot.cache.tables.Comment;

  assert.equal(finalState.aliases.size, 0, '自愈后不应再有待搬迁的分片');
});

test('自愈只付一次代价：数据归位后不会再触发全表搬迁', async (t) => {
  const harness = await createHarness();

  t.after(() => harness.dispose());

  const comment = harness.model('Comment');

  for (let index = 0; index < 4; index += 1) {
    await comment.add(commentData({ url: `/p${index}`, comment: `keep-${index}` }));
  }
  await harness.depot.queue.flush();

  const manager = harness.depot.manager;

  migratePageExternally(harness.mock, manager, 'Comment', manager.shardPath('Comment', '/p0'), '/moved/');

  const { depot, model } = await harness.coldStart();

  await model('Comment').select({ url: '/moved/' }, { limit: 100 });

  // The data is already in /moved/'s canonical family in memory, but not committed
  assert.equal(depot.cache.tables.Comment.aliases.size, 0, '搬迁后 aliases 必须清空');
  assert.ok(depot.cache.isDirty(), '搬迁必须进待提交队列，否则下次冷启动又要重来');

  await depot.queue.flush();

  harness.mock.requestLog.length = 0;
  await depot.cache.refresh({ force: true });

  const downloads = harness.mock.requestLog.filter(
    (entry) => entry.path.includes('/contents/data/comments/') && !entry.path.includes('_manifest.csv'),
  );

  assert.equal(downloads.length, 0, '已归位的数据不应再触发任何分片下载');
  assert.equal(await comment.count({}), 4, '自愈不能造成重复或丢失');
});

test('混合 shard key 的错位行会被逐行搬回各自的族（manifest 无法提示的情况）', async (t) => {
  const harness = await createHarness();

  t.after(() => harness.dispose());

  const comment = harness.model('Comment');

  await comment.add(commentData({ url: '/a', comment: 'a1' }));
  await harness.depot.queue.flush();

  const manager = harness.depot.manager;
  const hostPath = manager.shardPath('Comment', '/a');
  const rows = manager.parseShard(harness.mock.readText(hostPath));

  rows.push(
    manager.normalizeRow('Comment', { ...commentData({ url: '/b', comment: 'b1' }), objectId: 'mixedrow01' }),
  );

  const content = manager.serializeShard('Comment', rows, manager.buildColumns('Comment', rows));

  // The manifest must be updated too, or an incremental refresh will not even
  // download this file; it can only show min_key=/a, max_key=/b, which is not
  // enough for metadata to conclude anything about mixed content
  const manifestPath = manager.manifestPath('Comment');
  const entries = manager.parseManifest(harness.mock.readText(manifestPath));

  entries.set(hostPath, {
    path: hostPath,
    rowCount: rows.length,
    sha: null,
    updatedAt: null,
    minKey: '/a',
    maxKey: '/b',
  });
  harness.mock.externalCommit([
    [hostPath, content],
    [manifestPath, manager.serializeManifest(entries)],
  ]);

  await harness.depot.cache.refresh({ force: true });

  assert.equal(harness.depot.cache.tables.Comment.shards.get(hostPath).rows.length, 2);

  assert.equal(
    harness.depot.cache.tables.Comment.aliases.size,
    0,
    'min_key ≠ max_key 时不能凭元数据判定错位',
  );

  const repaired = await harness.depot.cache.repairMisplaced('Comment');

  await harness.depot.queue.flush();

  assert.equal(repaired.relocated, 1);
  assert.equal((await comment.select({ url: '/b' }, { limit: 10 })).length, 1, '/b 的行应搬回它自己的族');
  assert.equal((await comment.select({ url: '/a' }, { limit: 10 })).length, 1);
  assert.deepEqual(shardFilesOf(harness.mock, 'comments').sort(), [
    manager.shardPath('Comment', '/a'),
    manager.shardPath('Comment', '/b'),
  ].sort());

  const { model } = await harness.coldStart();

  assert.equal((await model('Comment').select({ url: '/b' }, { limit: 10 })).length, 1);
  assert.equal(await model('Comment').count({}), 2, '搬迁不能造成重复');
});

test('运维接口 compact / rebuild 也能把错位行搬回各自的族', async (t) => {
  const harness = await createHarness();

  t.after(() => harness.dispose());

  const comment = harness.model('Comment');

  await comment.add(commentData({ url: '/old-page/', comment: 'old-0' }));
  await harness.depot.queue.flush();

  const manager = harness.depot.manager;
  const hostPath = manager.shardPath('Comment', '/old-page/');
  const rows = manager.parseShard(harness.mock.readText(hostPath));

  for (let index = 0; index < 2; index += 1) {
    rows.push(
      manager.normalizeRow('Comment', {
        ...commentData({ url: '/new-page/', comment: `new-${index}` }),
        objectId: `mixed-compact-${index}`,
      }),
    );
  }

  const manifestPath = manager.manifestPath('Comment');
  const entries = manager.parseManifest(harness.mock.readText(manifestPath));

  entries.set(hostPath, {
    path: hostPath,
    rowCount: rows.length,
    sha: null,
    updatedAt: null,
    minKey: '/new-page/',
    maxKey: '/old-page/',
  });
  harness.mock.externalCommit([
    [hostPath, manager.serializeShard('Comment', rows, manager.buildColumns('Comment', rows))],
    [manifestPath, manager.serializeManifest(entries)],
  ]);

  // One file holding two keys: metadata cannot conclude anything at refresh time,
  // so only whole-table operations like compact / rebuild check row by row and
  // move the misplaced rows back
  const { depot, model } = await harness.coldStart();

  await depot.cache.refresh();

  assert.equal((await model('Comment').select({ url: '/new-page/' }, { limit: 10 })).length, 0, '修复前读不到');

  const compacted = await depot.cache.compact('Comment');

  await depot.queue.flush();

  assert.equal(compacted.relocated, 2);
  assert.equal((await model('Comment').select({ url: '/new-page/' }, { limit: 10 })).length, 2);
  assert.equal((await model('Comment').select({ url: '/old-page/' }, { limit: 10 })).length, 1);
  assert.deepEqual(shardFilesOf(harness.mock, 'comments').sort(), [
    manager.shardPath('Comment', '/new-page/'),
    manager.shardPath('Comment', '/old-page/'),
  ].sort());

  // After the move, a new comment joins its family's existing shard instead of
  // creating a fresh orphan
  await model('Comment').add(commentData({ url: '/new-page/', comment: 'fresh' }));
  await depot.queue.flush();

  assert.equal((await model('Comment').count({})), 4);
  assert.deepEqual(shardFilesOf(harness.mock, 'comments').sort(), [
    manager.shardPath('Comment', '/new-page/'),
    manager.shardPath('Comment', '/old-page/'),
  ].sort());
});
