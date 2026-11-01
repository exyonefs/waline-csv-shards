/**
 * Stripe Style 样式片段。
 *
 * 交互与容器样式集中在此处定义，页面组件只做组合，避免风格漂移。
 *
 * 约定：
 *  - 主色 #635bff（Stripe 紫）、正文 #0a2540（深蓝）、页面底色 #f6f9fc；
 *    强调色 #00d4ff（青）、#7a73ff（浅紫）、#80e9ff（亮青）。
 *  - 卡片是白底 + rounded-xl + 多层低透明度阴影；inset 阴影只出现在按下态。
 *  - 按钮是 rounded-full 胶囊，静止态带 inset 高光，hover 只上浮、不放大。
 *  - 所有过渡统一 ease-out，不用 ease-in-out。
 *  - 正文行宽不超过 68ch，见 style.css 的 .prose-limit。
 *
 * 说明：正文色用 text-gray-600（#4b5563），在 #f6f9fc 上对比度约 7.2:1，
 * 在白底上约 7.6:1，满足 WCAG 2.1 AA。gray-400 不足 3:1，不用于正文。
 */

/** 卡片阴影：两层叠加，低透明度，避免出现粗糙的硬阴影 */
export const SHADOW_CARD =
  'shadow-[0_2px_4px_rgba(0,0,0,0.04),0_8px_16px_rgba(0,0,0,0.08)]'

/** 卡片悬停阴影：整体上浮后加深 */
export const SHADOW_CARD_HOVER = 'shadow-[0_12px_30px_rgba(0,0,0,0.08)]'

/** 按钮静止态：外发光 + 顶部 inset 高光，模拟凸面玻璃受光 */
export const SHADOW_BUTTON =
  'shadow-[0_2px_5px_rgba(99,91,255,0.4),inset_0_1px_0_rgba(255,255,255,0.2)]'

/** 按钮按下态：外发光消失，只留内凹阴影 */
export const SHADOW_PRESSED = 'active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]'

/** 小元素（复制按钮、章节标签）的 hairline 阴影，同样保留 inset 高光 */
export const SHADOW_HAIRLINE =
  'shadow-[0_1px_2px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.2)]'

/** 过渡：ease-out，出发快、落地轻 */
export const EASE_300 = 'transition-all duration-200 duration-[300ms] ease-out'
export const EASE_400 = 'transition-all duration-200 duration-[400ms] ease-out'

/** 按钮悬停上浮 2px（不放大），过渡 300ms */
export const LIFT = `hover:-translate-y-0.5 ${EASE_300}`

/** 按钮按下：回到原位并轻微缩小，配合 SHADOW_PRESSED */
export const PRESS = 'active:scale-[0.98] active:translate-y-0'

/** 卡片悬停上浮 4px，过渡 400ms */
export const FLOAT = `hover:-translate-y-1 ${EASE_400}`

/** 卡片：白底 + 适中圆角 + 多层阴影 */
export const cardClass = [
  'bg-white rounded-xl shadow-lg border border-gray-200 p-6 md:p-8',
  'flex flex-col',
  '!shadow-[0_2px_4px_rgba(0,0,0,0.04),0_8px_16px_rgba(0,0,0,0.08)]',
].join(' ')

/** 可交互卡片：悬停整体浮起 */
export const cardInteractiveClass = [
  cardClass,
  'hover:-translate-y-1 hover:!shadow-[0_12px_30px_rgba(0,0,0,0.08)]',
  EASE_400,
].join(' ')

/** 内容面板：与卡片共用同一套白底表面 */
export const panelClass = cardClass

/** 侧栏容器：白底卡片，避免目录文字直接压在网格背景上 */
export const sidebarClass = [
  'bg-white rounded-xl shadow-lg border border-gray-200 p-5',
  '!shadow-[0_2px_4px_rgba(0,0,0,0.04),0_8px_16px_rgba(0,0,0,0.08)]',
].join(' ')

