/**
 * Waline CSV Shards 手册 —— 无数据库分片式存储方案。
 *
 *   node handbook/site.mjs          构建到 handbook/dist/
 *   node handbook/site.mjs --dev   本地开发服务器
 */
import { createRequire, syncBuiltinESMExports } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Wunphile 1.x 在 Windows 上执行 path.resolve('/404.html') 得到 D:\404.html，
// 随后断言「以 / 开头」而抛错。这里把原先 handbook/tool 的垫片内联，
// 同步到 node:path 的 ESM live bindings，然后才动态加载 wunphile。
const require = createRequire(import.meta.url)
const nodePath = require('node:path')
const nativeResolve = nodePath.resolve
const nativeRelative = nodePath.relative
nodePath.resolve = (...args) =>
  args.length === 1 && typeof args[0] === 'string' && args[0].startsWith('/')
    ? args[0]
    : nativeResolve(...args)
nodePath.relative = (...args) => nativeRelative(...args).split(nodePath.sep).join('/')
syncBuiltinESMExports()

const { Wunphile, html } = await import('wunphile')

// ---------------------------------------------------------------------------
// 配置
// ---------------------------------------------------------------------------

const config = {
  siteName: 'Waline CSV Shards 手册',
  subtitle: 'Netlify + GitHub 免数据库 CSV 分片存储方案',
  author: 'exyone',
  serverURL:
    process.env.WALINE_SERVER_URL ??
    'https://cmt.exyon.ee/api',
}

// ---------------------------------------------------------------------------
// 源码片段：构建期从仓库真实文件截取，实现改动后文档随之变化
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readRepoFile(relPath) {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8')
}

function excerpt(relPath, { from, to } = {}) {
  const text = readRepoFile(relPath)
  if (!from) return text.replace(/\s+$/, '')

  const start = text.indexOf(from)
  if (start === -1) {
    throw new Error(`[handbook] ${relPath} 里找不到起始标记：${JSON.stringify(from)}`)
  }
  if (!to) return text.slice(start).replace(/\s+$/, '')

  const end = text.indexOf(to, start + from.length)
  if (end === -1) {
    throw new Error(`[handbook] ${relPath} 里找不到结束标记：${JSON.stringify(to)}`)
  }
  return text.slice(start, end).replace(/\s+$/, '')
}

// ---------------------------------------------------------------------------
// 内联样式（原 assets/style.css，去掉 Waline 评论区主题，改为连续文档排版）
// String.raw 保留反斜杠，CSS/JS 里的转义序列不会被模板字符串吃掉。
// ---------------------------------------------------------------------------

const STYLE = String.raw`
:root {
  --purple: #635bff;
  --navy: #0a2540;
  --text: #334155;
  --muted: #64748b;
  --line: #e2e8f0;
  --soft: #f8fafc;
  --code-bg: #0a2540;
  --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;
}

* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  background: #ffffff;
  color: var(--text);
  font: 16px/1.75 -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue',
    'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
::selection { background: rgba(99, 91, 255, 0.18); color: var(--navy); }
[id] { scroll-margin-top: 1.5rem; }
:focus-visible { outline: 2px solid var(--purple); outline-offset: 3px; }

* { scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent; }
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  background-clip: content-box;
  border: 3px solid transparent;
  border-radius: 999px;
}

.doc { max-width: 54rem; margin: 0 auto; padding: 3rem 1.5rem 5rem; }
.doc-head { border-bottom: 2px solid var(--navy); padding-bottom: 1.5rem; margin-bottom: 2.5rem; }
.doc-head h1 {
  font-size: 2.1rem; line-height: 1.25; font-weight: 700; letter-spacing: -0.015em;
  color: var(--navy); margin: 0 0 0.6rem;
}
.doc-subtitle { font-size: 1.1rem; margin: 0 0 0.4rem; }
.doc-head .doc-intro { margin: 1.25rem 0 0; }
.doc-head .doc-intro + .doc-intro { margin-top: 0.6rem; }

.chapter { margin-top: 3rem; padding-top: 3rem; border-top: 1px solid var(--line); }
.chapter:first-of-type { margin-top: 0; padding-top: 0; border-top: 0; }
.chapter > h2 {
  font-size: 1.85rem; line-height: 1.3; font-weight: 700; letter-spacing: -0.015em;
  color: var(--navy); margin: 0 0 1rem;
}
.chapter-no {
  display: inline-block; margin-right: 0.85rem; vertical-align: 0.2em;
  font: 600 0.8125rem/1 var(--mono); letter-spacing: 0.08em; color: var(--purple);
}
.chapter > .lead, .block > .lead { color: var(--muted); margin: 0 0 1.25rem; }

.block { margin: 2.25rem 0; }
.block > h3 {
  font-size: 1.35rem; line-height: 1.4; font-weight: 700; letter-spacing: -0.015em;
  color: var(--navy); margin: 0 0 0.6rem;
}
p { margin: 0 0 1rem; max-width: 78ch; }
h1, h2, h3, h4 { letter-spacing: -0.015em; }
h4 { font-size: 1.05rem; color: var(--navy); margin: 0 0 0.3rem; }
a { color: var(--purple); text-decoration: underline; text-underline-offset: 2px; }
a:hover { color: #5148d9; }

.inline-code {
  font: 0.85em/1.5 var(--mono); background: #f1f5f9; border: 1px solid var(--line);
  border-radius: 4px; padding: 1px 6px; overflow-wrap: anywhere;
}

.stack { margin: 0 0 1rem; }
.stack-item { margin: 0 0 1.25rem; }
.stack-item p { margin: 0; }
.stat { margin: 0 0 0.5rem; }
.stat strong { font: 600 1.35rem/1.4 var(--mono); color: var(--purple); }

ul, ol { padding-left: 1.5rem; margin: 0 0 1rem; }
li { margin-bottom: 0.55rem; max-width: 78ch; }
li p { margin: 0; }

.callout {
  margin: 1.5rem 0; padding: 0.85rem 1rem; border-left: 3px solid var(--purple);
  background: var(--soft); border-radius: 0 0.5rem 0.5rem 0;
}
.callout.warn { border-left-color: #d97706; }
.callout > strong { display: block; color: var(--navy); margin-bottom: 0.3rem; }
.callout p { margin: 0; }

.table-wrap { overflow-x: auto; margin: 1.25rem 0; }
table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
th, td {
  padding: 0.6rem 0.75rem; text-align: left; vertical-align: top;
  border-bottom: 1px solid var(--line); min-width: 8rem;
}
th { background: var(--soft); color: var(--navy); font-weight: 600; white-space: nowrap; }
tbody tr:nth-child(odd) { background: #fbfcfe; }

.code-block { margin: 1.25rem 0; }
.code-surface { background: var(--code-bg); border-radius: 0.6rem; overflow: hidden; }
.code-bar {
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
  padding: 0.5rem 1rem; border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
}
.code-name {
  font: 0.75rem/1.5 var(--mono); color: #8ea0b8;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.copy-btn {
  flex: none; border: 1px solid rgba(255, 255, 255, 0.15); background: rgba(255, 255, 255, 0.05);
  color: #c3d0e0; border-radius: 999px; padding: 0.15rem 0.75rem;
  font-size: 0.75rem; font-weight: 600; cursor: pointer;
  transition: background-color 0.2s ease-out, color 0.2s ease-out;
}
.copy-btn:hover { background: rgba(255, 255, 255, 0.1); color: #ffffff; }
pre {
  margin: 0; padding: 1rem 1.25rem; overflow-x: auto;
  font: 0.8125rem/1.7 var(--mono); color: #dbe4f0;
}
pre code { font: inherit; }
pre, code, .inline-code, .code-name, .stat strong { font-family: var(--mono); }
.tok-string { color: #80e9ff; }
.tok-comment { color: #7c8ba1; }
.tok-number { color: #c3b5ff; }

.builder { margin: 1.25rem 0; }
.builder label { display: block; font-weight: 600; color: var(--navy); margin-bottom: 0.5rem; }
.builder input {
  width: 100%; padding: 0.7rem 0.9rem; border: 1px solid #cbd5e1; border-radius: 0.5rem;
  background: var(--soft); color: #0f172a; font-size: 0.95rem;
}
.builder input:focus { outline: 2px solid rgba(99, 91, 255, 0.35); border-color: var(--purple); }
.builder .hint { font-size: 0.9rem; color: var(--muted); margin: 0.5rem 0 1rem; }

.doc-foot {
  margin-top: 4rem; padding-top: 1.5rem; border-top: 1px solid var(--line);
  font-size: 0.875rem; color: var(--muted);
}
.doc-foot p { margin: 0 0 0.5rem; }

@media (max-width: 640px) {
  .doc { padding: 2rem 1.1rem 3.5rem; }
  .doc-head h1 { font-size: 1.7rem; }
  .chapter > h2 { font-size: 1.5rem; }
  .block > h3 { font-size: 1.2rem; }
}
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
}
`

// ---------------------------------------------------------------------------
// 内联脚本（原 assets/site.js）：复制代码块、代码着色、域名生成接入片段
// ---------------------------------------------------------------------------

