import { html } from 'wunphile'

import { cardInteractiveClass, iconSlotClass, textAuxClass } from './ui.mjs'

/**
 * 特性卡片：悬停整体上浮，图标槽随之放大。
 *
 * @type {import('wunphile').Component<
 *   { title: string, description: string, icon: import('wunphile').RenderFragments },
 *   void
 * >}
 */
export const FeatureCard = ({ title, description, icon }) => html`
  <article class="${cardInteractiveClass} group gap-4">
    <span class="${iconSlotClass}">${icon}</span>
    <div>
      <h3
        class="font-semibold text-[#0a2540] text-base md:text-lg transition-colors duration-300 ease-out group-hover:text-[#635bff]"
      >
        ${title}
      </h3>
      <p class="mt-2 ${textAuxClass}">${description}</p>
    </div>
  </article>
`

/** 指标块：数值用等宽字体 + 底部渐变短条，标签在下方 */
export const Stat = ({ value, label }) => html`
  <div class="${cardInteractiveClass} gap-3">
    <p class="font-mono text-2xl md:text-3xl font-semibold text-[#635bff]">${value}</p>
    <span
      class="block h-0.5 w-8 rounded-full bg-gradient-to-r from-[#635bff] to-[#00d4ff]"
      aria-hidden="true"
    ></span>
    <p class="text-xs md:text-sm text-[#475569]">${label}</p>
  </div>
`

export default FeatureCard