/** 代码块表面：深色 */
export const codeSurfaceClass = [
  'rounded-xl bg-[#0a2540] overflow-hidden',
  '!shadow-[0_2px_4px_rgba(0,0,0,0.04),0_8px_16px_rgba(0,0,0,0.08)]',
].join(' ')

/** 输入框 */
export const inputClass = [
  'w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-900',
  'placeholder:text-gray-500',
  'focus:outline-none focus:ring-2 focus:ring-[#635BFF]/20 focus:border-[#635BFF]',
  'transition-all',
].join(' ')

/** 主按钮 */
export const primaryButton = [
  'inline-flex items-center justify-center gap-2 rounded-full px-6 py-3',
  'text-sm md:text-base font-semibold',
  'bg-[#635bff] text-white',
  SHADOW_BUTTON,
  SHADOW_PRESSED,
  LIFT,
  PRESS,
].join(' ')

/** 主按钮（导航等紧凑位置） */
export const primaryButtonSmall = [
  'inline-flex items-center justify-center gap-2 rounded-full px-5 py-2',
  'text-sm font-semibold',
  'bg-[#635bff] text-white',
  SHADOW_BUTTON,
  SHADOW_PRESSED,
  LIFT,
  PRESS,
].join(' ')

/** 次按钮 */
export const secondaryButton = [
  'inline-flex items-center justify-center gap-2 rounded-full px-6 py-3',
  'text-sm md:text-base font-semibold',
  'border border-gray-200 bg-white text-[#0a2540]',
  SHADOW_BUTTON,
  SHADOW_PRESSED,
  LIFT,
  PRESS,
].join(' ')

/** 标签 / 小型操作 */
export const chipClass = [
  'inline-flex items-center gap-2 rounded-full px-4 py-2',
  'text-xs md:text-sm font-semibold',
  'border border-gray-200 bg-white text-[#0a2540]',
  SHADOW_HAIRLINE,
  SHADOW_PRESSED,
  LIFT,
  PRESS,
].join(' ')

/** 正文文字：加大字号并加深颜色，与背景拉开对比度 */
export const textBodyClass = 'text-base md:text-lg text-[#334155]'

/** 次级正文：卡片内说明、辅助文字 */
export const textAuxClass = 'text-sm md:text-base text-[#475569]'

/** 侧栏目录链接 */
export const navLinkClass =
  'block rounded-lg px-3 py-2 text-sm text-gray-600 transition-all duration-200 ease-out hover:bg-gray-50 hover:text-[#0a2540]'

/** 侧栏目录链接（当前页） */
export const navLinkActiveClass =
  'block rounded-lg px-3 py-2 text-sm font-semibold text-[#635bff] bg-[#635bff]/10'

/** 正文行内代码：浅底 + 细描边，像一枚小 chip */
export const inlineCodeClass =
  'font-mono text-[0.75rem] md:text-[0.8125rem] text-[#0a2540] bg-[#f1f5f9] border border-gray-200 rounded px-1.5 py-0.5 break-words'

/** 图标槽：浅紫底 + 深紫图标，悬停时图标放大 */
export const iconSlotClass =
  'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#635bff]/10 text-[#635bff] group-hover:scale-110 transition-transform duration-[400ms] ease-out'

/** 序号槽：所在卡片 hover 时整槽翻转为紫底白字 */
export const stepSlotClass =
  'mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#635bff]/10 font-mono text-sm font-semibold text-[#635bff] transition-colors duration-300 ease-out group-hover:bg-[#635bff] group-hover:text-white'

/** 深色代码面上的复制按钮 */
export const codeButtonClass = [
  'inline-flex items-center gap-1.5 rounded-full px-3 py-1',
  'text-xs font-semibold',
  'border border-white/15 bg-white/5 text-[#c3d0e0]',
  'transition-all duration-200 ease-out',
  'hover:bg-white/10 hover:text-white',
  'active:scale-[0.98]',
].join(' ')