const SCRIPT = String.raw`
/**
 * 页面的少量交互：复制代码块、代码着色、按域名生成接入片段。
 *
 * 没有用 Wunphile 的 client behavior：1.2.3 的 behavior loader 在同一页出现
 * 两个 behavior 组件时会把两条 import 语句直接拼在一起（中间没有分隔符），
 * 生成的是非法 JS。这里用一个内联脚本 + 事件委托代替，零构建步骤。
 */

const flash = (button, text) => {
  const idle = button.dataset.idleLabel || button.textContent
  button.dataset.idleLabel = idle
  button.textContent = text
  setTimeout(() => {
    button.textContent = idle
  }, 1600)
}

const copyText = (value) => {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(value)
  }
  // http:// 的局域网开发服务器不是安全上下文，回退到 execCommand
  return new Promise((resolve, reject) => {
    const area = document.createElement('textarea')
    area.value = value
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    ok ? resolve() : reject(new Error('copy failed'))
  })
}

// ---------------------------------------------------------------------------
// 代码着色
//
// 只做「字符串 / 行注释 / 数字」三类标记，逐字符扫描，不拼接 HTML。
// 每次着色前先把 <code> 重置为纯文本，因此重复调用是幂等的。
// ---------------------------------------------------------------------------

const isDigit = (ch) => ch >= '0' && ch <= '9'
const isIdent = (ch) => typeof ch === 'string' && /[A-Za-z0-9_$.]/.test(ch)
const isSpace = (ch) => typeof ch === 'string' && /\s/.test(ch)

function scanQuoted(text, start) {
  const quote = text[start]
  let index = start + 1

  while (index < text.length && text[index] !== quote && text[index] !== '\n') {
    if (text[index] === '\\') index += 1
    index += 1
  }

  return text[index] === quote ? index + 1 : index
}

function tokenize(text) {
  const tokens = []
  let plain = ''
  let index = 0

  const flushPlain = () => {
    if (plain) {
      tokens.push({ type: null, value: plain })
      plain = ''
    }
  }

  while (index < text.length) {
    const char = text[index]

    if (char === '"' || char === "'" || char === '\x60') {
      const end = scanQuoted(text, index)
      flushPlain()
      tokens.push({ type: 'tok-string', value: text.slice(index, end) })
      index = end
      continue
    }

    const isHashComment = char === '#' && (index === 0 || isSpace(text[index - 1]))
    const isSlashComment = char === '/' && text[index + 1] === '/' && (index === 0 || isSpace(text[index - 1]))

    if (isHashComment || isSlashComment) {
      const end = text.indexOf('\n', index)
      flushPlain()
      tokens.push({ type: 'tok-comment', value: end === -1 ? text.slice(index) : text.slice(index, end) })
      index = end === -1 ? text.length : end
      continue
    }

    if (isDigit(char) && !isIdent(text[index - 1])) {
      let end = index
      while (end < text.length && /[0-9._]/.test(text[end])) end += 1
      flushPlain()
      tokens.push({ type: 'tok-number', value: text.slice(index, end) })
      index = end
      continue
    }

    plain += char
    index += 1
  }

  flushPlain()

  return tokens
}

function highlight(element) {
  if (!element) return

  const source = element.textContent || ''
  element.textContent = ''

  const fragment = document.createDocumentFragment()

  for (const token of tokenize(source)) {
    if (!token.type) {
      fragment.appendChild(document.createTextNode(token.value))
      continue
    }

    const span = document.createElement('span')
    span.className = token.type
    span.textContent = token.value
    fragment.appendChild(span)
  }

  element.appendChild(fragment)
}

const highlightAll = (root = document) => {
  for (const block of root.querySelectorAll('[data-code-block] code')) {
    highlight(block)
  }
}

// ---------------------------------------------------------------------------
// 复制按钮：委托到 document，动态插入的内容也能生效
// ---------------------------------------------------------------------------

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-copy]')
  if (!button) return

  const block = button.closest('[data-code-block]')
  const code = block && block.querySelector('code')
  if (!code) return

  copyText(code.textContent || '').then(
    () => flash(button, '已复制'),
    () => flash(button, '复制失败')
  )
})

// ---------------------------------------------------------------------------
// 域名 -> 接入片段
// ---------------------------------------------------------------------------

const builder = document.querySelector('[data-builder]')

if (builder) {
  const input = builder.querySelector('[data-domain-input]')
  const output = builder.querySelector('[data-snippet-output]')

  const render = () => {
    const host = input.value
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/\/+$/, '')
    const serverURL = host
      ? 'https://' + host + '/api'
      : 'https://<你的站点>/api'

    output.textContent = [
      '<link rel="stylesheet" href="https://unpkg.com/@waline/client@v3/dist/waline.css" />',
      '<div id="waline"></div>',
      '<script type="module">',
      "  import { init } from 'https://unpkg.com/@waline/client@v3/dist/waline.js';",
      '',
      '  init({',
      "    el: '#waline',",
      "    serverURL: '" + serverURL + "',",
      '  });',
      '<' + '/script>',
    ].join('\n')

    highlight(output)
  }

  builder.addEventListener('submit', (event) => event.preventDefault())
  input.addEventListener('input', render)
  render()
}

highlightAll()
`

// ---------------------------------------------------------------------------
// 文档组件：连续排版，不使用卡片 / 目录 / 序号槽等条目化设计
// ---------------------------------------------------------------------------

const code = (text) => html`<code class="inline-code">${text}</code>`

const P = (_, children) => html`<p>${children}</p>`

const List = ({ items }) => html`
  <ul>
    ${items.map((item) => html`<li>${item}</li>`)}
  </ul>
`

const Table = ({ head, rows }) => html`
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          ${head.map((cell) => html`<th scope="col">${cell}</th>`)}
        </tr>
      </thead>
      <tbody>
        ${rows.map(
          (row) => html`
            <tr>
              ${row.map((cell) => html`<td>${cell}</td>`)}
            </tr>
          `
        )}
      </tbody>
    </table>
  </div>
`

const CodeBar = ({ title }) => html`
  <div class="code-bar">
    <span class="code-name">${title}</span>
    <button type="button" data-copy aria-label="复制 ${title} 中的代码" class="copy-btn">复制</button>
  </div>
`

const CodeBlock = ({ title, code }) => html`
  <div data-code-block class="code-block">
    <div class="code-surface">
      ${CodeBar({ title })}
      <pre><code>${code}</code></pre>
    </div>
  </div>
`

const LiveCodeBlock = ({ title }) => html`
  <div data-code-block class="code-block">
    <div class="code-surface">
      ${CodeBar({ title })}
      <pre><code data-snippet-output></code></pre>
    </div>
  </div>
`

const Callout = ({ tone = 'info', title }, children) => html`
  <aside class="callout ${tone === 'warn' ? 'warn' : ''}">
    <strong>${title}</strong>
    <div>${children}</div>
  </aside>
`

const Steps = ({ items }) => html`
  <ol>
    ${items.map(
      (item) => html`
        <li>
          <strong>${item.title}</strong>
          ${item.body ? html`<div>${item.body}</div>` : ''}
        </li>
      `
    )}
  </ol>
`

const CardGrid = (_, children) => html`<div class="stack">${children}</div>`

const Panel = (_, children) => html`<div class="stack-item">${children}</div>`

const FeatureCard = ({ title, description }) => html`
  <div class="stack-item">
    <h4>${title}</h4>
    <p>${description}</p>
  </div>
`

const Stat = ({ value, label }) => html`<p class="stat"><strong>${value}</strong> ${label}</p>`

const ServerUrlBuilder = () => html`
  <form data-builder novalidate class="builder">
    <label for="waline-domain">你的 Netlify 站点域名</label>
    <input
      id="waline-domain"
      data-domain-input
      type="text"
      inputmode="url"
      autocomplete="url"
      placeholder="your-site.netlify.app"
    />
    <p class="hint">
      末尾不要带斜杠。已配置 ${code('/api')} 重定向，可直接用
      ${code('https://<你的站点>/api')}；完整函数路径同样有效。
    </p>
    ${LiveCodeBlock({ title: 'index.html' })}
  </form>
`

const Block = ({ title, lead }, children) => html`
  <section class="block">
    <h3>${title}</h3>
    ${lead ? html`<p class="lead">${lead}</p>` : ''}
    ${children}
  </section>
`

const Chapter = ({ no, id, title, lead }, children) => html`
  <section class="chapter" id="ch-${id}">
    <h2><span class="chapter-no">${no}</span>${title}</h2>
    ${lead ? html`<p class="lead">${lead}</p>` : ''}
    ${children}
  </section>
`

// ---------------------------------------------------------------------------
// 章节数据
// ---------------------------------------------------------------------------

const compareRows = [
  [
    '数据布局',
    'data/Comment.csv 一个文件',
    'data/comments/<xx>/<xxxx>.csv 按文章分片 + _manifest.csv',
  ],
  ['查询', '下载整个 CSV → JS 逐行过滤', '按分片族按需加载 + 内存索引，只碰命中分片'],
  ['写入', '重写整个 CSV', '只重写受影响分片，一个请求合并成一次 Git 提交'],
  [
    '并发安全',
    '无（后写覆盖先写）',
    '分片 SHA 校验 + ref 非快进拒绝 + 冲突自动合并重试',
  ],
  ['备份', '无', '每日快照 + 一键恢复 + 仓库瘦身'],
]

const benchRows = [
  [
    '单次评论列表查询（5 万条 / 990 个分片）',
    '1141.9 ms · 下载 22.79 MB',
    '0.20 ms · 下载 0 B',
  ],
  ['一次列表页完整渲染（5 万条）', '4547.9 ms · 下载 91.15 MB', '1.76 ms · 下载 0 B'],
  ['冷启动首次查询', '成本随全站数据量增长', '4 次 API 调用 · 167.6 KB · 75.8 ms'],
]

const termRows = [
  ['数据仓库', '放 data/ 下全部 CSV 分片的 GitHub 仓库，必须和站点仓库分开'],
  ['分片', '一个 CSV 文件，读写的最小单位'],
  ['分片族', '同一哈希前缀下的全部分片，对应一个 key 的取值范围'],
  ['规范分片', '由 key 算出族、该 key 的数据应该在的那个分片'],
  ['别名分片', '路径与里面数据的 key 对不上的分片，刷新时先登记、再搬回规范分片'],
  ['错位行', '留在非规范分片里的数据行，前台一条都读不到'],
  ['manifest', '每张表一份的 _manifest.csv，记着分片路径、行数、SHA 与起止 key'],
  ['刷盘', '把内存里攒下的变更合并成一次 Git 提交，推到数据仓库'],
]

const quickStart = [
  {
    title: '新建一个【空的 GitHub 仓库】当数据仓库（建议 Private）',
    body: '站点仓库与数据仓库必须分开，原因见下方说明。',
  },
  {
    title: '申请一个 Fine-grained token，只给这个仓库 Contents: Read and write',
    body: html`权限只勾 ${code('Contents: Read and write')}，别的都不要。`,
  },
  {
    title: 'Fork 本仓库 → Netlify "Import from Git" → 填好环境变量 → 部署',
    body: html`必填 ${code('GITHUB_TOKEN')} 与 ${code('GITHUB_REPO')}，建议再设一个 ${code('JWT_TOKEN')}。`,
  },
  {
    title: '打开 /ui/register 注册管理员',
    body: html`即 ${code('https://<站点>/.netlify/functions/waline/ui/register')}。第一个注册的账号自动成为管理员。`,
  },
  {
    title: '前端把 serverURL 指到 https://<站点>/api',
    body: html`也可以写完整函数路径 ${code('https://<站点>/.netlify/functions/waline')}。末尾不要带斜杠。`,
  },
]

const tokenRows = [
  ['Token name', '随意，例如 waline-comments'],
  ['Expiration', '建议 90 天或自定义（到期不换，评论会开始 500）'],
  ['Repository access', 'Only select repositories → 选上一步那个数据仓库'],
  ['Permissions → Contents', 'Read and write'],
]

const netlifyRows = [
  ['Build command', '留空（依赖由 Netlify 自动安装并打包函数）'],
  ['Publish directory', '留空（默认只部署 Functions；想把这份手册一起发上去，见本章末）'],
  ['Functions directory', 'netlify/functions/（已在 netlify.toml 里）'],
  ['Node version', '24（已在 netlify.toml 里）'],
]

const walineSnippet = `<link rel="stylesheet" href="https://unpkg.com/@waline/client@v3/dist/waline.css" />
<div id="waline"></div>
<script type="module">
  import { init } from 'https://unpkg.com/@waline/client@v3/dist/waline.js';

  init({
    el: '#waline',
    serverURL: '${config.serverURL}',
  });
</script>`

const apiRedirect = `[[redirects]]
  from = "/api"
  to = "/.netlify/functions/waline"
  status = 200

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/waline/:splat"
  status = 200`

const netlifyToml = `[build]
  command = "npm run site:build"
  publish = "handbook/dist"`

