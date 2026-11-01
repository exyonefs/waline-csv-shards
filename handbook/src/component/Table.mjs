import { html } from 'wunphile'

import { cardClass, inlineCodeClass } from './ui.mjs'

/** 单元格里的行内代码 */
export const code = (text) => html`<code class="${inlineCodeClass}">${text}</code>`

/**
 * 表格：白底卡片 + 表头浅底分隔，行间用极浅条纹区分。
 *
 * @type {import('wunphile').Component<{ head: string[], rows: any[][] }, void>}
 */
export const Table = ({ head, rows }) => html`
  <div class="${cardClass} p-0">
    <div class="overflow-x-auto rounded-xl">
      <table class="w-full border-collapse text-left text-xs md:text-sm">
        <thead class="bg-[#f6f9fc]">
          <tr>
            ${head.map(
              (cell) => html`
                <th
                  scope="col"
                  class="whitespace-nowrap px-4 py-3 font-semibold text-[#0a2540] md:px-5 md:py-4"
                  >${cell}</th
                >
              `
            )}
          </tr>
        </thead>
        <tbody>
          ${rows.map(
            (row) => html`
              <tr
                class="border-t border-gray-200 odd:bg-[#fbfcfe] transition-colors duration-200 ease-out hover:bg-[#635bff]/[0.045]"
              >
                ${row.map(
                  (cell) => html`
                    <td class="min-w-[8rem] px-4 py-3 align-top text-gray-600 md:px-5 md:py-4"
                      >${cell}</td
                    >
                  `
                )}
              </tr>
            `
          )}
        </tbody>
      </table>
    </div>
  </div>
`

export default Table
