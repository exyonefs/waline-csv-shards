import { html } from 'wunphile'

import { cardClass, textBodyClass } from './ui.mjs'

const ICONS = {
  info: html`<svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </svg>`,
  warn: html`<svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M12 4.5 21 20H3l9-15.5z" />
    <path d="M12 10v4M12 17h.01" />
  </svg>`,
}

/**
 * 提示块。用图标槽与正文层级区分提示与警告，不用单侧粗边框。
 *
 * @type {import('wunphile').Component<
 *   { tone?: 'info' | 'warn', title: string },
 *   import('wunphile').RenderFragments
 * >}
 */
export const Callout = ({ tone = 'info', title }, children) => html`
  <aside class="${cardClass} gap-3">
    <p class="flex items-start gap-3 font-semibold text-[#0a2540] text-base md:text-lg">
      <span
        class="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${tone ===
        'warn'
          ? 'bg-[#0a2540] text-white'
          : 'bg-[#635bff]/10 text-[#635bff]'}"
        aria-hidden="true"
        >${tone === 'warn' ? ICONS.warn : ICONS.info}</span
      >
      <span>${title}</span>
    </p>
    <div class="${textBodyClass} prose-limit">${children}</div>
  </aside>
`

export default Callout
