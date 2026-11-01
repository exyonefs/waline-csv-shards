import { html } from 'wunphile'

import config from '../config.mjs'

export const Footer = () => html`
  <footer class="relative overflow-hidden border-t border-gray-200 bg-[#0a2540] px-6 py-12 md:px-8 md:py-16">
    <div
      class="grid-surface-dark pointer-events-none absolute inset-0 opacity-40 [mask-image:linear-gradient(to_top,#000_0%,transparent_70%)]"
      aria-hidden="true"
    ></div>
    <div
      class="glow-purple pointer-events-none absolute -bottom-32 right-[10%] h-72 w-72 rounded-full opacity-40 blur-2xl"
      aria-hidden="true"
    ></div>
    <div class="relative mx-auto grid max-w-7xl grid-cols-1 gap-8 md:grid-cols-3">
      <div>
        <p class="font-semibold text-white text-lg md:text-xl">${config.siteName}</p>
        <p class="mt-3 text-xs md:text-sm text-white/75 prose-limit">${config.tagline}</p>
      </div>
      <div>
        <h4 class="font-semibold text-white text-base md:text-lg">章节</h4>
        <ul class="mt-3 flex flex-col gap-2">
          ${config.nav.flatMap((section) =>
            section.items.map(
              (item) => html`<li class="text-xs md:text-sm">
                <a
                  class="text-white/75 transition-colors duration-200 ease-out hover:text-white"
                  href="${item.href}"
                  >${item.label}</a
                >
              </li>`
            )
          )}
        </ul>
      </div>
      <div>
        <h4 class="font-semibold text-white text-base md:text-lg">相关</h4>
        <ul class="mt-3 flex flex-col gap-2 text-xs md:text-sm">
          <li>
            <a
              class="text-white/75 transition-colors duration-200 ease-out hover:text-white"
              href="https://waline.js.org/"
              rel="noreferrer noopener"
              >Waline 文档</a
            >
          </li>
          <li>
            <a
              class="text-white/75 transition-colors duration-200 ease-out hover:text-white"
              href="https://github.com/termermc/wunphile"
              rel="noreferrer noopener"
              >Wunphile（本站用的 SSG）</a
            >
          </li>
        </ul>
      </div>
    </div>
    <div
      class="relative mx-auto mt-10 flex max-w-7xl flex-col gap-2 border-t border-white/15 pt-6 text-xs text-white/60"
    >
      <span>评论数据以 CSV 分片存放在 GitHub 仓库；备份数据仓库即备份全部评论。</span>
      <span class="font-mono break-all">${config.waline.serverURL}</span>
    </div>
  </footer>
`

export default Footer
