/**
 * 页面的少量交互：复制代码块、代码着色、按域名生成接入片段。
 *
 * 没有用 Wunphile 的 client behavior：1.2.3 的 behavior loader 在同一页出现
 * 两个 behavior 组件时会把两条 import 语句直接拼在一起（中间没有分隔符），
 * 生成的是非法 JS。这里用一个普通静态模块 + 事件委托代替，零构建步骤。
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

    if (char === '"' || char === "'" || char === '`') {
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
// 复制按钮：委托到 document，评论等动态插入的内容也能生效
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
      ? 'https://' + host + '/.netlify/functions/comment'
      : 'https://<你的站点>/.netlify/functions/comment'

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