const checkList = [
  {
    title: '打开函数根路径',
    body: html`${code('https://<站点>/.netlify/functions/waline')} 为 Waline
      自带示例页，可直接提交一条评论。`,
  },
  {
    title: '检查数据仓库中的文件',
    body: html`应出现 ${code('data/comments/<xx>/<xxxx>.csv')} 与
      ${code('data/comments/_manifest.csv')}。`,
  },
  {
    title: '查询一次运行指标',
    body: html`调用 ${code('GET /csv-depot/stats')}（需要管理员 token），确认
      ${code('shards.Comment ≥ 1')} 且 ${code('pending = 0')}。`,
  },
  {
    title: '登录后台',
    body: html`通过 ${code('/ui/login')} 登录，确认可以看到刚才提交的评论。`,
  },
  { title: '刷新前端页面', body: '评论应正常显示。' },
]

const requiredRows = [
  [
    'GITHUB_TOKEN',
    '必需',
    'github_pat_xxx',
    '需要对数据仓库具备 contents: read 与 write 权限',
  ],
  [
    'GITHUB_REPO',
    '必需',
    'owner/repo',
    '数据仓库；填入完整 URL 或带 .git 后缀时会自动归一化',
  ],
  ['GITHUB_BRANCH', '可选', 'main', '数据所在的分支名称'],
  [
    'JWT_TOKEN',
    '建议',
    '一串随机字符串',
    '管理员登录态的签名密钥。未设置时每次重新部署都需要重新登录，且会退化为使用 GITHUB_TOKEN 作为密钥',
  ],
]

const storeRows = [
  ['CSV_DEPOT_DIR', 'data', '数据仓库中的数据根目录'],
  ['SHARD_MAX_ROWS', '2000', '单个分片的行数上限，超过后裂变出新分片'],
  ['SHARD_HASH_LEN', '2', '一级目录的哈希前缀长度；取值越大，分片越多、每片越小'],
  [
    'FLUSH_INTERVAL',
    '30000',
    '定时刷盘间隔（毫秒）。serverless 环境下主要依赖「响应前刷盘」',
  ],
  ['MAX_BATCH_SIZE', '50', '单次 Git 提交最多包含的分片数量'],
  ['MAX_RETRIES', '3', '一次刷盘的最大尝试次数，包含冲突后的重试'],
  [
    'CSV_CACHE_TTL',
    '60000',
    '内存缓存的有效期（毫秒）；到期后重新检查 manifest 是否变化',
  ],
  ['DEDUP_WINDOW_SECONDS', '60', '重复提交的去重窗口；设为 0 表示关闭去重'],
  ['SNAPSHOT_KEEP_DAYS', '30', '快照保留天数；设为 0 表示关闭快照功能'],
  ['SNAPSHOT_HOUR', '3', '每日快照的触发时点（本地时间的整点）'],
  ['GITHUB_API_BASE', 'https://api.github.com', '仅用于测试环境或自建代理'],
]

const walineRows = [
  ['SITE_NAME / SITE_URL', '站点名称与地址，用于邮件通知中的链接'],
  ['SECURE_DOMAINS', '允许嵌入的域名列表，用于防止后端被第三方站点盗用'],
  ['COMMENT_AUDIT', '为 true 时新评论默认处于 waiting 状态，需要管理员批准'],
  ['AKISMET_KEY', '反垃圾评论服务的密钥'],
  ['SMTP_SERVICE / SMTP_USER / SMTP_PASS / AUTHOR_EMAIL', '邮件通知与找回密码'],
]

const envToml = `[build.environment]
  NODE_VERSION = "24"

  # Waline 运行所需
  GITHUB_TOKEN = "github_pat_xxx"
  GITHUB_REPO = "your-name/waline-data"
  GITHUB_BRANCH = "main"
  JWT_TOKEN = "一串随机字符串"

  # 存储层可调参数（示例）
  SHARD_MAX_ROWS = "2000"
  CSV_CACHE_TTL = "60000"

  # 手册构建期读取
  WALINE_SERVER_URL = "https://<你的站点>/api"`

const tree = `data/                             # 数据根目录（CSV_DEPOT_DIR，默认 data）
├── comments/                     # Comment 表
│   ├── ab/
│   │   ├── abcd.csv              # 分片：同一篇文章的评论都在这一族里
│   │   └── abcd-1.csv            # 行数达到 SHARD_MAX_ROWS 后裂变出的分片
│   └── _manifest.csv             # 分片清单
├── users/                        # Users 表
│   ├── a1/
│   │   └── a1.csv
│   └── _manifest.csv
├── counters/                     # Counter 表（阅读量等）
│   ├── 3f/
│   │   └── 3f9c.csv
│   └── _manifest.csv
└── _snapshots/                   # 每日快照：一天一个清单文件（path,sha）
    └── 2026-09-25.csv`

const shardRuleRows = [
  ['Comment', 'url', 'comments/<sha1(url)[0:2]>/<sha1(url)[0:4]>.csv'],
  ['Counter', 'url', 'counters/<sha1(url)[0:2]>/<sha1(url)[0:4]>.csv'],
  ['Users', 'objectId', 'users/<objectId[0:2]>/<objectId[0:2]>.csv'],
]

const columnRows = [
  [
    'Comment',
    'objectId, user_id, comment, insertedAt, ip, link, mail, nick, pid, rid, status, ua, url, createdAt, updatedAt',
  ],
  [
    'Users',
    'objectId, display_name, email, password, type, url, avatar, label, github, twitter, facebook, google, weibo, qq, oidc, createdAt, updatedAt',
  ],
  ['Counter', 'objectId, time, url, createdAt, updatedAt'],
]

const manifestCsv = `shard_path,row_count,sha,updated_at,min_key,max_key
comments/ab/abcd.csv,1832,3f9c…,2026-09-25T10:00:00.000Z,/posts/hello,/posts/hello`

const migrateScript = `// migrate.js —— 用法：node migrate.js ./waline-data/data
//               参数为数据仓库中的 data 目录（内含 Comment.csv / Counter.csv / Users.csv）
const fs = require('node:fs');
const path = require('node:path');
const { ShardManager, DATE_FIELDS } = require('./overlay/csv-depot/shard-manager');
const { gitBlobSha } = require('./overlay/csv-depot/github-client');
const { TABLES } = require('./overlay/csv-depot/csv-shard-cache');

const DATA_DIR = path.resolve(process.argv[2]);
const LEGACY = { Comment: 'Comment.csv', Counter: 'Counter.csv', Users: 'Users.csv' };
const manager = new ShardManager({ depotDir: 'data', shardMaxRows: 2000, hashLen: 2 });
const toFsPath = (repoPath) => path.join(DATA_DIR, repoPath.slice(manager.depotDir.length + 1));

for (const table of TABLES) {
  const src = path.join(DATA_DIR, LEGACY[table]);

  if (!fs.existsSync(src)) {
    console.log(table + '：没有旧文件，跳过');
    continue;
  }

  const shards = new Map();

  for (const record of manager.parseShard(fs.readFileSync(src, 'utf8'))) {
    const row = manager.normalizeRow(table, record);

    // 旧数据的时间为 Date.toString()，统一转为 ISO 8601
    for (const field of DATE_FIELDS) {
      if (!row[field]) continue;
      const t = Date.parse(row[field]);
      if (!Number.isNaN(t)) row[field] = new Date(t).toISOString();
    }
    if (!row.objectId) continue;

    // 填满优先：基础分片 → -1 → -2 …
    const prefix = manager.shardPrefix(table, row[manager.shardKeyField(table)] ?? '');
    let target = null;
    for (let suffix = 0; suffix < 4096; suffix += 1) {
      const candidate = suffix === 0 ? prefix + '.csv' : prefix + '-' + suffix + '.csv';
      if (!shards.has(candidate)) { shards.set(candidate, []); target = candidate; break; }
      if (shards.get(candidate).length < manager.shardMaxRows) { target = candidate; break; }
    }
    shards.get(target).push(row);
  }

  const entries = new Map();

  for (const [shardPath, rows] of shards) {
    const content = manager.serializeShard(table, rows, manager.buildColumns(table, rows));
    const target = toFsPath(shardPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
    entries.set(shardPath, manager.manifestEntry(table, shardPath, rows, gitBlobSha(content)));
  }

  const manifest = toFsPath(manager.manifestPath(table));
  fs.mkdirSync(path.dirname(manifest), { recursive: true });
  fs.writeFileSync(manifest, manager.serializeManifest(entries), 'utf8');
  console.log(table + '：' + [...shards.values()].reduce((n, r) => n + r.length, 0) + ' 行 → ' + shards.size + ' 个分片');
}`

const migrateSteps = [
  {
    title: '提交并推送数据仓库',
    body: '站点读取的是 GitHub 上的分支，本地修改必须推送后才会生效。',
  },
  {
    title: '删除三个旧文件',
    body: html`${code('data/Comment.csv')}、${code('data/Counter.csv')}、${code('data/Users.csv')}：保留不会被读取，但会持续被快照携带。`,
  },
  {
    title: '删除引用旧路径的快照',
    body: html`${code('_snapshots/')} 下引用 ${code('data/Comment.csv')}
      的那些：恢复它们会把旧布局覆盖回去，导致评论再次读不到。`,
  },
  {
    title: '核对数据并补一张快照',
    body: html`访问一次站点，用 ${code('GET /csv-depot/stats')}
      确认分片数与评论条数符合预期，然后创建一张新快照。`,
  },
]

const opsRows = [
  ['POST', '/csv-depot/snapshot', '创建快照，并清理超过保留天数的快照'],
  ['GET', '/csv-depot/snapshot', '列出已有快照的日期'],
  ['POST', '/csv-depot/restore', '按快照覆盖恢复；日期通过 body 或 query 的 date=YYYY-MM-DD 传入'],
  ['POST', '/csv-depot/compact', '把行数回落的分片族压回基础分片'],
  [
    'POST',
    '/csv-depot/rebuild',
    '以数据仓库中的真实文件为准核对分片并修正 manifest，用于人工修改过仓库之后',
  ],
  [
    'POST',
    '/csv-depot/repair',
    '把错位分片的行搬回规范分片并返回搬迁报告（正常情况下刷新时自动执行）',
  ],
  ['POST', '/csv-depot/flush', '手动把内存中待提交的变更落盘'],
  [
    'GET',
    '/csv-depot/stats',
    '运行指标：提交 / 冲突 / 重试 / 回滚次数、GitHub 请求数、各表分片数、待提交数、未归位的错位分片数（misplaced）',
  ],
  [
    'POST',
    '/csv-depot/reset',
    '不可逆：丢弃全部历史提交，只保留当前数据；需要显式传入 confirm=1',
  ],
]

