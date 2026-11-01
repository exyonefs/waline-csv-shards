import { html } from 'wunphile'

import { panelClass, iconSlotClass, textBodyClass, textAuxClass } from './ui.mjs'

/** 每页顶部的标题区：白底面板 + 网格背景 + 右上紫光晕 */
export const PageHead = ({ title, lead }) => html`
  <header class="${panelClass} grid-surface relative overflow-hidden">
    <div
      class="glow-purple-soft pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full blur-2xl"
      aria-hidden="true"
    ></div>
    <div
      class="glow-cyan-soft pointer-events-none absolute -bottom-28 -left-16 h-56 w-56 rounded-full blur-2xl"
      aria-hidden="true"
    ></div>
    <div class="relative">
      <span
        class="mb-5 block h-1 w-12 rounded-full bg-gradient-to-r from-[#635bff] to-[#00d4ff]"
        aria-hidden="true"
      ></span>
      <h1 class="font-semibold text-[#0a2540] text-3xl md:text-4xl leading-tight">${title}</h1>
      <p class="mt-4 ${textBodyClass} prose-limit">${lead}</p>
    </div>
  </header>
`

/** 首页 Hero：深蓝底 + 亮青网格 + 紫青光晕 */
export const Hero = ({ title, lead }, children) => html`
  <section class="relative overflow-hidden rounded-xl bg-[#0a2540] px-6 py-12 md:px-10 md:py-16 shadow-[0_4px_8px_rgba(0,0,0,0.06),0_16px_32px_rgba(0,0,0,0.1)]">
    <div
      class="grid-surface-dark grid-fade pointer-events-none absolute inset-0"
      aria-hidden="true"
    ></div>
    <div
      class="glow-purple pointer-events-none absolute -right-24 -top-28 h-96 w-96 rounded-full opacity-70 blur-2xl"
      aria-hidden="true"
    ></div>
    <div
      class="glow-cyan pointer-events-none absolute -bottom-40 -left-20 h-96 w-96 rounded-full opacity-60 blur-2xl"
      aria-hidden="true"
    ></div>
    <div class="relative">
      <h1 class="font-semibold text-white text-4xl md:text-5xl leading-[1.2]">${title}</h1>
      <p class="mt-6 text-sm md:text-base text-white/80 prose-limit">${lead}</p>
      ${children}
    </div>
  </section>
`

/**
 * 页面里的一个章节：标题 + 可选导语 + 内容。
 *
 * @type {import('wunphile').Component<
 *   { title: string, lead?: any },
 *   import('wunphile').RenderFragments
 * >}
 */
export const Block = ({ title, lead }, children) => html`
  <section class="flex flex-col gap-4 md:gap-6">
    <div>
      <h2 class="font-semibold text-[#0a2540] text-2xl md:text-3xl">${title}</h2>
      ${lead
        ? html`<div class="mt-3 ${textBodyClass} prose-limit">${lead}</div>`
        : ''}
    </div>
    ${children}
  </section>
`

/** 正文段落 */
export const P = (_, children) => html`<p class="${textBodyClass} prose-limit">${children}</p>`

/** 无序清单：圆点用主色小方块，与目录标记保持同一语言 */
export const List = ({ items }) => html`
  <ul class="flex flex-col gap-3 md:gap-4">
    ${items.map(
      (item) => html`
        <li class="flex gap-3 ${textBodyClass}">
          <span
            class="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#635bff]"
            aria-hidden="true"
          ></span>
          <span class="prose-limit">${item}</span>
        </li>
      `
    )}
  </ul>
`

/** 并列的卡片组（平铺，不嵌套） */
export const CardGrid = ({ columns = 2 }, children) => html`
  <div
    class="grid grid-cols-1 ${columns === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4 md:gap-6"
  >
    ${children}
  </div>
`

/** 平铺的内容面板：与卡片共用同一套白底表面 */
export const Panel = (_, children) => html`<div class="${panelClass}">${children}</div>`

/** 图标槽 */
export const IconSlot = (_, children) =>
  html`<span class="${iconSlotClass}" aria-hidden="true">${children}</span>`

/** Deploy on Netlify 徽章：白底 chip，悬停上浮 */
export const DeployBadge = () => html`
  <a
    href="https://app.netlify.com/start/deploy?repository=https://github.com/exyonefs/waline-csv-shards"
    target="_blank"
    rel="noreferrer noopener"
    aria-label="Deploy to Netlify"
    class="inline-flex items-center rounded-lg border border-gray-200 bg-white p-1 shadow-[0_2px_4px_rgba(0,0,0,0.04),0_8px_16px_rgba(0,0,0,0.08)] transition-all duration-[300ms] ease-out hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(0,0,0,0.12)]"
  >
    <img
      src="https://www.netlify.com/img/deploy/button.svg"
      alt="Deploy to Netlify"
      width="146"
      height="32"
      class="block"
    />
  </a>
`
