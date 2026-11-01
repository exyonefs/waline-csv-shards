'use strict';

/**
 * Guard for "can the function load at all" on the production runtime.
 *
 * AWS Lambda (behind Netlify) runs Node 24 without require(esm), while
 * @waline/vercel@1.43.4 synchronously requires the ESM-only
 * `@mdit/plugin-emoji` at the top of src/service/markdown/index.js. The function
 * then throws ERR_REQUIRE_ESM on cold start and the whole site 502s. Locally
 * require(esm) is on by default, so the problem is invisible until deploy.
 *
 * A child process with --no-experimental-require-module reproduces the production
 * runtime and does one thing: require the real function entry point. Changes that
 * turn a dependency ESM-only, or that synchronously require one, are caught by
 * `npm test` instead of by production.
 */

const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const REPO_ROOT = path.join(__dirname, '..', '..');

test('the function entry point loads on a runtime with require(esm) disabled', () => {
  const result = spawnSync(
    process.execPath,
    [
      '--no-experimental-require-module',
      '-e',
      "require('./netlify/functions/comment.js'); console.log('FUNCTION_LOADED');",
    ],
    {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: {
        ...process.env,
        // waline validates storage configuration while loading, so give it the
        // same placeholder values as production; otherwise it fails first with
        // "No valid storage found." and hides the loading problem under test
        GITHUB_TOKEN: 'test-token',
        GITHUB_REPO: 'owner/repo',
        GITHUB_BRANCH: 'main',
      },
    },
  );

  assert.equal(
    result.status,
    0,
    `函数入口在禁用 require(esm) 的运行时下加载失败（线上会表现为冷启动 502）：\n${result.stderr}`,
  );
  assert.match(result.stdout, /FUNCTION_LOADED/u);
  assert.doesNotMatch(result.stderr, /ERR_REQUIRE_ESM/u);
});