const curlSnippet = `BASE=https://<站点>/.netlify/functions/waline/csv-depot
TOKEN=<后台登录后浏览器里拿到的 token>

curl -X POST "$BASE/snapshot" -H "Authorization: Bearer $TOKEN"
curl "$BASE/snapshot" -H "Authorization: Bearer $TOKEN"
curl "$BASE/stats" -H "Authorization: Bearer $TOKEN"
curl -X POST "$BASE/restore?date=2026-09-25" -H "Authorization: Bearer $TOKEN"
# 仓库瘦身：丢弃历史提交（confirm 为必填；快照默认一并丢弃，传 keepSnapshots=1 可保留）
curl -X POST "$BASE/reset?confirm=1" -H "Authorization: Bearer $TOKEN"`

const misplaced = `comments/fc/fca4.csv   sha1('/links/')    ← 新评论会写入这里
comments/1b/1bd2.csv   sha1('/friends/')  ← 迁移过来的旧评论留在这里，读不到`

const healSteps = [
  {
    title: '登记为别名分片',
    body: html`刷新时若 manifest 中某条记录的 ${code('min_key === max_key')}
      ，却无法由该 key 哈希到这个文件所在的族，就把该文件登记为该 key 规范族的别名分片，旧评论随即变为可读。`,
  },
  {
    title: '在同一次刷新中搬回规范分片',
    body: '全部错位行被搬回各自的规范分片，并在下一次提交中写入正确文件；旧文件被清空后删除，别名登记随之消失。',
  },
  {
    title: '混合多个 key 的文件走整表操作',
    body: html`第 1 步只覆盖「整片同一个 key」的情况。当一个文件中混合了多个 key
      时，由 ${code('POST /csv-depot/repair')}、${code('compact')}、${code('rebuild')}
      这类整表操作逐行核对并搬迁。`,
  },
]

const reliability = [
  {
    title: '响应前落盘',
    body: html`中间件在每次请求返回前执行 ${code('await flush()')}
      。Netlify / Lambda 实例在响应后会被冻结，仅依赖定时器刷盘不可靠。落盘失败时响应会被改写为
      5xx，不会让客户端认为「保存成功」；并发请求也不会因为复用在途提交而丢失自身写入。`,
  },
  {
    title: '写后读一致',
    body: html`变更先作用于内存（含索引）再异步提交。${code('add()')} 返回后立即执行
      ${code('select()')} 即可读到新数据，${code('add()')} 返回的主键也一定有效。`,
  },
  {
    title: '原子提交',
    body: '分片与 manifest 在同一次 Git Data API 提交中落地，要么全部生效，要么全部不生效。',
  },
  {
    title: '乐观锁',
    body: html`读取顺序固定为「先读 head、再读数据」，提交时以 ${code('force=false')}
      更新 ref。只要在读取数据之后有其他提交产生，本次非快进更新就会被 GitHub 拒绝。`,
  },
  {
    title: '冲突合并',
    body: html`被拒绝后重新拉取 manifest，只下载 sha
      发生变化的分片，按「本地优先 + 尊重本实例删除」的规则合并后重试（最多 ${code('MAX_RETRIES')}
      次，带退避）。计数类表（${code('Counter')}）例外：其数值列按「远端值 +
      本实例增量」合并，否则两个实例各加一次的阅读量会被后提交者覆盖掉一次。`,
  },
  {
    title: '失败回滚',
    body: '重试次数耗尽后，内存恢复到「最后一次提交成功」的状态并丢弃待提交标记，使进程内状态与远端重新一致，同时将错误抛给调用方。',
  },
  {
    title: '幂等去重',
    body: html`${code('mail + url + 内容哈希')} 相同且落在 ${code('DEDUP_WINDOW_SECONDS')}
      窗口内的提交直接返回既有记录，避免刷新或重放造成的重复写入。`,
  },
  {
    title: '限流友好',
    body: html`GitHub 次级限流（403 且响应体含 rate limit 文案）与 429 / 5xx
      都会退避重试并遵循 ${code('Retry-After')}；鉴权类错误不重试，直接返回错误。`,
  },
]

const diffRows = [
  [
    'CSV 列名',
    html`以上层 controller 实际读写的字段为准（${code('comment')}、${code('insertedAt')}、${code('link')}、${code('objectId')}
      等），而不采用「看起来更合理」的命名。`,
  ],
  [
    'update 支持函数返回补丁',
    html`上游 ${code('update(data, where)')} 在 ${code('data')}
      为函数时会丢弃返回值，导致 GitHub 存储下的阅读量（Counter）始终不增长。本实现同时支持「函数就地修改」与「函数返回补丁对象」。`,
  ],
  [
    'LIKE 转义正则元字符',
    html`上游把搜索关键字直接拼入 ${code('new RegExp')}，包含 ${code('(')}、${code('[')}
      等字符的关键词会抛出异常。本实现统一转义。`,
  ],
  [
    '> 执行真正的时间比较',
    html`上游使用 ${code('item[k] >= where[k][1]')}，当右侧为 ${code('Date')}
      时字符串与日期比较的结果为 ${code('NaN')}，条件恒为
      false（评论频率限制因此从未生效）。本实现对日期做显式归一化后按 ${code('>')} 语义比较。`,
  ],
  [
    '动态列不丢失',
    html`上游写盘使用 ${code('headers: true')}
      ，会丢弃首个写入行之外的额外字段（${code('sticky')}、${code('like')}、${code('2fa')}
      与自定义计数器类型都会丢失）。本实现使用「规范列 ∪ 动态列」。`,
  ],
]

const scopeRows = [
  [
    'select({ url }) 与 url IN (…)（评论列表、计数）',
    '命中族（一篇文章对应 1~2 个分片）',
  ],
  ['Users 按 objectId 查询（鉴权、用户资料）', '命中族（由 objectId 前两位决定的桶）'],
  [
    '后台列表、模糊搜索、按 pid / rid 删除、count({})',
    '整表（无法收敛到族，宁可多读也不返回不完整结果）',
  ],
]

const limitItems = [
  html`写入依赖 GitHub API：每条评论约 7 次调用（head / manifest 校验 + blob + tree + commit +
    ref）。令牌配额为 5000 次/小时，博客量级不受约束，但不适用于高频写入场景。`,
  html`数据仓库体积只增不减：每次写入都会重写整个分片并产生新的
    blob。可通过 ${code('POST /csv-depot/reset')} 周期性清零历史。`,
  html`后台「全部评论」列表会整表加载：数据量较大时首次打开较慢，因为按需加载无法收敛到族。`,
  html`跨实例读取存在 TTL 延迟（默认 60s）：A 实例写入后，B 实例最多 60s 后才能看到。`,
  '一个数据仓库只服务一个站点：多站点共用会让提交相互干扰。',
  html`数据中包含个人标识符（${code('mail')}、${code('ip')}、${code('ua')}
    ）：数据仓库建议设为 Private。`,
  html`不支持全文检索：后端只实现了 Waline 实际用到的 ${code('where')} 子集（等值、IN、NOT IN、LIKE、${code('>')}
    与 ${code('_complex')}）。`,
]

const troubleRows = [
  [
    '冷启动报 ERR_REQUIRE_ESM（函数返回 502，日志含 Init Error）',
    '某个依赖只提供 ESM 构建，却被 waline 在模块加载期同步 require；Lambda 的 Node 24 未开启 require(esm)',
    '本仓库已通过 overlay/plugin-emoji-cjs 垫片解决 1.43.4 的该类问题；升级 waline 后再次遇到时，用 --no-experimental-require-module 定位到具体包，再按同样方式添加垫片',
  ],
  [
    '提交评论返回 500「评论存储提交失败」',
    '向 GitHub 提交失败且重试次数耗尽；内存中的变更已回滚，数据不存在部分写入',
    '检查 GITHUB_TOKEN 的权限与有效期，以及 GitHub 当前状态',
  ],
  [
    '日志出现「无法访问 GitHub 仓库」',
    'GITHUB_REPO 不是 owner/repo 形式，或令牌未授权该仓库',
    '修正环境变量后重新部署',
  ],
  [
    '/ui/register 无法打开或返回 404',
    '路径不正确（需带 /api 前缀或使用完整函数路径），或函数未正常启动',
    '使用 /.netlify/functions/waline/ui/register；查看 Function 日志',
  ],
  [
    '页面读到的评论变少',
    '内存缓存尚未过期（默认 60s），其他实例刚写入的数据还未同步',
    '等待一个 CSV_CACHE_TTL 周期；或调小该值',
  ],
  [
    '直接在 GitHub 上修改了 CSV，前台无变化',
    '读取路径只信任 manifest 中记录的 sha',
    '调用 POST /csv-depot/rebuild 核对并同步',
  ],
  [
    '页面地址变更后评论变少',
    '旧地址哈希出的分片中留有已修改 url 的错位行',
    '通常已被自动搬迁；未生效时调用 POST /csv-depot/repair',
  ],
  ['部署后站点持续重新构建', '数据仓库指向了站点仓库自身', '改用独立的专用数据仓库'],
  [
    'Git Trees API 返回被截断',
    '仓库文件数超过 10 万，无法安全创建快照',
    '拆分仓库，或执行 POST /csv-depot/reset 清理历史',
  ],
  [
    '数据仓库体积持续增长',
    '每次写入都会重写整个分片并产生新的 blob，历史只增不减',
    '执行 POST /csv-depot/reset；或调小 SHARD_MAX_ROWS',
  ],
  [
    '阅读量少于实际访问次数',
    '多实例并发自增；已用「远端值 + 本地增量」合并消除绝大多数误差',
    '极端并发下仍可能少计 1~2 次，计数类数据本就不要求精确',
  ],
  [
    '写入偶发超时',
    'GitHub API 响应慢叠加函数超时限制',
    '当前超时设为 26s；仍然超时可减小 SHARD_MAX_ROWS 以缩小单次提交体积',
  ],
  [
    '分片文件数量过多',
    '文章数量较多；一篇一族是设计使然',
    '调小 SHARD_HASH_LEN 可让更多文章合并到更少的分片中',
  ],
]

// 源码走读：全部片段在构建期从仓库真实文件截取
const entrySource = readRepoFile('netlify/functions/waline.js')

const shardRouting = excerpt('overlay/csv-depot/shard-manager.js', {
  from: '// Family prefix (no .csv, no split suffix)',
  to: 'manifestPath(table) {',
})

const scopeSource = excerpt('overlay/csv-depot/csv-shard-cache.js', {
  from: 'scopeFor(table, where) {',
  to: '// Prepare the load scope',
})

const mergeSource = excerpt('overlay/csv-depot/csv-shard-cache.js', {
  from: 'mergeShard(table, path, remoteRows, sha',
  to: 'Deduplication fingerprint',
})

const commitPathsSource = excerpt('overlay/csv-depot/shard-write-queue.js', {
  from: 'async commitPaths(paths) {',
  to: "Commit this round's shards",
})

const atomicSource = excerpt('overlay/csv-depot/shard-write-queue.js', {
  from: '// The manifest is a projection of shard state',
  to: 'this.cache.markClean(shardShas);',
})

const refSource = excerpt('overlay/csv-depot/github-client.js', {
  from: '// Move the branch pointer',
  to: 'module.exports = {',
})

const healSource = excerpt('overlay/csv-depot/csv-shard-cache.js', {
  from: 'healMisplaced(table) {',
  to: '// Rebuild a shard',
})

