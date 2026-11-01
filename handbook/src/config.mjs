/**
 * 站点配置。
 *
 * WALINE_SERVER_URL 在 Netlify 的 Site configuration → Environment variables 里配。
 * Wunphile 在构建期执行 JS，所以构建时读到的环境变量会直接写进产物 HTML，
 * 不需要任何客户端运行时配置。
 */
const serverURL =
  process.env.WALINE_SERVER_URL ?? 'https://waline-netlify.netlify.app/.netlify/functions/comment'

/**
 * 手册目录：按「开始 → 配置与数据 → 运维 → 深入实现 → 参考」分段，
 * 每段内部是阅读顺序，段与段之间没有依赖，可以从任意一段进入。
 */
export const config = {
  siteName: 'Waline on Netlify 手册',
  tagline: '评论数据以 CSV 分片存放在 GitHub 仓库：不引入数据库，也不引入对象存储',
  waline: {
    serverURL,
    lang: 'zh-CN',
    emoji: [
      'https://unpkg.com/@waline/emojis@1.3.0/weibo',
      'https://unpkg.com/@waline/emojis@1.3.0/bilibili',
    ],
  },
  nav: [
    {
      group: '开始',
      items: [
        { label: '概览', href: '/' },
        { label: '快速开始', href: '/start/' },
        { label: '部署', href: '/deploy/' },
      ],
    },
    {
      group: '配置与数据',
      items: [
        { label: '环境变量', href: '/env/' },
        { label: '数据布局', href: '/data/' },
      ],
    },
    {
      group: '运维',
      items: [{ label: '备份与运维', href: '/ops/' }],
    },
    {
      group: '深入实现',
      items: [
        { label: '可靠性设计', href: '/design/' },
        { label: '源码走读', href: '/source/' },
      ],
    },
    {
      group: '参考',
      items: [{ label: '限制与排查', href: '/limits/' }],
    },
  ],
}

/** 扁平化的阅读顺序，用于上一章 / 下一章 */
export const flatNav = config.nav.flatMap((section) => section.items)

export default config
