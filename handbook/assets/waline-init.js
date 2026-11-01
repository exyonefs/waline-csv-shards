/**
 * 初始化 Waline。
 * 放在静态资源里由 /static 挂载，而不是内联在页面里，这样不需要往 <script> 里插值字符串
 * （html`` 模板会对插值做 HTML 转义，而 script 是 raw text 元素，实体不会被还原）。
 *
 * serverURL / lang / emoji 由 #waline 上的 data 属性提供，构建期由 src/config.js 写入。
 */
import { init } from 'https://unpkg.com/@waline/client@v3/dist/waline.js'

const el = document.querySelector('#waline')

if (el) {
  let emoji = []
  try {
    emoji = JSON.parse(el.dataset.emoji || '[]')
  } catch (_) {
    emoji = []
  }

  init({
    el: '#waline',
    serverURL: el.dataset.serverUrl,
    // 每个页面一个分片：评论按 url（这里是 path）哈希到 data/comments/<xx>/<xxxx>.csv
    path: location.pathname,
    lang: el.dataset.lang || 'zh-CN',
    emoji,
    requiredMeta: [],
    login: 'enable',
  })
}