const snapshotSource = excerpt('overlay/csv-depot/snapshot.js', {
  from: 'A snapshot is a manifest rather than a copy',
  to: 'const { setTimeout: sleep }',
})

const sourceTree = `netlify/functions/waline.js    # 唯一改动的上游文件：Waline({ model, plugins })
overlay/                        # ← 全部改造都收在这一层
├── csv-depot/                  #   多 CSV 分片存储（适配器 + GitHub 客户端 + 快照 + 入口）
├── csv-depot-tests/            #   内存版 GitHub API 与测试用例
├── benchmark/                  #   性能对比基准与生成的报告
├── empty-stub/                 #   空实现桩的源码（npm run pack:stubs 生成下列 tarball）
│   └── …                       #   用于替换 @mathjax/*、leancloud-* 等重依赖
├── plugin-emoji-cjs/           #   emoji 垫片的源码（把仅提供 ESM 的包以 CJS 形式提供）
├── empty-stub-1.0.0.tgz        #   ↑ 两个本地包的打包产物
└── plugin-emoji-cjs-1.0.0.tgz  #     （package.json 的 overrides 指向它们）`

const fileRows = [
  [
    'netlify/functions/waline.js',
    'Netlify Function 入口（注入 model 与插件，是唯一改动的上游文件）',
  ],
  [
    'overlay/csv-depot/github-client.js',
    'GitHub Contents API / Git Data API 封装、SHA 校验、批量提交与重试',
  ],
  [
    'overlay/csv-depot/shard-manager.js',
    '分片命名与路由、manifest、CSV 编解码、裂变与合并规划',
  ],
  [
    'overlay/csv-depot/csv-shard-cache.js',
    '分片按需加载、内存索引、条件查询（where / order / limit）、变更与回滚、别名分片自愈',
  ],
  ['overlay/csv-depot/shard-write-queue.js', '写入合并、按分片提交、冲突检测与重试'],
  ['overlay/csv-depot/csv-model.js', 'Waline CustomModel 适配器实现'],
  ['overlay/csv-depot/snapshot.js', '快照创建、保留策略、恢复与仓库重置'],
  ['overlay/csv-depot/index.js', '入口：模型注入、中间件、运维接口与管理员鉴权'],
  [
    'overlay/csv-depot-tests/',
    '内存版 GitHub API 与用例（真实 Waline 运行时端到端、并发冲突、分片裂变、快照恢复、内存预算、生产运行时加载守卫、页面迁移自愈）',
  ],
  ['overlay/benchmark/', '性能对比基准与报告生成'],
  ['overlay/empty-stub/', '重依赖空实现桩的源码（打包产物由 package.json 的 overrides 指向）'],
  [
    'overlay/plugin-emoji-cjs/',
    'emoji 垫片源码：把仅提供 ESM 构建的 @mdit/plugin-emoji 以 CJS 形式提供给 waline 的同步 require',
  ],
]

const stubRows = [
  [
    '@mathjax/*、leancloud-*、speech-rule-engine',
    'empty-stub',
    '这些重依赖本站未使用（数学公式已关闭），保留会把 Netlify 的函数包顶到限额之外',
  ],
  [
    '@mdit/plugin-emoji',
    'plugin-emoji-cjs',
    '它只提供 ESM 构建，而 waline 在模块加载期同步 require 它；禁用 require(esm) 的运行时（Lambda 的 Node 24）会直接抛出 ERR_REQUIRE_ESM',
  ],
]

const devSnippet = `npm install
npm test          # 用例覆盖：单元 + 集成 + 真实 Waline 运行时端到端
                  #           + 并发 / 限流可靠性 + 内存预算
npm run benchmark # 生成 overlay/benchmark/REPORT.md`

const runtimeGuard = `# 模拟生产运行时，确认函数入口可以被加载（这是 1.43.4 曾经踩到的坑）
node --no-experimental-require-module -e "require('./netlify/functions/waline.js')"`

const packSnippet = `npm run pack:stubs      # 重新打包两个本地包 → overlay/*.tgz
rm package-lock.json    # 让 npm 从零解析（overrides 变动时必须执行）
npm install             # 重建 node_modules 与 lockfile`

const upgradeSnippet = `git remote add upstream https://github.com/walinejs/netlify-starter.git
git fetch upstream
git merge upstream/master --no-ff`

// ---------------------------------------------------------------------------
// 章节正文
// ---------------------------------------------------------------------------

const overview = html`
  ${Block(
    {
      title: '为什么要换掉单文件 CSV',
      lead: '这个仓库建立在 walinejs/netlify-starter 之上。上游的 CSV 存储方案把全部评论放在 data/Comment.csv 一个文件里，读一次列表就要下载整个文件、在 JS 里逐行过滤，写一条评论则要重写整个文件。评论一多，这套做法很快就不行了。',
    },
    html`${Table({ head: ['', '上游单文件方案', '本仓库多分片方案'], rows: compareRows })}`
  )}

  ${Block(
    {
      title: '差距有多大，测一次最清楚',
      lead: '用仓库里的基准脚本测一次最清楚（npm run benchmark 生成，结果在 overlay/benchmark/REPORT.md）。',
    },
    html`
      <div class="stack">
        ${Stat({ value: '0.20 ms', label: '单次评论列表查询（5 万条 / 990 个分片）' })}
        ${Stat({ value: '1.76 ms', label: '一次列表页完整渲染（5 万条）' })}
        ${Stat({ value: '4 次', label: '冷启动读取 manifest 与命中分片的 API 调用' })}
      </div>
      ${Table({ head: ['场景', '上游单文件方案', '本仓库多分片方案'], rows: benchRows })}
      ${P(
        {},
        html`「下载 0 B」不是夸张：分片已经在内存里，查询不再碰网络。冷启动之所以快，是因为它只读三张表的
          manifest，再加上命中文章的那一两个分片，成本与全站评论总量基本无关。`
      )}
    `
  )}

  ${Block(
    {
      title: '改完是什么样',
      lead: '我用一套自定义存储适配器替换了 @waline/vercel 的「单文件 CSV」实现。改造只换底层存储，上层业务逻辑零改动。三条主线：存储形态、读取路径、写入可靠性。',
    },
    html`
      ${CardGrid(
        { columns: 3 },
        html`
          ${FeatureCard({
            title: '存储形态',
            description:
              '评论数据以 CSV 分片文件的形式放在 GitHub 仓库里，按 key 的哈希值分族。备份即仓库备份，每一次数据变更都留有 git 历史。',
          })}
          ${FeatureCard({
            title: '读取路径',
            description:
              '刷新时只拉取三张表的 manifest，逐条比对 sha，只有真正变化的分片才会被下载。命中索引后的查询是纯内存操作，不再碰网络。',
          })}
          ${FeatureCard({
            title: '写入可靠性',
            description:
              '变更先应用到内存（含索引）再异步提交；每次请求返回前刷盘，落盘失败就把响应改成 5xx，绝不让客户端以为「保存成功」。',
          })}
        `
      )}
    `
  )}

  ${Block(
    {
      title: '分片规则：稳定可预测，只由 key 决定',
      lead: '整套存储的前提是一句约定：由 key 算出族、再去那个族里找。manifest 与分片永远落在同一次 Git 提交里，不会出现两者不一致的中间状态。',
    },
    html`
      ${CardGrid(
        { columns: 3 },
        html`
          ${FeatureCard({
            title: '按 url 哈希做文件名',
            description:
              '同一篇文章的评论必然落在同一个分片族里，按文章查询只需读一个分片，局部写入也只影响一个分片。',
          })}
          ${FeatureCard({
            title: 'manifest 记着 sha',
            description:
              '刷新时只拉取三张表的 manifest（3 次 API 调用），逐条比对 sha，只有真正变化的分片才会被下载。',
          })}
          ${FeatureCard({
            title: '快照只引用已有 blob',
            description:
              '每日快照是一份 path,sha 清单，零内容上传，几百个分片也只是一次提交。',
          })}
        `
      )}
    `
  )}

  ${Block(
    {
      title: '适合，以及不适合',
      lead: '不用数据库，也不用对象存储，换来的好处很实际。但它不是万能的，边界先说清楚。',
    },
    html`
      ${CardGrid(
        {},
        html`
          ${Panel(
            {},
            html`
              <h4>适合</h4>
              ${List({
                items: [
                  '个人博客与中小站点',
                  '评论量在几十万条以内',
                  '希望零运维——没有数据库需要备份',
                  '希望每一次数据变更都能在 git 历史里查到',
                ],
              })}
            `
          )}
          ${Panel(
            {},
            html`
              <h4>不适合</h4>
              ${List({
                items: [
                  '高并发写入：每条评论约 7 次 GitHub API 调用',
                  '需要全文检索：后端只实现了 Waline 实际用到的 where 子集',
                  '数据量大到 GitHub 仓库体积成为瓶颈',
                  '具体见文末「有哪些坑」',
                ],
              })}
            `
          )}
        `
      )}
    `
  )}

  ${Callout(
    { tone: 'warn', title: '不要把数据仓库设成站点仓库自己' },
    html`每次写评论都会向数据仓库提交一次 commit。两者若是同一个仓库，Netlify
      会把每次提交都当成部署触发，形成「写入 → 部署 → 写入」的循环。`
  )}

  ${Block(
    { title: '术语', lead: '后面会反复出现这几个词，先放在这里。' },
    html`${Table({ head: ['术语', '含义'], rows: termRows })}`
  )}

  ${Block(
    { title: '这份手册怎么读' },
    html`
      ${P(
        {},
        html`下面按「为什么改、改完是什么样、怎么部署、有哪些坑」的顺序来说。急着上线，直接看「五分钟上手」；
          想知道数据放在哪儿、出问题怎么查，再看后面几章。全部编排在一个页面里，可按需跳读。`
      )}
      ${P(
        {},
        html`站点由 Wunphile（单文件、零依赖的 Node SSG）在构建期生成静态
          HTML；源码片段在构建期从 ${code('overlay/csv-depot/')} 现读，实现一改，这里的片段就跟着变，
          不是复制粘贴的旧副本。`
      )}
      ${P(
        {},
        html`选 Wunphile 只是为了在 Node.js 生态里找个趁手的轻量 SSG，不构成对其它实现的取舍评价。
          也欢迎来体验作者用 .NET F# 写的 SSG：
          <a
            href="https://github.com/exyonefs/zest"
            rel="noreferrer noopener"
            >zest</a
          >。`
      )}
    `
  )}
`

const start = html`
  ${Block(
    { title: '五分钟上手', lead: '五个步骤，不用数据库，也不用对象存储。' },
    html`${Steps({ items: quickStart })}`
  )}
  ${Callout(
    { tone: 'warn', title: '不要把数据仓库设成站点仓库自己' },
    html`每次写评论都会向数据仓库提交一次 commit。两者若是同一个仓库，Netlify
      会把每次提交都当成部署触发，形成「写入 → 部署 → 写入」的循环。`
  )}
  ${P(
    {},
    html`只想确认服务通不通，直接打开
      ${code('https://<站点>/.netlify/functions/waline')}——那是 Waline 自带的示例页，
      发一条评论，数据仓库里就该出现分片文件了。`
  )}
`

