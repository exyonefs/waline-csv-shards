import { html } from 'wunphile'

import { codeButtonClass, codeSurfaceClass } from './ui.mjs'

/** 窗口式标题栏：三色圆点 + 文件名 */
const ChromeBar = ({ title }) => html`
  <div
    class="flex items-center justify-between gap-4 border-b border-white/10 bg-white/[0.04] px-5 py-2.5 md:px-6"
  >
    <span class="flex min-w-0 items-center gap-3">
      <span class="flex shrink-0 gap-1.5" aria-hidden="true">
        <i class="h-2.5 w-2.5 rounded-full bg-[#ff5f57]/80"></i>
        <i class="h-2.5 w-2.5 rounded-full bg-[#febc2e]/80"></i>
        <i class="h-2.5 w-2.5 rounded-full bg-[#28c840]/80"></i>
      </span>
      <span class="truncate font-mono text-xs text-[#8ea0b8]">${title}</span>
    </span>
    <button
      type="button"
      data-copy
      aria-label="复制 ${title} 中的代码"
      class="${codeButtonClass} shrink-0"
    >
      复制
    </button>
  </div>
`

/**
 * 代码块：深色表面 + 窗口标题栏（复制逻辑见 assets/site.js）。
 *
 * @type {import('wunphile').Component<{ title: string, code: string }, void>}
 */
export const CodeBlock = ({ title, code }) => html`
  <div data-code-block class="flex flex-col">
    <div class="${codeSurfaceClass}">
      ${ChromeBar({ title })}
      <pre
        class="overflow-x-auto px-5 py-5 text-xs leading-relaxed text-[#dbe4f0] md:px-6 md:text-sm"
      ><code>${code}</code></pre>
    </div>
  </div>
`

/**
 * 实时生成的代码块：内容由 assets/site.js 写入 [data-snippet-output]。
 *
 * @type {import('wunphile').Component<{ title: string }, void>}
 */
export const LiveCodeBlock = ({ title }) => html`
  <div data-code-block class="flex flex-col">
    <div class="${codeSurfaceClass}">
      ${ChromeBar({ title })}
      <pre
        class="overflow-x-auto px-5 py-5 text-xs leading-relaxed text-[#dbe4f0] md:px-6 md:text-sm"
      ><code data-snippet-output></code></pre>
    </div>
  </div>
`

export default CodeBlock
