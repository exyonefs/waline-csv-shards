import { html } from 'wunphile'

import { flatNav } from '../config.mjs'
import { cardInteractiveClass } from './ui.mjs'

/** 章节末尾的上一章 / 下一章 */
export const PrevNext = ({ active }) => {
  const index = flatNav.findIndex((item) => item.href === active)
  const prev = index > 0 ? flatNav[index - 1] : null
  const next = index >= 0 && index < flatNav.length - 1 ? flatNav[index + 1] : null

  return html`
    <nav aria-label="章节导航" class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6">
      ${prev
        ? html`<a href="${prev.href}" class="${cardInteractiveClass} group">
            <span class="flex items-center gap-2 text-xs text-gray-500">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="text-[#635bff] transition-transform duration-300 ease-out group-hover:-translate-x-1"
                aria-hidden="true"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
              上一章
            </span>
            <span class="mt-1 font-semibold text-[#0a2540]">${prev.label}</span>
          </a>`
        : html`<span class="hidden sm:block"></span>`}
      ${next
        ? html`<a
            href="${next.href}"
            class="${cardInteractiveClass} group sm:text-right"
          >
            <span class="flex items-center justify-start gap-2 text-xs text-gray-500 sm:justify-end">
              下一章
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="text-[#635bff] transition-transform duration-300 ease-out group-hover:translate-x-1"
                aria-hidden="true"
              >
                <path d="M9 6l6 6-6 6" />
              </svg>
            </span>
            <span class="mt-1 font-semibold text-[#0a2540]">${next.label}</span>
          </a>`
        : ''}
    </nav>
  `
}

export default PrevNext
