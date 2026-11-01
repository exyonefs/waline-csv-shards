import { html } from 'wunphile'

import config from '../config.mjs'
import { navLinkClass, navLinkActiveClass, chipClass } from './ui.mjs'

// 属性必须由模板字面量本身写出来：html`` 会转义引号，
// 所以「当前页」和「其它页」写成两条分支，而不是插值一段属性字符串。

/** 桌面端左侧分组目录 */
export const Sidebar = ({ active }) => html`
  <nav aria-label="手册目录" class="flex flex-col gap-5">
    ${config.nav.map(
      (section) => html`
        <div class="flex flex-col gap-1">
          <p class="flex items-center gap-2 px-3 text-xs font-semibold text-gray-500">
            <span
              class="h-0.5 w-3.5 rounded-full bg-[#635bff]/60"
              aria-hidden="true"
            ></span>
            ${section.group}
          </p>
          ${section.items.map((item) =>
            item.href === active
              ? html`<a
                  href="${item.href}"
                  aria-current="page"
                  class="${navLinkActiveClass}"
                  >${item.label}</a
                >`
              : html`<a href="${item.href}" class="${navLinkClass}">${item.label}</a>`
          )}
        </div>
      `
    )}
  </nav>
`

/** 窄屏用的横向章节条 */
export const ChapterBar = ({ active }) => html`
  <nav aria-label="手册目录" class="flex gap-3 overflow-x-auto pb-2">
    ${config.nav.flatMap((section) =>
      section.items.map((item) =>
        item.href === active
          ? html`<a
              href="${item.href}"
              aria-current="page"
              class="shrink-0 rounded-full bg-[#635bff] px-4 py-2 text-sm font-semibold text-white shadow-[0_2px_5px_rgba(99,91,255,0.4),inset_0_1px_0_rgba(255,255,255,0.2)]"
              >${item.label}</a
            >`
          : html`<a href="${item.href}" class="${chipClass} shrink-0">${item.label}</a>`
      )
    )}
  </nav>
`
