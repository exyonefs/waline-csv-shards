import { html } from 'wunphile'

import Layout from '../component/Layout.mjs'
import { PageHead, Block, P, List } from '../component/Blocks.mjs'
import { Table, code } from '../component/Table.mjs'
import Callout from '../component/Callout.mjs'
import CodeBlock from '../component/CodeBlock.mjs'
import config from '../config.mjs'

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

const netlifyToml = `[build.environment]
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
  WALINE_SERVER_URL = "https://<你的站点>/.netlify/functions/comment"`

const EnvPage = () =>
  Layout(
    {
      title: `环境变量 · ${config.siteName}`,
      description:
        '按来源分为三层：Waline 运行所需项、本仓库存储层的可调参数、Waline 官方提供的常用可选项。',
      active: '/env/',
    },
    html`
      <div class="flex flex-col gap-10 md:gap-14">
        ${PageHead({
          title: '环境变量',
          lead: '三层变量：Waline 本身需要的、本仓库存储层新增的，以及 Waline 官方提供的常用可选项。',
        })}
        ${Block(
          { title: '必需项与建议项' },
          html`
            ${Table({
              head: ['变量', '是否必需', '默认 / 示例', '说明'],
              rows: requiredRows,
            })}
          `
        )}
        ${Block(
          {
            title: '存储层可调参数',
            lead: '这一层是本改造新增的，均有默认值，不配置亦可运行。仅在需要调整分片粒度、缓存时长或快照策略时才需要修改。',
          },
          html`
            ${Table({ head: ['变量', '默认', '说明'], rows: storeRows })}
          `
        )}
        ${Callout(
          { tone: 'info', title: 'COMMENT_AUDIT 不改变存储行为' },
          html`${code('COMMENT_AUDIT=true')} 时新评论默认处于 ${code('waiting')}
            状态，管理员在后台批准后才出现在前台。这属于 Waline 自身的审核工作流，存储层只如实保存
            ${code('status')} 字段。`
        )}
        ${Block(
          {
            title: '常用 Waline 变量',
            lead: '与官方行为完全一致，按需添加。',
          },
          html`
            ${Table({ head: ['变量', '说明'], rows: walineRows })} ${P({}, html`其余变量见
              Waline 官方文档。本改造不改动任何上层行为，只替换底层存储。`)}
          `
        )}
        ${Block(
          {
            title: '配置位置',
            lead: 'Netlify：Site configuration → Environment variables。修改后需要重新部署才会生效。',
          },
          html`
            ${CodeBlock({ title: 'netlify.toml', code: netlifyToml })}
            ${List({
              items: [
                html`本地开发建议另建一个测试仓库，把 ${code('GITHUB_TOKEN')} 与
                  ${code('GITHUB_REPO')} 写入 ${code('.env')} 后运行 ${code('netlify dev')}（需要
                  Netlify CLI）。${code('.env')} 已在 .gitignore 中。`,
                html`${code('WALINE_SERVER_URL')} 是手册自身的构建期变量：Wunphile
                  在构建时把它写入产物 HTML，因此评论区无需在浏览器中再次配置。`,
                '不要直接使用线上数据仓库做实验，先执行 POST /csv-depot/snapshot 创建快照。',
              ],
            })}
          `
        )}
      </div>
    `
  )

export default EnvPage