const deploy = html`
  ${Block(
    {
      title: '准备数据仓库',
      lead: '新建一个 GitHub 仓库（例如 your-name/waline-comments），其余保持默认。',
    },
    html`
      ${List({
        items: [
          html`建议设为 Private：评论 CSV 含 ${code('mail')}、${code('ip')}、${code('ua')}
            等字段，公开仓库等于公开这些信息。`,
          '不要勾选 Add a README：本方案在完全空白的仓库上也能工作，首条评论写入时会自动创建分支与首个提交。',
          html`若仓库已有内容且有 ${code('main')} 分支，把 ${code('GITHUB_BRANCH')}
            指到那个分支即可。`,
          '一个数据仓库只服务一个站点，多站点共用会让提交互相干扰。',
        ],
      })}
    `
  )}
  ${Block(
    {
      title: '准备 GitHub 访问令牌',
      lead: 'GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token。',
    },
    html`
      ${Table({ head: ['配置项', '填什么'], rows: tokenRows })}
      ${P({}, html`生成后复制 ${code('github_pat_...')} 那串，下一步会用到。它只会出现一次。`)}
    `
  )}
  ${Block(
    {
      title: 'Fork 并接入 Netlify',
      lead: '点仓库右上角 Fork（或用 "Use this template"）到你自己的账号，再在 Netlify 里 Add new site → Import an existing project → 选你 fork 的仓库。',
    },
    html`
      ${Table({ head: ['项', '值'], rows: netlifyRows })}
      ${P({}, html`先别急着部署，去 Site configuration → Environment variables 配好变量，再触发部署。`)}
      ${Callout(
        { tone: 'warn', title: 'Fork 后有一处必须改' },
        html`${code('netlify.toml')}
          末尾有一条 favicon 重定向指向本仓库作者的站点，请改成你自己的图标地址，或者直接删掉那一段。`
      )}
      ${P({}, html`这份手册自己怎么发上去，见本章末尾。`)}
    `
  )}
  ${Block(
    { title: '注册管理员' },
    html`
      ${P(
        {},
        html`部署成功后访问（注意是 Netlify 的函数路径，没有 ${code('/api')} 前缀）：`
      )}
      ${CodeBlock({
        title: '浏览器地址栏',
        code: 'https://<你的站点>/.netlify/functions/waline/ui/register',
      })}
      ${P(
        {},
        html`也可以走已配好的重定向，写成 ${code('https://<你的站点>/api/ui/register')}。
          第一个注册的账号自动成为管理员，后台入口是同目录下的
          ${code('/ui/login')}。如果注册页返回 500，先看 Netlify 的 Function 日志，多半是
          ${code('GITHUB_TOKEN')} / ${code('GITHUB_REPO')} 配错了。`
      )}
    `
  )}
  ${Block(
    { title: '前端接入' },
    html`
      ${CodeBlock({ title: 'index.html', code: walineSnippet })}
      ${P(
        {},
        html`框架用户（Hexo / Vitepress / Astro …）同理，把 ${code('serverURL')} 指过去即可。
          ${code('serverURL')} 末尾不要带斜杠，也别再拼一层 ${code('/api')}：仓库已经在
          ${code('netlify.toml')} 里把 ${code('/api')} 重写到函数了，写一次就够。想用完整函数路径
          ${code('https://<你的站点>/.netlify/functions/waline')} 也一直有效。`
      )}
      ${P(
        {},
        html`这条重定向长这样（${code('status = 200')} 是内部重写，不是跳转；
          ${code('/api/*')} 不匹配 ${code('/api')} 本身，所以根路径单列一条）：`
      )}
      ${CodeBlock({ title: 'netlify.toml', code: apiRedirect })}
      ${P({}, html`填入自己的域名，直接生成可复制的接入片段：`)} ${ServerUrlBuilder()}
    `
  )}
  ${Block({ title: '验证清单' }, html`${Steps({ items: checkList })}`)}
  ${Block(
    {
      title: '顺带一提：这份手册怎么发上去',
      lead: '默认部署是纯 Functions 站点，构建命令和发布目录都留空。想把这份手册也一起发到同一个 Netlify 站点，才需要在 netlify.toml 里补一段 [build]。',
    },
    html`
      ${CodeBlock({ title: 'netlify.toml', code: netlifyToml })}
      ${P(
        {},
        html`不要设置 base 目录。一旦把构建根目录移到 ${code('handbook/')}，
          ${code('netlify/functions/')} 的路径也会随之错位，评论函数就找不到了。`
      )}
      ${P(
        {},
        html`本地预览用 ${code('npm run site:dev')}，构建产物输出到
          ${code('handbook/dist')}。`
      )}
    `
  )}
`

const env = html`
  ${Block(
    { title: '必填项', lead: '真正要你动手填的只有这几个。' },
    html`
      ${Table({
        head: ['变量', '必填', '默认 / 示例', '说明'],
        rows: requiredRows,
      })}
    `
  )}
  ${Block(
    {
      title: '存储层可调参数',
      lead: '这一层是本改造新增的，都有默认值，不配也能跑。想调分片粒度、缓存时长或快照策略时再动。',
    },
    html`${Table({ head: ['变量', '默认', '说明'], rows: storeRows })}`
  )}
  ${Callout(
    { tone: 'info', title: 'COMMENT_AUDIT 与存储层无关' },
    html`${code('COMMENT_AUDIT=true')} 时新评论默认 ${code('waiting')}，管理员在后台批准后才会出现在前台。
      这是 Waline 自身的审核工作流，存储层只如实保存 ${code('status')} 字段。`
  )}
  ${Block(
    {
      title: '常用 Waline 变量',
      lead: '与官方完全一致，按需添加。',
    },
    html`
      ${Table({ head: ['变量', '说明'], rows: walineRows })} ${P({}, html`其余变量见
        Waline 官方文档。本改造不改变任何上层行为，只替换底层存储。`)}
    `
  )}
  ${Block(
    {
      title: '配置位置',
      lead: 'Netlify：Site configuration → Environment variables。改完要重新部署才生效。',
    },
    html`
      ${CodeBlock({ title: 'netlify.toml', code: envToml })}
      ${List({
        items: [
          html`本地开发建议另建一个测试仓库，把 ${code('GITHUB_TOKEN')} 与
            ${code('GITHUB_REPO')} 写入 ${code('.env')} 后运行 ${code('netlify dev')}（需要
            Netlify CLI）。${code('.env')} 已在 .gitignore 中。`,
          html`${code('WALINE_SERVER_URL')} 是手册自身的构建期变量：Wunphile
            在构建时把它写入产物 HTML，因此无需在浏览器中再次配置。`,
          '不要直接使用线上数据仓库做实验，先执行 POST /csv-depot/snapshot 创建快照。',
        ],
      })}
    `
  )}
`

const data = html`
  ${Block({ title: '目录结构' }, html`${CodeBlock({ title: 'data/', code: tree })}`)}
  ${Block(
    {
      title: '分片规则（稳定可预测，只由 key 决定）',
      lead: '同一个 key 始终映射到同一个分片族，文件名就是这么算出来的。',
    },
    html`
      ${Table({ head: ['表', '分片 key', '路径'], rows: shardRuleRows })}
      ${List({
        items: [
          html`为什么 Comment/Counter 用 url 哈希做文件名：同一篇文章的评论必然落在同一个分片族里，按文章查询只需读一个分片，局部写入也只影响一个分片。`,
          html`为什么 Users 只用 2 位前缀且「目录名 = 文件名」：Users 的 key 是一行一个的 ${code('objectId')}，照搬
            4 位前缀会让 10 万用户产生约 10 万个只有一行的小文件；2 位前缀把分片数收敛到有限个桶，每片容纳成百上千行。`,
        ],
      })}
    `
  )}
  ${Block(
    { title: '裂变、合并与搬迁' },
    html`
      ${List({
        items: [
          html`裂变：族内任一文件达到 ${code('SHARD_MAX_ROWS')} 行后，新记录写入
            ${code('<前缀>-1.csv')}、${code('<前缀>-2.csv')}
            依次类推，使单个 CSV 不会无限增长。`,
          html`合并：族内总行数回落到阈值以内时，${code('POST /csv-depot/compact')}
            可将其压回基础分片。`,
          html`搬迁：若通过外部方式修改了 CSV 中的 ${code('url')}
            列而未移动文件，数据行会留在旧地址哈希出的分片中，成为错位行。系统会自动将其搬回新地址对应的族。`,
        ],
      })}
    `
  )}
  ${Block(
    {
      title: '_manifest.csv',
      lead: '读路径的核心：刷新时只拉取三张表的 manifest（3 次 API 调用），逐条比对 sha，只有真正变化的分片才会被下载。',
    },
    html`
      ${CodeBlock({ title: 'data/comments/_manifest.csv', code: manifestCsv })}
      ${P(
        {},
        html`manifest 与分片永远落在同一次 Git 提交里，不会出现两者不一致的中间状态。`
      )}
    `
  )}
  ${Block(
    {
      title: 'CSV 列',
      lead: '每张表的规范列与 Waline 上层实际读写的字段一致；sticky、like、2fa、自定义计数器类型等动态列会以「规范列 ∪ 实际出现的动态列」的形式写进表头（动态列按字母序追加），因此表头稳定且不丢字段。',
    },
    html`
      ${Table({ head: ['表', '列'], rows: columnRows })}
      ${P(
        {},
        html`文件编码 UTF-8、换行 LF、仅在必要时加引号（RFC 4180 转义）。时间列统一为
          ISO 8601（字典序即时间序），手工编辑时请保持这个格式。`
      )}
    `
  )}
  ${Callout(
    { tone: 'warn', title: '新方案不会读取 data/Comment.csv' },
    html`如果你之前用的是官方方案，需要把三个文件拆成分片；没有历史数据的话跳过下一节。`
  )}
  ${Block(
    {
      title: '从旧版迁移数据',
      lead: '这是一次性的本地操作：拆分规则就是上面那张表，脚本复用 overlay/csv-depot 的分片规则，保证与线上用的是同一套逻辑（需要仓库已 npm install）。',
    },
    html`
      ${CodeBlock({ title: 'migrate.js', code: migrateScript })}
      ${P({}, html`迁移完成后：`)} ${Steps({ items: migrateSteps })}
    `
  )}
`

