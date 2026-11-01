import { html } from 'wunphile'

import config from '../config.mjs'
import { WalineComment } from './WalineComment.mjs'
import { Footer } from './Footer.mjs'
import { Sidebar, ChapterBar } from './ChapterNav.mjs'
import PrevNext from './PrevNext.mjs'
import { primaryButtonSmall, sidebarClass } from './ui.mjs'

const Nav = () => html`
  <nav
    class="sticky top-0 z-20 border-b border-gray-200 bg-white/85 px-6 shadow-[0_1px_2px_rgba(10,37,64,0.04)] backdrop-blur-md md:px-8"
    aria-label="主导航"
  >
    <div class="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 md:gap-6">
      <a href="/" class="flex min-w-0 items-center gap-3 font-semibold text-[#0a2540] text-lg">
        <span
          class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#635bff] text-sm font-semibold text-white shadow-[0_2px_5px_rgba(99,91,255,0.4),inset_0_1px_0_rgba(255,255,255,0.2)]"
          aria-hidden="true"
          >W</span
        >
        <span class="truncate">${config.siteName}</span>
      </a>
      <div class="flex shrink-0 items-center gap-3 md:gap-4">
        <a
          href="https://github.com/walinejs/netlify-starter"
          rel="noreferrer noopener"
          class="relative hidden text-sm text-gray-600 transition-colors duration-200 ease-out after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-0 after:rounded-full after:bg-[#635bff] after:transition-all after:duration-300 after:ease-out hover:text-[#635bff] hover:after:w-full sm:inline"
          >上游 starter</a
        >
        <a href="${config.waline.serverURL}/ui/login" class="${primaryButtonSmall}"
          >管理后台</a
        >
      </div>
    </div>
  </nav>
`

/**
 * 手册骨架：顶栏 + 左侧分组目录（窄屏退化为横向章节条）+ 正文 + 章节导航 + 每章评论。
 *
 * @type {import('wunphile').Component<
 *   { title: string, description: string, active: string },
 *   import('wunphile').RenderFragments
 * >}
 */
export const Layout = ({ title, description, active = '/' }, children) => html`
  <!doctype html>
  <html lang="zh-CN">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${title}</title>
      <meta name="description" content="${description}" />
      <link rel="stylesheet" href="/static/style.css" />
      <link rel="stylesheet" href="https://unpkg.com/@waline/client@v3/dist/waline.css" />
      <script src="https://cdn.tailwindcss.com"></script>
      <script>
        tailwind.config = {
          theme: {
            extend: {
              fontFamily: {
                sans: [
                  '-apple-system',
                  'BlinkMacSystemFont',
                  'Segoe UI',
                  'Helvetica Neue',
                  'PingFang SC',
                  'Microsoft YaHei',
                  'Arial',
                  'sans-serif',
                ],
                mono: [
                  'ui-monospace',
                  'SFMono-Regular',
                  'Menlo',
                  'Consolas',
                  'Liberation Mono',
                  'monospace',
                ],
              },
            },
          },
        }
      </script>
    </head>
    <body class="bg-[#f6f9fc] text-gray-600">
      <a
        href="#main"
        class="sr-only focus:not-sr-only focus:absolute focus:left-6 focus:top-4 focus:z-30 focus:rounded-lg focus:bg-[#635bff] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >跳到正文</a
      >
      ${Nav()}
      <div
        class="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-8 md:px-8 md:py-12 lg:flex-row lg:gap-12"
      >
        <aside class="hidden lg:block lg:w-64 lg:shrink-0">
          <div class="sticky top-24 ${sidebarClass}">${Sidebar({ active })}</div>
        </aside>
        <div class="flex min-w-0 flex-1 flex-col gap-8 md:gap-12">
          <div class="lg:hidden">${ChapterBar({ active })}</div>
          <main id="main" class="min-w-0">${children}</main>
          ${PrevNext({ active })} ${WalineComment()}
        </div>
      </div>
      ${Footer()}
      <script type="module" src="/static/site.js"></script>
    </body>
  </html>
`

export default Layout
