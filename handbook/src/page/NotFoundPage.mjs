import { html } from 'wunphile'

import Layout from '../component/Layout.mjs'
import { PageHead, P } from '../component/Blocks.mjs'
import { primaryButton } from '../component/ui.mjs'
import config from '../config.mjs'

const NotFoundPage = () =>
  Layout(
    {
      title: `页面不存在 · ${config.siteName}`,
      description: '没有找到这个地址对应的页面。',
      active: '/',
    },
    html`
      <div class="flex flex-col gap-8 md:gap-12">
        ${PageHead({
          title: '页面不存在',
          lead: '这个地址没有对应的页面。可以回到概览，或在下方留言说明你期望在这里看到的内容。',
        })}
        ${P({}, html`也可以从「开始」一段重新进入：快速上手、部署与环境变量都在那里。`)}
        <div><a href="/" class="${primaryButton}">回到概览</a></div>
      </div>
    `
  )

export default NotFoundPage
