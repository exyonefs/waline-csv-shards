import { html } from 'wunphile'

import { inputClass, textAuxClass } from './ui.mjs'
import { LiveCodeBlock } from './CodeBlock.mjs'
import { code } from './Table.mjs'

/**
 * 输入自己的 Netlify 域名 -> 实时生成可复制的 Waline 接入片段。
 * 逻辑见 assets/site.js。
 *
 * @type {import('wunphile').Component<void, void>}
 */
export const ServerUrlBuilder = () => html`
  <form data-builder novalidate class="flex flex-col gap-4 md:gap-6">
    <div class="flex flex-col gap-3">
      <label for="waline-domain" class="text-sm md:text-base font-semibold text-[#0a2540]">
        你的 Netlify 站点域名
      </label>
      <input
        id="waline-domain"
        data-domain-input
        type="text"
        inputmode="url"
        autocomplete="url"
        placeholder="your-site.netlify.app"
        class="${inputClass}"
      />
      <p class="${textAuxClass}">
        末尾不要带斜杠，也不要加 ${code('/api')}——Netlify 下直接使用
        ${code('/.netlify/functions/comment')}。
      </p>
    </div>
    ${LiveCodeBlock({ title: 'index.html' })}
  </form>
`

export default ServerUrlBuilder
