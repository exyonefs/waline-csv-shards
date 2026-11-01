/**
 * 把 wunphile 内部对 node:path 的引用指到我们的垫片上。
 * 只重定向 wunphile 自己发起的 import，否则垫片自身 import 'node:path' 会被
 * 再次指回垫片，形成自引用。
 */
const WUNPHILE = /node_modules[\\/]wunphile[\\/]/

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'node:path' && WUNPHILE.test(context.parentURL ?? '')) {
    return {
      url: new URL('./path-shim.mjs', import.meta.url).href,
      shortCircuit: true,
    }
  }
  return nextResolve(specifier, context)
}
