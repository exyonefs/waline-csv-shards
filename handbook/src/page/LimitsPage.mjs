import { html } from 'wunphile'

import Layout from '../component/Layout.mjs'
import { PageHead, Block, P, List } from '../component/Blocks.mjs'
import { Table, code } from '../component/Table.mjs'
import Callout from '../component/Callout.mjs'
import config from '../config.mjs'

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
    '路径不正确（Netlify 环境下没有 /api 前缀），或函数未正常启动',
    '使用 /.netlify/functions/comment/ui/register；查看 Function 日志',
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

const LimitsPage = () =>
  Layout(
    {
      title: `限制与排查 · ${config.siteName}`,
      description: '本方案的已知限制，以及常见故障的现象、原因与处理方式。',
      active: '/limits/',
    },
    html`
      <div class="flex flex-col gap-10 md:gap-14">
        ${PageHead({
          title: '限制与排查',
          lead: '先说明边界所在，再提供按现象定位原因的对照表。',
        })}
        ${Block(
          { title: '已知限制' },
          html`
            ${List({ items: limitItems })}
          `
        )}
        ${Block(
          { title: '故障排查' },
          html`
            ${Table({ head: ['现象', '原因', '处理'], rows: troubleRows })}
          `
        )}
        ${Callout(
          { tone: 'info', title: '先执行一次 /csv-depot/stats' },
          html`多数「评论数据异常」都能通过 ${code('GET /csv-depot/stats')} 定位：查看
            ${code('shards')}（分片数）、${code('pending')}（待提交数）、${code('misplaced')}
            （未归位的别名分片数），以及提交 / 冲突 / 重试 / 回滚的计数。`
        )}
        ${P(
          {},
          html`若上述条目未覆盖遇到的情况，可在页面底部留言，或在仓库中提交 issue。`
        )}
      </div>
    `
  )

export default LimitsPage
