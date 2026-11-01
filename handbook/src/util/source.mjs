import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * handbook/src/util -> 仓库根目录。
 * 文档里的源码片段全部在构建期从真实文件里截取，不复制粘贴，
 * 所以代码改了文档就会跟着变（标记失效时直接构建失败，不会悄悄展示过期代码）。
 */
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

export function readRepoFile(relPath) {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8')
}

/**
 * 按标记截取一段源码。
 *
 * @param {string} relPath 相对仓库根的路径
 * @param {{ from?: string, to?: string }} range
 *   from 命中位置作为起点，to 在 from 之后的第一次命中作为终点（不含）。
 *   两个参数都省略时返回整个文件。
 */
export function excerpt(relPath, { from, to } = {}) {
  const text = readRepoFile(relPath)

  if (!from) return text.replace(/\s+$/, '')

  const start = text.indexOf(from)
  if (start === -1) {
    throw new Error(`[handbook] ${relPath} 里找不到起始标记：${JSON.stringify(from)}`)
  }

  if (!to) return text.slice(start).replace(/\s+$/, '')

  const end = text.indexOf(to, start + from.length)
  if (end === -1) {
    throw new Error(`[handbook] ${relPath} 里找不到结束标记：${JSON.stringify(to)}`)
  }

  return text.slice(start, end).replace(/\s+$/, '')
}
