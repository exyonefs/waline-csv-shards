'use strict';

/**
 * Memory budget guard: 100k comment row objects plus the global index must stay
 * well under 100MB.
 *
 * This is one of the scheme's core assumptions ("all data lives in memory, so
 * queries need no network"), so it is worth pinning down with a case that fails:
 * if the index structure ever balloons, this lights up before production OOMs.
 */

const assert = require('node:assert/strict');
const { test } = require('node:test');
const v8 = require('node:v8');
const vm = require('node:vm');

const { MockGitHub } = require('./mock-github');
const { loadConfig, createDepot, createModelFactory } = require('../csv-depot');
const { gitBlobSha } = require('../csv-depot/github-client');
const { ShardManager } = require('../csv-depot/shard-manager');

/**
 * Get hold of a real global.gc.
 *
 * `node --test` runs cases in child processes that do not inherit --expose-gc,
 * so the startup flag cannot be relied on; a v8 flag plus a new context provides
 * one. Without it the measurement includes uncollected garbage.
 */
const forceGc = (() => {
  try {
    v8.setFlagsFromString('--expose-gc');

    return vm.runInNewContext('gc');
  } catch {
    return null;
  }
})();

const TOTAL = 100000;
const PER_PAGE = 50;
const BUDGET_BYTES = 100 * 1024 * 1024;

const silentLogger = { debug() {}, info() {}, warn() {}, error() {} };

// 2000 posts x 50 comments: close to a real blog's comment distribution
function buildRows(total) {
  const rows = [];
  const pageCount = Math.ceil(total / PER_PAGE);

  for (let page = 0; page < pageCount && rows.length < total; page += 1) {
    for (let index = 0; index < PER_PAGE && rows.length < total; index += 1) {
      rows.push({
        objectId: `c${page}-${index}`,
        user_id: index % 7 === 0 ? `u${index}` : '',
        comment: `第 ${page} 篇文章的第 ${index} 条评论：这里放一段接近真实长度的中文内容，用于逼近真实的内存占用。`,
        insertedAt: new Date(Date.UTC(2026, 0, 1) + rows.length * 1000).toISOString(),
        ip: '203.0.113.1',
        link: 'https://example.com',
        mail: `user${index % 37}@example.com`,
        nick: `user-${index % 37}`,
        pid: '',
        rid: '',
        status: index % 20 === 0 ? 'waiting' : 'approved',
        ua: 'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36',
        url: `/posts/${page}`,
      });
    }
  }

  return rows;
}

test('100k comment rows plus indexes stay under 100MB', async (t) => {
  const mock = new MockGitHub();

  await mock.start();

  t.after(() => mock.stop());

  const manager = new ShardManager({ depotDir: 'data' });
  const byShard = new Map();

  for (const row of buildRows(TOTAL)) {
    const path = manager.shardPath('Comment', row.url);

    if (!byShard.has(path)) {
      byShard.set(path, []);
    }
    byShard.get(path).push(manager.normalizeRow('Comment', row));
  }

  const files = new Map();
  const manifest = new Map();

  for (const [path, shardRows] of byShard) {
    const content = manager.serializeShard('Comment', shardRows, manager.buildColumns('Comment', shardRows));

    files.set(path, content);
    manifest.set(path, manager.manifestEntry('Comment', path, shardRows, gitBlobSha(content)));
  }
  files.set(manager.manifestPath('Comment'), manager.serializeManifest(manifest));
  mock.externalCommit(files);

  const depot = createDepot(
    {
      ...loadConfig({}),
      token: 'memory-test',
      repo: 'owner/repo',
      branch: 'main',
      apiBase: mock.apiBase,
      cacheTtl: 3600 * 1000,
    },
    { logger: silentLogger },
  );

  t.after(() => depot.queue.stop());

  // Read memory before shards load: the delta is the real cost of row objects
  // and indexes. GC must be forced first, since loading produces a lot of
  // one-off base64/JSON intermediate strings and without collecting them the
  // measurement is a garbage peak rather than resident usage.
  //
  // The measured task has to be the one that loads everything. refresh() alone
  // is not enough: on-demand loading means a cold cache downloads nothing, so
  // measuring refresh alone measures nothing but manifest parsing and the guard
  // would pass no matter how large the indexes grew.
  const used = await measureRetained(async () => {
    await depot.cache.refresh({ force: true });
    await createModelFactory(depot)('Comment').count({});
  });

  assert.equal(await createModelFactory(depot)('Comment').count({}), TOTAL, 'data must load completely');

  const mb = (used / 1024 / 1024).toFixed(1);

  process.stdout.write(
    `\n[内存] ${TOTAL.toLocaleString('en-US')} 条评论 / ${byShard.size} 个分片：` +
      `行对象 + 索引常驻约 ${mb} MB（预算 ${BUDGET_BYTES / 1024 / 1024} MB）\n`,
  );

  assert.ok(used < BUDGET_BYTES, `索引内存占用 ${mb} MB 超出预算`);
});

// Heap memory actually retained once the task finishes (GC, then heapUsed).
async function measureRetained(task) {
  forceGc?.();
  const before = process.memoryUsage().heapUsed;

  await task();

  forceGc?.();
  const after = process.memoryUsage().heapUsed;

  return after - before;
}
