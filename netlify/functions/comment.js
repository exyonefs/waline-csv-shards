/**
 * Netlify Function entry point for the Waline comment service.
 *
 * Storage lives in a GitHub repository as sharded CSVs under data/, keeping the
 * deployment light (no math rendering and other heavy dependencies) while
 * writes stay reliable under concurrency.
 */

// These environment variables must be set before require('@waline/vercel'):
// Waline builds its markdown parser from them while modules are evaluated, so
// passing configuration afterwards is too late. ??= supplies defaults without
// overriding values set explicitly in Netlify.

// No math rendering: skip mathjax/katex and their ESM dependencies.
process.env.MARKDOWN_TEX ??= 'false';

const http = require('node:http');

const Waline = require('@waline/vercel');
const serverless = require('serverless-http');

const { customModel, csvDepotPlugin } = require('../../overlay/csv-depot');

// model swaps the storage adapter for sharded CSVs; plugins add "flush before
// response" and the ops endpoints. Both are official extension points, so no
// upstream business logic is touched.
const app = Waline({
  env: 'netlify',
  model: customModel,
  plugins: [csvDepotPlugin],
});

module.exports.handler = serverless(http.createServer(app));
