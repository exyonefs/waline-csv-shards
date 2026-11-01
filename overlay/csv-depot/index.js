'use strict';

/**
 * Application entry point: injects sharded CSV storage into Waline and exposes
 * ops endpoints.
 *
 * Injection uses Waline's official extension point, Waline({ model: customModel }),
 * so no upper-layer business logic changes. Note that Waline calls
 * think.config('customModel', model) and then getModel(name) *calls* the result
 * rather than constructing it, which is why this exports factory functions; the
 * documented `model: class CustomModel {}` form fails with "Class constructor
 * cannot be invoked without 'new'".
 *
 * The plugin middleware does two things: await one flush() before the response,
 * so "200 OK" means "already persisted" (a serverless instance is frozen after
 * responding, so a timer alone would lose data); and serve /csv-depot/* ops
 * endpoints to administrators only.
 */

const { createHmac, timingSafeEqual } = require('node:crypto');

const { GithubClient } = require('./github-client');
const { ShardManager } = require('./shard-manager');
const { CsvShardCache, TABLES } = require('./csv-shard-cache');
const { ShardWriteQueue } = require('./shard-write-queue');
const { CsvModel } = require('./csv-model');
const { SnapshotManager } = require('./snapshot');

// Read an integer environment variable; an empty string counts as unset.
const intEnv = (name, fallback, env = process.env) => {
  const raw = env[name];

  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return fallback;
  }
  const value = Number.parseInt(String(raw), 10);

  if (Number.isNaN(value)) {
    throw new Error(`环境变量 ${name} 必须是整数，当前值：${raw}`);
  }

  return value;
};

function loadConfig(env = process.env) {
  return {
    token: env.GITHUB_TOKEN,
    repo: env.GITHUB_REPO,
    branch: env.GITHUB_BRANCH || 'main',
    // Tests and self-hosted proxies only; production talks to api.github.com
    apiBase: env.GITHUB_API_BASE || 'https://api.github.com',

    depotDir: env.CSV_DEPOT_DIR || 'data',
    shardMaxRows: intEnv('SHARD_MAX_ROWS', 2000, env),
    hashLen: intEnv('SHARD_HASH_LEN', 2, env),

    flushInterval: intEnv('FLUSH_INTERVAL', 30000, env),
    maxBatch: intEnv('MAX_BATCH_SIZE', 50, env),
    maxRetries: intEnv('MAX_RETRIES', 3, env),

    cacheTtl: intEnv('CSV_CACHE_TTL', 60000, env),
    dedupWindowSeconds: intEnv('DEDUP_WINDOW_SECONDS', 60, env),

    snapshotKeepDays: intEnv('SNAPSHOT_KEEP_DAYS', 30, env),
    snapshotHour: intEnv('SNAPSHOT_HOUR', 3, env),
  };
}

/**
 * Assemble the storage components. Kept separate so integration tests can build
 * one against an in-memory GitHub instead of mocking module loading.
 */
function createDepot(config, { fetchImpl, logger = console } = {}) {
  const github = new GithubClient({
    token: config.token,
    repo: config.repo,
    branch: config.branch,
    apiBase: config.apiBase,
    fetchImpl,
    logger,
    maxRetries: 2,
  });
  const manager = new ShardManager({
    depotDir: config.depotDir,
    shardMaxRows: config.shardMaxRows,
    hashLen: config.hashLen,
  });
  const cache = new CsvShardCache({
    github,
    manager,
    logger,
    cacheTtl: config.cacheTtl,
  });
  const queue = new ShardWriteQueue({
    cache,
    github,
    manager,
    logger,
    flushInterval: config.flushInterval,
    maxBatch: config.maxBatch,
    maxRetries: config.maxRetries,
  });
  const snapshot = new SnapshotManager({
    github,
    manager,
    cache,
    logger,
    keepDays: config.snapshotKeepDays,
    snapshotHour: config.snapshotHour,
    maxRetries: config.maxRetries,
  });

  return { config, logger, github, manager, cache, queue, snapshot };
}

let depot = null;

// Process-wide singleton: the shard cache and index must be shared or the index
// is pointless.
function getDepot() {
  if (!depot) {
    depot = createDepot(loadConfig());
    depot.queue.start();
  }

  return depot;
}

// Tests only: drop the singleton so cases cannot pollute each other.
function resetDepot() {
  if (depot) {
    depot.queue.stop();
    depot = null;
  }
}

