'use strict';

/**
 * Integration test scaffolding: an in-memory GitHub plus a real set of storage
 * components.
 *
 * None of our modules are mocked; only the GitHub dependency is swapped for an
 * in-memory implementation, so what the tests exercise matches production.
 */

const { MockGitHub } = require('./mock-github');
const { loadConfig, createDepot, createModelFactory } = require('../csv-depot');

// A logger that stays out of the way, so test output is not buried in logs.
const silentLogger = { debug() {}, info() {}, warn() {}, error() {} };

async function createHarness(overrides = {}, mockOptions = {}) {
  const mock = new MockGitHub(mockOptions);

  await mock.start();

  const config = {
    ...loadConfig({}),
    token: 'test-token',
    repo: 'owner/repo',
    branch: 'main',
    apiBase: mock.apiBase,
    // Dedup defaults to off so cases cannot interfere through "same content
    // inside the window"; dedup is covered by a dedicated case.
    dedupWindowSeconds: 0,
    ...overrides,
  };
  const depot = createDepot(config, { logger: silentLogger });
  const model = createModelFactory(depot);

  return {
    mock,
    depot,
    config,
    model,
    // Simulate a cold start: drop all process state and reload from the repository
    async coldStart() {
      const fresh = createDepot(config, { logger: silentLogger });

      return { depot: fresh, model: createModelFactory(fresh) };
    },
    async dispose() {
      depot.queue.stop();
      await mock.stop();
    },
  };
}

// Count API calls the mock received.
const apiCalls = (mock) => mock.requestLog.length;

const apiCallsMatching = (mock, pattern) =>
  mock.requestLog.filter((entry) => `${entry.method} ${entry.path}`.includes(pattern)).length;

// Build a comment row with the fields controllers actually write.
const commentData = (overrides = {}) => ({
  user_id: '',
  comment: 'hello world',
  insertedAt: new Date('2026-09-25T10:00:00.000Z'),
  ip: '127.0.0.1',
  link: 'https://example.com',
  mail: 'a@example.com',
  nick: 'Alice',
  pid: '',
  rid: '',
  status: 'approved',
  ua: 'Mozilla/5.0',
  url: '/post-1',
  ...overrides,
});

const userData = (overrides = {}) => ({
  display_name: 'Alice',
  email: 'a@example.com',
  password: 'hash',
  type: 'guest',
  url: 'https://example.com',
  avatar: '',
  label: '',
  ...overrides,
});

module.exports = { createHarness, silentLogger, apiCalls, apiCallsMatching, commentData, userData };
