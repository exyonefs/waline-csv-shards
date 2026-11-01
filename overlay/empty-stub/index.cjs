// Empty stub for optional dependencies that are pruned away (LeanCloud, MathJax,
// ...): they are never called under GitHub CSV storage, but destructuring them
// must not throw on some exotic code path.
module.exports = new Proxy(
  function emptyStub() {},
  {
    get: () => emptyStub,
    apply: () => emptyStub,
    construct: () => ({}),
  },
);

function emptyStub() {
  return emptyStub;
}