/**
 * Build the "table name to model instance" factory.
 *
 * Waline's getModel calls the result rather than constructing it, hence the
 * factory function; the documented class form throws "Class constructor cannot be
 * invoked without 'new'". Returning null means "unknown table" and lets Waline
 * fall back to its built-in storage.
 */
function createModelFactory(depot) {
  return (tableName) => {
    if (!TABLES.includes(tableName)) {
      return null;
    }

    return new CsvModel(tableName, {
      cache: depot.cache,
      queue: depot.queue,
      manager: depot.manager,
      logger: depot.logger,
      dedupWindowSeconds: depot.config.dedupWindowSeconds,
    });
  };
}

// Process-wide singleton model factory, for the same sharing reason as getDepot().
function customModel(tableName) {
  return createModelFactory(getDepot())(tableName);
}

// ---------------------------------------------------------------------------
// Administrator authentication
// ---------------------------------------------------------------------------

/**
 * Minimal HS256 JWT verification.
 *
 * jsonwebtoken is not required here because it is an internal dependency of
 * @waline/vercel whose resolution depends on node_modules hoisting and may fail
 * under certain bundling/externalization combinations. Only verification and
 * expiry are needed, which node:crypto covers in twenty lines, and the payload
 * stays compatible with how Waline signs (jwt.sign(userId, jwtKey) signs a bare
 * string).
 */
function verifyHs256(token, secret) {
  const parts = String(token).split('.');

  if (parts.length !== 3 || !secret) {
    return null;
  }
  const [header, payload, signature] = parts;
  const expected = createHmac('sha256', secret).update(`${header}.${payload}`).digest();
  let actual;

  try {
    actual = Buffer.from(signature, 'base64url');
  } catch {
    return null;
  }

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  let claims;

  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    // jsonwebtoken leaves a non-object payload unquoted, so the segment is the
    // bare string that was signed (Waline signs an objectId)
    claims = Buffer.from(payload, 'base64url').toString('utf8');
  }

  if (claims && typeof claims === 'object' && claims.exp && Date.now() >= claims.exp * 1000) {
    return null;
  }

  // Waline's payload is a bare string; the object form is also accepted
  if (typeof claims === 'string') {
    return claims || null;
  }

  return claims?.objectId ?? claims?.id ?? claims?.userId ?? null;
}

// Whether the current request comes from an administrator, matching Waline's
// login and permission semantics.
async function isAdministrator(ctx, cache) {
  // Authorization header only: a token in the URL ends up in proxy logs and
  // browser history
  const token = ctx.get('authorization').replace(/^Bearer /iu, '');

  if (!token) {
    return false;
  }
  // Prefer the jwtKey injected by the Waline runtime (think is the global thinkjs
  // object); fall back to the exact same resolution @waline/vercel's config.js uses
  const jwtKey =
    globalThis.think?.config?.('jwtKey') || process.env.JWT_TOKEN || process.env.GITHUB_TOKEN;
  const objectId = verifyHs256(token, jwtKey);

  if (!objectId) {
    return false;
  }
  await cache.ensureFresh();

  return (await cache.getRow('Users', objectId))?.row?.type === 'administrator';
}

// ---------------------------------------------------------------------------
// Ops endpoints
// ---------------------------------------------------------------------------

const ADMIN_ROUTE = /\/csv-depot\/(?<action>[a-z]+)\/?$/u;

// Destructive actions require an explicit confirm, so a stray click or crawler
// cannot wipe history.
const isConfirmed = (value) => ['1', 'true', 'yes'].includes(String(value ?? '').trim().toLowerCase());

