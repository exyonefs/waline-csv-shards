import { html } from 'wunphile'

import config from '../config.mjs'
import { panelClass, textBodyClass } from './ui.mjs'
import { code } from './Table.mjs'

/**
 * 评论区。serverURL 通过 data 属性传给静态脚本，
 * 避免在 html`` 模板里往 <script> 里插值（插值会被 HTML 转义，script 内不会还原实体）。
 *
 * @type {import('wunphile').Component<void, void>}
 */
export const WalineComment = () => html`
  <section class="${panelClass}" id="comments">
    <h2 class="font-semibold text-[#0a2540] text-2xl md:text-3xl">评论</h2>
    <p class="mt-4 mb-8 ${textBodyClass} prose-limit">
      留言会写入数据仓库的 ${code('data/comments/<xx>/<xxxx>.csv')}
      分片，一个请求内的变更合并为一次 Git 提交。手册每一章各占一个分片，可在不同章节分别留言验证。
    </p>
    <div
      id="waline"
      data-server-url="${config.waline.serverURL}"
      data-lang="${config.waline.lang}"
      data-emoji="${JSON.stringify(config.waline.emoji)}"
    ></div>
  </section>
  <script type="module" src="/static/waline-init.js"></script>
`

export default WalineComment