const ops = html`
  ${Block(
    {
      title: '接口一览',
      lead: html`所有接口都需要管理员身份（${code('Authorization: Bearer <登录 token>')}）。完整路径是
        ${code('https://<站点>/.netlify/functions/waline/csv-depot/<action>')}；走仓库已配好的
        ${code('/api')} 重定向，就是 ${code('https://<站点>/api/csv-depot/<action>')}。`,
    },
    html`${Table({ head: ['方法', '路径', '作用'], rows: opsRows })}`
  )}
  ${Block(
    { title: '调用方式' },
    html`
      ${CodeBlock({ title: 'bash', code: curlSnippet })}
      ${P(
        {},
        html`token 可以这样拿：登录后台后打开 DevTools → Network，随便挑一个后台请求，复制它的
          ${code('Authorization: Bearer xxxxx')} 那段即可。接口只认 ${code('Authorization')}
          头，不支持把 token 放在 URL query 里（会被代理日志记下）。${code('restore')} 的
          ${code('date')} 必须是 ${code('YYYY-MM-DD')}，非法值直接报错，不会拿它去拼路径。`
      )}
    `
  )}
  ${Block(
    { title: '每日快照' },
    html`
      ${List({
        items: [
          html`默认每天由第一个到达的请求触发一次（${code('SNAPSHOT_HOUR')}
            之后），当天只执行一次。`,
          '快照只引用已有 blob，不上传文件内容，因此分片数量增加不会放大提交体积。',
          html`需要精确的执行时点，可用平台的 Scheduled Function 或服务器上的 crontab 定时调用
            ${code('POST /csv-depot/snapshot')}。`,
        ],
      })}
    `
  )}
  ${Block(
    { title: '恢复' },
    html`
      ${List({
        items: [
          html`推荐方式：${code('POST /csv-depot/restore')}，用指定日期的快照整体覆盖
            ${code('data/')}，并删除该快照之后新增的文件，使状态与该快照完全一致。`,
          html`手工方式：快照清单 ${code('_snapshots/<date>.csv')} 本身即是一份
            ${code('path,sha')} 列表，按它把对应 blob 放回原路径即可，数据本身就在 git 中。`,
        ],
      })}
    `
  )}
  ${Block(
    {
      title: '仓库瘦身：POST /csv-depot/reset',
      lead: '写入即提交，历史里因此堆着每一次分片重写产生的 blob，仓库体积只增不减，时间久了会逼近 GitHub 的建议上限。评论数据的历史提交没有价值——任何时点都能用快照恢复。reset 做的事是：',
    },
    html`
      ${List({
        items: [
          '用当前 data/ 下的文件构造一个没有父提交的 commit，并强制更新分支指针；',
          html`仓库回到「一个提交」的状态，${code('.git')}
            体积随之降到当前数据大小；`,
          html`快照目录（同样只是历史负担）默认一并丢弃，需要保留就传
            ${code('keepSnapshots=1')}；`,
          '比「新建仓库再切环境变量」更直接：没有两份数据并存的切换窗口，也不需要改配置。',
        ],
      })}
      ${Callout(
        { tone: 'warn', title: '重置会不会删掉评论？不会。' },
        html`reset 只把 git 历史清零。它把 ${code('data/')}
          下全部当前文件（含 ${code('data/comments/**')}、${code('data/users/**')}、${code('data/counters/**')}
          ）以 ${code('{sha}')}
          形式原样带进新提交，引用现有 blob，内容一个字节都不动——重置后评论、用户、阅读量与重置前完全一致。唯一会丢掉的是
          ${code('_snapshots/')} 快照目录，想留住就传 ${code('keepSnapshots=1')}。`
      )}
      ${P({}, html`操作前建议先 ${code('POST /csv-depot/snapshot')}
        拍一张，确认无误再 reset。`)}
    `
  )}
  ${Block(
    {
      title: '页面换地址后评论不见了',
      lead: '页面 A 迁到页面 B（例如 /friends/ → /links/）时，如果只把 CSV 里的 url 列改成新地址，文件却仍留在 sha1(\'/friends/\') 对应的分片里，就会产出错位行：',
    },
    html`
      ${CodeBlock({ title: '错位示意', code: misplaced })}
      ${P(
        {},
        html`整套存储的前提是「由 key 算出族、再到该族中查找」，因此 ${code('1bd2')}
          中的旧评论在前台一条都不会显示；而 ${code('compact')}
          只在同族内合并，也不会把它们带回。`
      )}
      ${P({}, html`当前实现采用自愈处理：`)} ${Steps({ items: healSteps })}
      ${P(
        {},
        html`代价是每个进程最多承担一次全表加载，数据归位后不再触发。如需立即获取搬迁报告，可直接调用
          ${code('POST /csv-depot/repair')}；${code('GET /csv-depot/stats')} 中的
          ${code('misplaced')} 表示尚未归位的别名分片数量，正常情况下应为 0。`
      )}
    `
  )}
`

const design = html`
  ${Block(
    {
      title: '写入可靠性：为什么不会丢评论',
      lead: '这套方案跑在 serverless 上，写入又完全依赖外部 API，所以「会不会丢评论」是它最需要交代清楚的问题。下面八条是设计上的回答。',
    },
    html`${Steps({ items: reliability })}`
  )}
  ${Block(
    {
      title: '与上游实现的差异',
      lead: '本改造只替换底层存储适配器，没有改动任何上层业务逻辑。为了能正常工作，下列几处必须与 Waline 的实际契约对齐，与上游行为存在（有意为之的）差异：',
    },
    html`${Table({ head: ['差异点', '说明'], rows: diffRows })}`
  )}
  ${Block(
    {
      title: '加载范围：按分片族按需加载',
      lead: html`缓存包含两层状态：${code('entries')}
        是 manifest 中的权威清单（包含全部分片，无论是否已读取），${code('shards')}
        才是真正载入内存的分片内容。查询时先计算目标族，只加载命中的族。`,
    },
    html`
      ${Table({ head: ['查询形态', '加载范围'], rows: scopeRows })}
      ${P(
        {},
        html`因此冷启动不需要把整个数据集读入内存：只读 manifest（每表 1 次请求）与命中的分片。只有确实需要全局视图的操作才会把整表读进来，并把该表标记为「已全量加载」。`
      )}
    `
  )}
  ${Block(
    {
      title: '内存占用',
      lead: '已加载的分片常驻内存（仅在远端 sha 变化时重新下载），这是「查询不访问网络」的前提。',
    },
    html`
      ${List({
        items: [
          html`${code('overlay/csv-depot-tests/memory.spec.js')}
            会钉住全量加载时的上界：10 万条评论（1973
            个分片）的行对象加上 ${code('byId')} / ${code('byField')}
            与分片族索引，实测常驻约 88.7 MB，低于 100MB 预算，超出即测试失败。`,
          '按需加载使常见路径的实际占用远低于该上界。索引按分片级增量维护，只有分片合并与回滚这类整表重写才执行一次全量重建。',
          html`索引刻意保持精简：主键直达（${code('byId')}）、等值 / IN
            的倒排桶（${code('byField')}）与分片族索引。重复提交的指纹不做全局索引——10
            万条评论下那份 ${code('Map<hash, Set>')} 实测占用 20MB
            以上（接近总量的四分之一），而它只在新增评论时使用一次，因此改为在「同一 url
            的候选行」上现算。`,
        ],
      })}
    `
  )}
  ${Callout(
    { tone: 'info', title: '跨实例读取存在 TTL 延迟' },
    html`${code('CSV_CACHE_TTL')} 默认为 60s：A 实例写入后，B
      实例最多 60s 后才能看到。这是按需加载带来的代价，评论区场景通常无感知。`
  )}
`

