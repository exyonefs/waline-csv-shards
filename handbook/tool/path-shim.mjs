/**
 * node:path 的最小垫片，仅用于绕过 wunphile 1.x 在 Windows 上的一个缺陷。
 *
 * 现象：Wunphile 构造函数里执行
 *   path.resolve(process.env.SSG_NOT_FOUND_PATH || '/404.html')
 * 然后断言结果 startsWith('/')。Windows 下 path.resolve('/404.html') 返回
 * 'D:\404.html'，断言必然失败，构造即抛
 * "The not found page must start with a forward slash."
 * Linux / macOS（也就是 Netlify 的构建环境）不受影响。
 *
 * 这里只改写「单个参数且以 / 开头」这一路的 resolve，其余全部透传，
 * 因此在 POSIX 平台上是纯 no-op，可以放心一直挂着。
 */
import * as nodePath from 'node:path'

export const dirname = nodePath.dirname
export const extname = nodePath.extname
export const join = nodePath.join

// Windows 下 relative() 返回反斜杠，wunphile 会把它直接拼进客户端模块的 URL，
// 导致 import('/_wfclient/behavior\Xxx.js') 里的反斜杠变成转义符。统一成正斜杠。
export function relative(...args) {
  return nodePath.relative(...args).split(nodePath.sep).join('/')
}

const nativeResolve = nodePath.resolve

export function resolve(...args) {
  if (args.length === 1 && typeof args[0] === 'string' && args[0].startsWith('/')) {
    return args[0]
  }
  return nativeResolve(...args)
}

export default {
  ...nodePath,
  dirname,
  extname,
  join,
  relative,
  resolve,
}
