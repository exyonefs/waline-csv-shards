import { html } from 'wunphile'

import { cardClass, stepSlotClass, textAuxClass } from './ui.mjs'

/**
 * 带序号的步骤卡片。
 *
 * @type {import('wunphile').Component<{ items: { title: string, body: any }[] }, void>}
 */
export const Steps = ({ items }) => html`
  <ol class="flex flex-col gap-4 md:gap-6">
    ${items.map(
      (item, index) => html`
        <li class="${cardClass} group">
          <div class="flex items-start gap-4">
            <span class="${stepSlotClass}" aria-hidden="true">${index + 1}</span>
            <div class="min-w-0">
              <h3 class="font-semibold text-[#0a2540] text-base md:text-lg">${item.title}</h3>
              ${item.body
                ? html`<div class="mt-2 ${textAuxClass}">${item.body}</div>`
                : ''}
            </div>
          </div>
        </li>
      `
    )}
  </ol>
`

export default Steps