const source = html`
  ${Block(
    {
      title: '代码结构',
      lead: '仓库保持「上游 + 补丁」的形状：所有改造收在 overlay/ 一层目录内，根目录不新增任何平级目录，因此与上游 starter 的差异可以一眼看清。',
    },
    html`
      ${CodeBlock({ title: '仓库结构', code: sourceTree })}
      ${Table({ head: ['文件', '职责'], rows: fileRows })}
    `
  )}
  ${Block(
    {
      title: '唯一的上游接线点',
      lead: '整个改造只改动了这一个上游文件：把 model 换成 CSV 分片适配器，再添加一个插件提供「响应前刷盘」与运维接口。两者都是官方扩展点，因此上层业务逻辑未作修改。',
    },
    html`${CodeBlock({ title: 'netlify/functions/waline.js', code: entrySource })}`
  )}
  ${Block(
    {
      title: '分片路由：一个 key 始终映射到同一个族',
      lead: '整套存储的前提包含在这十几行内。Comment 与 Counter 使用 url 的 sha1；Users 每行一个 key，因此只取两位前缀，以避免产生上万个单行文件。',
    },
    html`${CodeBlock({ title: 'overlay/csv-depot/shard-manager.js', code: shardRouting })}`
  )}
  ${Block(
    {
      title: '按需加载：把 where 收敛为分片族',
      lead: '能够收敛时只加载命中的族，无法收敛时读取整表——宁可多读，也不返回不完整的结果。这正是「5 万条评论查询 0.20 ms、下载 0 B」的来源。',
    },
    html`${CodeBlock({ title: 'overlay/csv-depot/csv-shard-cache.js', code: scopeSource })}`
  )}
  ${Block(
    {
      title: '冲突合并：本地优先，计数走增量',
      lead: '被 GitHub 拒绝后重新拉取，只下载 sha 发生变化的分片，再按三条规则合并。Counter 属于例外——两个实例各加一次的阅读量不应被后提交者覆盖。',
    },
    html`${CodeBlock({ title: 'overlay/csv-depot/csv-shard-cache.js', code: mergeSource })}`
  )}
  ${Block(
    {
      title: '提交：冲突后退避重试，重试耗尽则回滚',
      lead: '发生冲突时不回滚内存（下一轮 refresh 会把远端新数据合并进来，合并规则保留本地版本），但必须退避；重试耗尽则整体回滚到「最后一次提交成功」的状态，并把错误抛给调用方。',
    },
    html`
      ${CodeBlock({
        title: 'overlay/csv-depot/shard-write-queue.js',
        code: commitPathsSource,
      })}
    `
  )}
  ${Block(
    {
      title: '原子提交：manifest 是分片状态的投影',
      lead: 'manifest 每次都从内存整体重建，与分片内容放入同一次提交，因此「manifest 与分片不一致」永远不会作为中间状态出现在数据仓库中。',
    },
    html`${CodeBlock({ title: 'overlay/csv-depot/shard-write-queue.js', code: atomicSource })}`
  )}
  ${Block(
    {
      title: '乐观锁：force=false 是冲突可见的原因',
      lead: '读取顺序固定为「先读 head、再读数据」，提交时以非快进方式更新 ref。只要在读取数据之后有其他提交产生，本次更新就会被 GitHub 拒绝。',
    },
    html`${CodeBlock({ title: 'overlay/csv-depot/github-client.js', code: refSource })}`
  )}
  ${Block(
    {
      title: '自愈：搬迁失败不影响读取',
      lead: '页面地址变更留下的错位行由这一步搬回规范分片。同一张表的并发搬迁只执行一次，且失败时仍使用未搬迁的数据响应——错位可以等待，评论列表读不出来才是故障。',
    },
    html`${CodeBlock({ title: 'overlay/csv-depot/csv-shard-cache.js', code: healSource })}`
  )}
  ${Block(
    {
      title: '快照为什么是清单而不是副本',
      lead: '若采用副本，文件数会变为「分片数 × 保留天数」，2000 个分片保留 30 天约等于 6 万条，正好撞上 Git Trees API 的截断上限，而且是在最需要快照的时候撞上。清单只引用已有 blob，不产生上传。',
    },
    html`${CodeBlock({ title: 'overlay/csv-depot/snapshot.js', code: snapshotSource })}`
  )}
  ${Block(
    {
      title: '两个本地包：为什么必须打成 tarball 并提交',
      lead: html`${code('package.json')} 的 ${code('overrides')}
        会把两个第三方包替换为 ${code('overlay/')} 下的本地包。`,
    },
    html`
      ${Table({ head: ['被替换的包', '替换为', '原因'], rows: stubRows })}
      ${List({
        items: [
          '为什么使用 tarball 而不是目录：目录形式的桩会被 npm 建成「链接」节点；一旦需要重新解析依赖树，arborist 会在链接目标尚未建立时去比较它，直接抛出 Cannot read properties of null——也就是说目录桩会让依赖再也无法升级。tarball 被当作普通包安装，升级、降级、npm ci 与 Netlify 构建均正常。',
          '为什么必须提交这两个 tarball：npm 在解析依赖树阶段就需要按 file: 路径打开它们，这发生在任何 preinstall / postinstall 脚本之前，因此无法「安装时现打」。两者合计只有 1.3KB，且 lockfile 记录了各自的 integrity 哈希——它们与 package-lock.json 属于同一类输入：可复现安装所必需。',
        ],
      })}
      ${P({}, html`修改本地包的内容或版本号之后，按以下顺序执行：`)}
      ${CodeBlock({ title: 'bash', code: packSnippet })}
      ${P(
        {},
        html`依赖桩使外置包总体积保持在约 94MB，低于 Netlify 的 250MB
          函数包限额。它与 csv-depot 无关，只是同样属于「对上游的改写」。`
      )}
    `
  )}
  ${Block(
    {
      title: '本地开发',
      lead: '测试不需要任何真实凭据：mock-github.js 是一个会讲 HTTP 的内存版 GitHub，真实维护 blob / tree / commit / ref 四层对象，并会拒绝非快进更新，因此「并发冲突」「重试」「回滚」这些行为测到的就是线上行为。',
    },
    html`
      ${CodeBlock({ title: 'bash', code: devSnippet })}
      ${Callout(
        { tone: 'warn', title: '本地同样需要验证生产运行时' },
        html`Lambda 的 Node 24 未开启 ${code('require(esm)')}
          ，而本地 Node 默认开启，因此「某个依赖改为纯 ESM 却被同步 require」这类问题在本地运行正常、上线才失败（1.43.4
          的 ${code('@mdit/plugin-emoji')} 即属于此类）。${code('npm test')}
          中已包含一个守卫用例，会开启子进程用
          ${code('--no-experimental-require-module')}
          加载函数入口；需要手工确认时也可以直接运行：`
      )}
      ${CodeBlock({ title: 'bash', code: runtimeGuard })}
      ${P(
        {},
        html`如需使用真实仓库运行，可另建一个测试仓库，把 ${code('GITHUB_TOKEN')} 与
          ${code('GITHUB_REPO')} 写入 ${code('.env')} 后执行
          ${code('netlify dev')}（需要 Netlify CLI）。不要使用线上数据仓库做实验，先执行
          ${code('POST /csv-depot/snapshot')}。`
      )}
    `
  )}
  ${Block(
    {
      title: '同步上游与升级',
      lead: '上游 starter 的提交以依赖升级为主，同步是安全的。',
    },
    html`
      ${CodeBlock({ title: 'bash', code: upgradeSnippet })}
      ${List({
        items: [
          html`${code('package-lock.json')}
            几乎必然冲突：保留本地版本（${code('git checkout HEAD -- package-lock.json')}
            ）。本仓库的 lockfile 为 v3，且已按 ${code('overrides')}
            裁剪过；混入上游的 v2 结构会让 Netlify 的依赖体积失控。`,
          html`${code('@waline/vercel')} 当前为
            1.43.4。跟进上游新版本时需注意：升级会牵动 ${code('netlify/functions/waline.js')}
            的 ${code('model')} / ${code('plugins')}
            注入契约与数据表列，升级后必须跑完
            ${code('npm test')}（含真实 Waline 运行时端到端用例）再上线。`,
          html`注意 ${code('overrides')} 不能改名：它是 npm 自身的字段，不是本仓库的命名约定。改成其他键名会被
            npm 当作未知字段静默忽略，于是 ${code('@mathjax/*')}、${code('leancloud-*')}
            会被真实安装，函数包体积直接冲破 Netlify 的限额。仓库中名为
            ${code('overlay/')} 的是目录（存放本仓库的改造），两者不是同一回事。`,
        ],
      })}
    `
  )}
`

const limits = html`
  ${Block({ title: '已知限制' }, html`${List({ items: limitItems })}`)}
  ${Block(
    { title: '故障排查' },
    html`${Table({ head: ['现象', '原因', '处理'], rows: troubleRows })}`
  )}
  ${Callout(
    { tone: 'info', title: '先执行一次 /csv-depot/stats' },
    html`多数「评论数据异常」都能通过 ${code('GET /csv-depot/stats')} 定位：查看
      ${code('shards')}（分片数）、${code('pending')}（待提交数）、${code('misplaced')}
      （未归位的别名分片数），以及提交 / 冲突 / 重试 / 回滚的计数。`
  )}
  ${P({}, html`若上述条目未覆盖遇到的情况，可在仓库中提交 issue。`)}
`

const closing = html`
  ${P(
    {},
    html`这套方案的本质，是把「评论数据放哪」这个问题回答成「放在你自己的 git 仓库里」。
      它换来的是零外部依赖的备份、可回溯的变更记录，以及查询时不再下载整个数据集；代价是写入路径变长
      （一次评论一次提交）、仓库体积需要定期用 ${code('reset')} 清理，以及读跨实例有最长 60 秒的延迟。`
  )}
  ${P(
    {},
    html`如果站点规模在几十万条评论以内、写入不频繁，这些代价基本可以忽略；反过来，如果需要全文检索或者写入压力很大，
      还是老老实实换回带数据库的方案更合适。`
  )}
`

// ---------------------------------------------------------------------------
// 页面骨架
// ---------------------------------------------------------------------------

const Layout = (children) => html`
  <!doctype html>
  <html lang="zh-CN">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${config.siteName} · ${config.subtitle}</title>
      <meta
        name="description"
        content="我用一套自定义存储适配器替换了 @waline/vercel 的单文件 CSV 实现，把评论数据以 CSV 分片存放在 GitHub 仓库里。不用数据库，也不用对象存储：备份即仓库备份，每一次数据变更都留有 git 历史。"
      />
      <style>
${html(STYLE)}
      </style>
    </head>
    <body>
      ${children}
      <script>
${html(SCRIPT)}
      </script>
    </body>
  </html>
`

const Page = () =>
  Layout(html`
    <div class="doc">
      <header class="doc-head">
        <h1>${config.siteName}</h1>
        <p class="doc-subtitle">${config.subtitle}</p>
        <p class="doc-intro">
          本项目用一套自定义存储适配器替换了 @waline/vercel 的「单文件 CSV」实现，
          把评论数据以 CSV 分片文件的形式存放在 GitHub 仓库里。改造只换底层存储，上层业务逻辑零改动。
        </p>
        <p class="doc-intro">
          不用数据库，也不用对象存储，换来的好处很实际：备份即仓库备份，每一次数据变更都留有 git 历史。
          下面按「为什么改、改完是什么样、怎么部署、有哪些坑」的顺序来说。
        </p>
      </header>

      ${Chapter(
        {
          no: '01',
          id: 'overview',
          title: '为什么要换掉单文件 CSV',
          lead: '这个仓库建立在 walinejs/netlify-starter 之上。上游把全部评论放在 data/Comment.csv 一个文件里，评论一多，这套做法很快就不行了。差距有多大，测一次最清楚。',
        },
        overview
      )}
      ${Chapter(
        {
          no: '02',
          id: 'start',
          title: '五分钟上手',
          lead: '五个步骤，约五分钟。不需要数据库，也不需要对象存储。',
        },
        start
      )}
      ${Chapter(
        {
          no: '03',
          id: 'deploy',
          title: '完整部署教程',
          lead: '上一节给出五步摘要，这一节把每一步摊开：数据仓库怎么建、令牌怎么申请、Netlify 怎么接、前端怎么指过来。',
        },
        deploy
      )}
      ${Chapter(
        {
          no: '04',
          id: 'env',
          title: '环境变量清单',
          lead: '必填的就那几个，其余都有默认值，不配也能跑。下表把可调项一次列全。',
        },
        env
      )}
      ${Chapter(
        {
          no: '05',
          id: 'data',
          title: '数据长什么样',
          lead: '评论、用户与阅读量各占一张表，按 key 拆成分片，再由一份 manifest 记着每个分片在哪、有多少行。',
        },
        data
      )}
      ${Chapter(
        {
          no: '06',
          id: 'ops',
          title: '备份与运维',
          lead: '所有接口都挂在同一个 Netlify Function 的 /csv-depot 前缀下，需要管理员身份。备份即仓库备份，快照与恢复因此都很轻。',
        },
        ops
      )}
      ${Chapter(
        {
          no: '07',
          id: 'design',
          title: '写入可靠性设计',
          lead: '跑在 serverless 上、写入又完全依赖外部 API，「会不会丢评论」最需要交代清楚。这一节也顺带说明按需加载、内存占用，以及与上游有意为之的几处差异。',
        },
        design
      )}
      ${Chapter(
        {
          no: '08',
          id: 'source',
          title: '代码结构',
          lead: '所有改造都收在 overlay/ 一层里，和上游 starter 的 diff 一眼能看清。本页所有代码片段都在构建期从仓库真实文件截取，实现改了，手册跟着变。',
        },
        source
      )}
      ${Chapter(
        {
          no: '09',
          id: 'limits',
          title: '有哪些坑',
          lead: '先说边界在哪儿，再给一张按现象定位原因的对照表。',
        },
        limits
      )}
      ${Chapter(
        {
          no: '10',
          id: 'closing',
          title: '最后几句',
          lead: '把代价和收益摊开，再决定要不要用它。',
        },
        closing
      )}

      <footer class="doc-foot">
        <p>${config.siteName} · ${config.subtitle}</p>
        <p>
          <a href="https://waline.js.org/" rel="noreferrer noopener">Waline 文档</a> ·
          <a href="https://github.com/termermc/wunphile" rel="noreferrer noopener">Wunphile（本站用的 SSG）</a> ·
          <a href="https://github.com/walinejs/netlify-starter" rel="noreferrer noopener">上游 starter</a>
        </p>
      </footer>
    </div>
  `)

// ---------------------------------------------------------------------------
// 只注册一个页面；无参数构建，--dev / -d 启动本地开发服务器
// ---------------------------------------------------------------------------

const ssg = new Wunphile(import.meta.url)
ssg.page('/index.html', Page)
await ssg.cli()
