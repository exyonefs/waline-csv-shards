'use strict';

/**
 * End-to-end: run the real @waline/vercel with only GitHub swapped for an
 * in-memory mock.
 *
 * The other cases drive CsvModel directly; what is under test here is the wiring:
 * whether Waline({ model: customModel, plugins: [csvDepotPlugin] }) is really
 * picked up by thinkjs (think.config('customModel') catches the model, and
 * getModel calls it rather than constructing it), whether the plugin middleware
 * really flushes before the response, and whether the real Waline routes can read
 * and write through our storage.
 *
 * This layer is what catches "all unit tests green, production 500" — a wrong
 * factory signature, middleware in the wrong order, a field name mismatch that
 * makes formatCmt throw, or a response sent before the flush.
 *
 * Note that the file creates the Application exactly once: thinkjs' think is a
 * process-wide singleton, so two Apps in one process interfere, which is why all
 * assertions live in a single case.
 */

const assert = require('node:assert/strict');
const { test } = require('node:test');
const http = require('node:http');

const { MockGitHub } = require('./mock-github');

test('real Waline runtime + sharded storage: post, list, count, authenticate', async (t) => {
  const mock = new MockGitHub();

  await mock.start();

  // Must be set before require('@waline/vercel'): the framework builds its config
  // from environment variables while loading
  process.env.MARKDOWN_TEX = 'false';
  process.env.GITHUB_TOKEN = 'test-token';
  process.env.GITHUB_REPO = 'owner/repo';
  process.env.GITHUB_BRANCH = 'main';
  process.env.GITHUB_API_BASE = mock.apiBase;
  process.env.JWT_TOKEN = 'test-jwt-key';
  process.env.CSV_DEPOT_DIR = 'data';
  // Waline ships a default akismet key; leaving it on makes the test call out to
  // the network for spam detection, which is slow and nondeterministic
  process.env.AKISMET_KEY = 'false';

  // eslint-disable-next-line global-require
  const Waline = require('@waline/vercel');
  // eslint-disable-next-line global-require
  const { customModel, csvDepotPlugin, resetDepot } = require('../csv-depot');

  resetDepot();

  const server = http.createServer(Waline({ env: 'netlify', model: customModel, plugins: [csvDepotPlugin] }));

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  const base = `http://127.0.0.1:${server.address().port}`;

  t.after(async () => {
    resetDepot();
    await new Promise((resolve) => server.close(resolve));
    await mock.stop();
  });

  const getJson = async (path) => {
    const res = await fetch(`${base}${path}`);

    assert.equal(res.status, 200, `${path} should return 200`);

    return res.json();
  };

  const postJson = async (path, body, headers = {}) => {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });

    return { status: res.status, body: await res.json() };
  };

  const commentShards = () =>
    [...mock.listFiles().keys()].filter(
      (path) => path.startsWith('data/comments/') && path.endsWith('.csv') && !path.endsWith('_manifest.csv'),
    );

  // 1. An empty depot answers with an empty list (the "no data files yet" path
  //    must not blow up)
  const empty = await getJson('/api/comment?path=%2Fpost-1&page=1&pageSize=10&sortBy=insertedAt_desc');

  assert.equal(empty.errno, 0);
  assert.deepEqual(empty.data.data, []);
  assert.equal(commentShards().length, 0, 'a read-only request must not create data files');

  // 2. Post a comment: controller -> model.add -> middleware flush before response
  const payload = {
    comment: '来自端到端测试的评论，包含 `markdown` 与中文。',
    nick: '测试用户',
    mail: 'e2e@example.com',
    link: 'https://example.com',
    url: '/post-1',
    ua: 'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36',
  };
  const created = await postJson('/api/comment', payload);

  assert.equal(created.status, 200);
  assert.equal(created.body.errno, 0);
  assert.ok(created.body.data.objectId, 'the response must carry an objectId');
  assert.equal(created.body.data.nick, '测试用户');
  assert.equal(created.body.data.comment.includes('<p>'), true, 'markdown should be rendered');

  // 3. The critical one: data must be committed by the time the response returns
  assert.equal(commentShards().length, 1, 'the comment must be persisted when the response returns');

  const shardText = mock.readText(commentShards()[0]);

  assert.equal(shardText.includes('来自端到端测试的评论'), true, 'the shard should hold the raw markdown');
  assert.equal(shardText.split('\n')[0].startsWith('objectId,'), true, 'a shard must carry a header');

  const manifest = mock.readText('data/comments/_manifest.csv');

  assert.equal(manifest.trim().split('\n').length, 2, 'manifest should record 1 shard');
  assert.equal(manifest.includes(',1,'), true, 'manifest should record row_count=1');

  // 4. Read the list: the real getCommentList (count x2 + roots + children + users)
  const list = await getJson('/api/comment?path=%2Fpost-1&page=1&pageSize=10&sortBy=insertedAt_desc');

  assert.equal(list.errno, 0);
  assert.equal(list.data.count, 1);
  assert.equal(list.data.totalPages, 1);
  assert.equal(list.data.data.length, 1);
  assert.equal(list.data.data[0].nick, '测试用户');
  assert.equal(list.data.data[0].objectId, created.body.data.objectId);
  assert.equal(typeof list.data.data[0].time, 'number', 'insertedAt should be formatted as a timestamp');
  assert.equal(Array.isArray(list.data.data[0].children), true);

  // 5. The count endpoint
  const counts = await getJson('/api/comment?type=count&url=%2Fpost-1');

  assert.equal(counts.errno, 0);
  assert.deepEqual(counts.data, [1]);

  // 6. Recent comments (order by insertedAt desc)
  const recent = await getJson('/api/comment?type=recent&count=5');

  assert.equal(recent.data.length, 1);

  // 7. The admin list needs an administrator identity, which also exercises the
  //    whole login chain (the first registered user becomes administrator, a
  //    Waline rule)
  const adminList = await fetch(`${base}/api/comment?type=list&page=1&pageSize=10`);

  assert.equal(adminList.status, 401, 'an unauthenticated admin list must be rejected');

  const registered = await postJson('/api/user', {
    email: 'admin@example.com',
    password: 'admin-password-123',
    display_name: '管理员',
  });

  assert.equal(registered.body.errno, 0, `注册失败：${JSON.stringify(registered.body)}`);

  const login = await postJson('/api/token', { email: 'admin@example.com', password: 'admin-password-123' });

  assert.equal(login.body.errno, 0, `登录失败：${JSON.stringify(login.body)}`);
  assert.ok(login.body.data.token, 'login must return a token, proving the Users primary key round-trips');
  assert.equal(login.body.data.type, 'administrator');

  const auth = { authorization: `Bearer ${login.body.data.token}` };
  const getAuthorized = async (path) => {
    const res = await fetch(`${base}${path}`, { headers: auth });

    assert.equal(res.status, 200, `${path} should return 200`);

    return res.json();
  };

  const adminListAuthorized = await getAuthorized('/api/comment?type=list&page=1&pageSize=10');

  assert.equal(adminListAuthorized.errno, 0);
  assert.equal(adminListAuthorized.data.totalPages, 1);
  assert.equal(adminListAuthorized.data.spamCount, 0);
  assert.equal(adminListAuthorized.data.data.length, 1);
  assert.equal(adminListAuthorized.data.data[0].mail, 'e2e@example.com', 'an administrator can see the email');

  // 8. Ops endpoints: an administrator can create a snapshot, an anonymous
  //    caller cannot. This also proves our HS256 check accepts a token really
  //    signed by Waline.
  const unauth = await postJson('/api/csv-depot/snapshot', {});

  assert.equal(unauth.status, 401);
  assert.equal(unauth.body.errno, 1);

  const snapshot = await fetch(`${base}/api/csv-depot/snapshot`, { method: 'POST', headers: auth });
  const snapshotBody = await snapshot.json();

  assert.equal(snapshot.status, 200, `创建快照失败：${JSON.stringify(snapshotBody)}`);
  assert.equal(snapshotBody.errno, 0);
  assert.equal(snapshotBody.data.created.files > 0, true, 'the snapshot should reference existing data files');

  const snapshotList = await getAuthorized('/api/csv-depot/snapshot');

  assert.equal(snapshotList.errno, 0);
  assert.equal(snapshotList.data.snapshots.length, 1);

  // 9. An identical duplicate submit is caught by Waline's own duplicate check.
  //    Note that thinkjs' ctx.fail(string) normalises errno to 1000 rather than
  //    the 1 our middleware defines, so assert "non-zero and mentions duplicate".
  const duplicate = await postJson('/api/comment', payload);

  assert.equal(duplicate.status, 200);
  assert.notEqual(duplicate.body.errno, 0);
  assert.match(duplicate.body.errmsg, /Duplicate/u);

  // 10. IP frequency limit: the same IP cannot post again within IPQPS seconds.
  //     This check depends on the storage comparing dates correctly — upstream's
  //     GitHub storage compares `item[k] >= where[k][1]`, which is always false
  //     for string vs Date, so it never fired.
  const tooFast = await postJson('/api/comment', { ...payload, comment: '第二次发言' });

  assert.notEqual(tooFast.body.errno, 0, 'the IP frequency limit should be in effect');

  // 11. Lift the frequency limit and verify that a keyword search containing
  //     regex metacharacters does not throw (upstream interpolates the keyword
  //     straight into new RegExp, so parenthesised input 500s)
  process.env.IPQPS = '0';

  const withBraces = await postJson('/api/comment', {
    ...payload,
    comment: '包含 (括号) [方括号] 与 100% 的内容',
  });

  assert.equal(withBraces.body.errno, 0, `a comment with metacharacters should post: ${JSON.stringify(withBraces.body)}`);

  const searched = await getAuthorized(
    `/api/comment?type=list&page=1&pageSize=10&keyword=${encodeURIComponent('(括号)')}`,
  );

  assert.equal(searched.errno, 0);
  assert.equal(searched.data.data.length, 1, 'a keyword search with regex metacharacters should not throw');
});
