'use strict';

/**
 * CJS shim for `@mdit/plugin-emoji`.
 *
 * @waline/vercel@1.43.4 requires this package synchronously while its markdown
 * service is being loaded, but the package ships ESM only (type: module, exports
 * default -> dist/index.js), so on a runtime without require(esm), such as AWS
 * Lambda's Node 24, that line throws ERR_REQUIRE_ESM and the function dies on
 * cold start.
 * Waline uses `await import()` for every other @mdit/* package; this one is an
 * upstream oversight.
 *
 * The shim supplies the same three exports from markdown-it-emoji, the package's
 * predecessor with a CJS build, which is exactly what waline@1.41.6 used. Emoji
 * rendering therefore behaves as it did before the upgrade.
 */

const { bare, full, light } = require('markdown-it-emoji');

module.exports = {
  bareEmoji: bare,
  fullEmoji: full,
  lightEmoji: light,
};