async function handleAdminRequest(ctx, action) {
  const { cache, queue, snapshot, manager, github, logger } = getDepot();

  if (!(await isAdministrator(ctx, cache))) {
    ctx.status = 401;
    ctx.body = { errno: 1, errmsg: '需要管理员身份' };

    return;
  }

  try {
    switch (`${action}:${ctx.method}`) {
      case 'snapshot:POST': {
        const created = await snapshot.createSnapshot();
        const pruned = await snapshot.pruneSnapshots();

        ctx.body = { errno: 0, data: { created, pruned } };

        return;
      }
      case 'snapshot:GET':
        ctx.body = { errno: 0, data: { snapshots: await snapshot.listSnapshots() } };

        return;
      case 'restore:POST': {
        const date = ctx.request.body?.date || ctx.query?.date;

        ctx.body = { errno: 0, data: await snapshot.restore(date) };

        return;
      }
      case 'compact:POST': {
        const result = {};

        for (const table of TABLES) {
          result[manager.tableDir(table)] = await cache.compact(table);
        }
        await queue.flush();

        ctx.body = { errno: 0, data: result };

        return;
      }
      case 'repair:POST': {
        // Move rows left misplaced by a page rename back to their canonical shard.
        // Refresh normally does this on its own; the endpoint exists for callers
        // who want the result now, or want the report.
        const result = {};

        for (const table of TABLES) {
          result[manager.tableDir(table)] = await cache.repairMisplaced(table);
        }
        await queue.flush();

        ctx.body = { errno: 0, data: result };

        return;
      }
      case 'rebuild:POST': {
        // Reconcile the repository's real files and repair the manifest, for after
        // shards were edited by hand. Flush local changes first so the following
        // remote-wins reload does not wash them out.
        await queue.flush();

        const result = await cache.syncFromTree();

        await queue.flush();
        ctx.body = { errno: 0, data: result };

        return;
      }
      case 'flush:POST':
        ctx.body = { errno: 0, data: await queue.flush() };

        return;
      case 'reset:POST': {
        // Irreversible: discards every historical commit, keeping current data
        const confirm = ctx.request.body?.confirm ?? ctx.query?.confirm;

        if (!isConfirmed(confirm)) {
          ctx.status = 400;
          ctx.body = { errno: 1, errmsg: '重置会丢弃全部历史提交，请显式传 confirm=1' };

          return;
        }
        await queue.flush();
        ctx.body = {
          errno: 0,
          data: await snapshot.resetRepository({
            keepSnapshots: isConfirmed(ctx.request.body?.keepSnapshots ?? ctx.query?.keepSnapshots),
          }),
        };

        return;
      }
      case 'stats:GET': {
        const tables = {};
        const misplaced = {};

        for (const table of TABLES) {
          const state = cache.tables[table];

          tables[table] = state.shards.size;
          misplaced[table] = [...state.aliases.values()].reduce((sum, paths) => sum + paths.size, 0);
        }
        ctx.body = {
          errno: 0,
          data: {
            queue: queue.stats,
            githubRequests: github.requestCount,
            shards: tables,
            // Shards still holding misplaced rows; non-zero means data has not
            // been moved back to its canonical family yet
            misplaced,
            pending: cache.pending.size,
            lastRefresh: cache.lastRefresh,
          },
        };

        return;
      }
      default:
        ctx.status = 404;
        ctx.body = { errno: 1, errmsg: `不支持的运维操作：${action} ${ctx.method}` };
    }
  } catch (err) {
    logger.error?.(`[csv-depot] 运维操作 ${action} 失败：`, err);
    ctx.status = 500;
    ctx.body = { errno: 1, errmsg: err.message };
  }
}

/**
 * Waline plugin: injects middleware.
 *
 * Order is critical — ops endpoints must be intercepted before Waline's routes,
 * or they hit a 404 first; and flush has to happen after business processing but
 * before the response goes out.
 */
const csvDepotPlugin = {
  middlewares: [
    async (ctx, next) => {
      const matched = ADMIN_ROUTE.exec(ctx.path);

      if (matched) {
        await handleAdminRequest(ctx, matched.groups.action);

        return;
      }

      let businessError = null;

      try {
        await next();
      } catch (err) {
        businessError = err;
      }

      try {
        await getDepot().queue.flush();
      } catch (err) {
        if (businessError) {
          console.error('[csv-depot] 业务异常且落盘失败：', err);
        } else {
          // A write that never persisted must not answer 200, or the user
          // believes the comment was saved
          console.error('[csv-depot] 评论落盘失败：', err);
          ctx.status = 500;
          ctx.body = { errno: 1, errmsg: '评论存储提交失败，请稍后重试' };

          return;
        }
      }

      if (businessError) {
        throw businessError;
      }

      try {
        await getDepot().snapshot.maybeRunDaily();
      } catch (err) {
        // A failed snapshot must not affect normal requests
        console.error('[csv-depot] 每日快照失败：', err);
      }
    },
  ],
};

module.exports = {
  customModel,
  createModelFactory,
  csvDepotPlugin,
  loadConfig,
  createDepot,
  getDepot,
  resetDepot,
  verifyHs256,
  TABLES,
};
