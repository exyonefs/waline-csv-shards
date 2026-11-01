import { html } from 'wunphile'

import Layout from '../component/Layout.mjs'
import FeatureCard, { Stat } from '../component/FeatureCard.mjs'
import { Hero, Block, P, List, CardGrid, Panel, DeployBadge } from '../component/Blocks.mjs'
import { Table, code } from '../component/Table.mjs'
import Callout from '../component/Callout.mjs'
import { primaryButton, secondaryButton } from '../component/ui.mjs'
import config from '../config.mjs'

const iconShard = html`<svg
  width="22"
  height="22"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.7"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <ellipse cx="12" cy="5.5" rx="7.5" ry="3" />
  <path d="M4.5 5.5v6c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3v-6" />
  <path d="M4.5 12v6c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3v-6" />
</svg>`

const iconIndex = html`<svg
  width="22"
  height="22"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.7"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M4 6h16M4 12h16M4 18h10" />
  <circle cx="19" cy="18" r="2" />
</svg>`

const iconSnapshot = html`<svg
  width="22"
  height="22"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.7"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M4 8.5V19a1.5 1.5 0 001.5 1.5h13A1.5 1.5 0 0020 19V8.5" />
  <path d="M3 5.5A1.5 1.5 0 014.5 4h15A1.5 1.5 0 0121 5.5v1A1.5 1.5 0 0119.5 8h-15A1.5 1.5 0 013 6.5v-1z" />
  <path d="M12 12.5v5M9.5 15l2.5 2.5 2.5-2.5" />
</svg>`

const compareRows = [
  [
    '数据布局',
    'data/Comment.csv 单个文件',
    'data/comments/<xx>/<xxxx>.csv 按分片族存放，另配 _manifest.csv',
  ],
  ['查询方式', '下载整个 CSV 后逐行过滤', '按分片族按需加载并命中内存索引，只读取命中的分片'],
  ['写入单位', '重写整个 CSV', '只重写受影响的分片，一个请求内的变更合并为一次提交'],
  [
    '并发安全',
    '无（后写入覆盖先写入）',
    '分片 SHA 校验 + ref 非快进更新 + 冲突后自动合并重试',
  ],
  ['备份', '未提供', '每日快照、按日期恢复、仓库瘦身'],
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
  ['数据仓库', '存放 data/ 目录下全部 CSV 分片的 GitHub 仓库，需要与站点仓库分开'],
  ['分片', '一个 CSV 文件，是读取与写入的最小单位'],
  ['分片族', '同一哈希前缀下的全部分片，对应一个 key 的取值范围'],
  ['规范分片', '由 key 经哈希规则计算得出、该 key 的数据应当所在的分片'],
  ['别名分片', '路径与其中数据的 key 不匹配的分片，刷新时会被登记并搬回规范分片'],
  ['错位行', '存放在非规范分片中的数据行，前台读取时不可见'],
  ['manifest', '每张表一份的 _manifest.csv，记录分片路径、行数、SHA 与起止 key'],
  ['刷盘', '把内存中累积的变更合并为一次 Git 提交并推送到数据仓库'],
]

const IndexPage = () =>
  Layout(
    {
      title: `${config.siteName} · ${config.tagline}`,
      description:
        '在 Netlify 上运行 Waline，评论、用户与阅读量以 CSV 分片存放在一个独立的 GitHub 仓库中：不引入外部数据库或对象存储，备份数据仓库即备份全部数据。',
      active: '/',
    },
    html`
      <div class="flex flex-col gap-10 md:gap-14">
        ${Hero(
          {
            title: '在 Netlify 上运行 Waline，评论数据以 CSV 分片存放在 GitHub 仓库',
            lead: '本仓库以 walinejs/netlify-starter 为基础，用一套自定义存储适配器替换其单文件 CSV 实现。改动只发生在存储层：评论、用户与阅读量写入一个独立的 GitHub 数据仓库，不引入外部数据库，也不引入对象存储。',
          },
          html`
            <div class="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <a href="/start/" class="${primaryButton}">五分钟上手</a>
              <a href="/source/" class="${secondaryButton}">阅读源码</a>
              ${DeployBadge()}
            </div>
          `
        )}

        ${Block(
          {
            title: '方案概要',
            lead: '三条主线：存储形态、读取路径、写入可靠性。',
          },
          html`
            ${CardGrid(
              { columns: 3 },
              html`
                ${FeatureCard({
                  title: '存储形态',
                  description:
                    '数据以 CSV 分片存放在专用数据仓库的 data/ 目录下，按 key 的哈希值分族。备份数据仓库即备份全部数据，每一次变更都对应一次提交。',
                  icon: iconShard,
                })}
                ${FeatureCard({
                  title: '读取路径',
                  description:
                    '刷新时只拉取三张表的 manifest，比对 SHA 后仅下载发生变化的分片。命中索引后的查询是纯内存操作，不产生 GitHub 请求。',
                  icon: iconIndex,
                })}
                ${FeatureCard({
                  title: '写入可靠性',
                  description:
                    '变更先作用于内存再异步提交；每次响应返回前执行一次刷盘，刷盘失败则把响应改写为 5xx，不会让客户端误以为保存成功。',
                  icon: iconSnapshot,
                })}
              `
            )}
          `
        )}

        ${Block(
          {
            title: '实测数据',
            lead: '数据由 npm run benchmark 生成，基准脚本与报告位于 overlay/benchmark/，可在本地复现。基准为隔离单次查询成本，将 CSV_CACHE_TTL 设为 1 小时。',
          },
          html`
            <div class="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
              ${Stat({ value: '0.20 ms', label: '单次评论列表查询（5 万条 / 990 分片）' })}
              ${Stat({ value: '1.76 ms', label: '一次列表页完整渲染（5 万条）' })}
              ${Stat({ value: '4 次', label: '冷启动读取 manifest 与命中分片的 API 调用' })}
            </div>
            ${Table({ head: ['场景', '上游单文件方案', '本仓库多分片方案'], rows: benchRows })}
            ${P(
              {},
              html`冷启动只读取三张表的 manifest 与命中文章所在的分片，成本与全站评论总量基本无关。`
            )}
          `
        )}

        ${Block(
          {
            title: '与上游实现的差异',
            lead: '本仓库仅替换存储适配器，未改动上层业务逻辑。下表列出为与 Waline 实际契约对齐而有意保留的差异。',
          },
          html`${Table({ head: ['维度', '上游单文件方案', '本仓库多分片方案'], rows: compareRows })}`
        )}

        ${Block(
          {
            title: '分片路由的组成部分',
            lead: '整套存储的前提是一句约定：由 key 计算出分片族，读写都只进入该族。',
          },
          html`
            ${CardGrid(
              { columns: 3 },
              html`
                ${FeatureCard({
                  title: '按 url 哈希分片',
                  description:
                    '同一篇文章的评论必然落在同一个分片族内，因此按文章查询只读一个分片，局部写入也只影响一个分片。',
                  icon: iconShard,
                })}
                ${FeatureCard({
                  title: 'manifest 记录 sha',
                  description:
                    '刷新时只拉取三张表的 manifest，逐条比对 sha，只有真正发生变化的分片才会被下载。manifest 与分片始终在同一次提交中落地。',
                  icon: iconIndex,
                })}
                ${FeatureCard({
                  title: '快照只引用 blob',
                  description:
                    '每日快照是一份 path,sha 清单，不上传文件内容，因此分片数量增加不会放大提交体积。',
                  icon: iconSnapshot,
                })}
              `
            )}
          `
        )}

        ${Block(
          { title: '适用范围' },
          html`
            ${CardGrid(
              {},
              html`
                ${Panel(
                  {},
                  html`
                    <h3 class="font-semibold text-[#0a2540] text-base md:text-lg">适用</h3>
                    <div class="mt-4">
                      ${List({
                        items: [
                          '个人博客与中小型站点',
                          '评论总量在数十万条以内',
                          '希望不维护数据库，也不配置对象存储',
                          '希望每一次数据变更都能在 Git 历史中查到',
                        ],
                      })}
                    </div>
                  `
                )}
                ${Panel(
                  {},
                  html`
                    <h3 class="font-semibold text-[#0a2540] text-base md:text-lg">不适用</h3>
                    <div class="mt-4">
                      ${List({
                        items: [
                          '高频并发写入：每条评论约 7 次 GitHub API 调用',
                          '需要全文检索：后端只实现了 Waline 实际用到的 where 子集',
                          '数据量增长到仓库体积本身成为瓶颈',
                        ],
                      })}
                    </div>
                  `
                )}
              `
            )}
          `
        )}

        ${Callout(
          { tone: 'warn', title: '数据仓库不要指向站点仓库自身' },
          html`每次写入评论都会向数据仓库提交一次 commit。两者若为同一仓库，Netlify
            会把每次提交视为部署触发，形成「写入 → 部署 → 写入」的循环。`
        )}

        ${Block(
          { title: '术语' },
          html`
            ${Table({ head: ['术语', '含义'], rows: termRows })}
          `
        )}

        ${Block(
          { title: '手册结构' },
          html`
            ${P(
              {},
              html`目录按「开始 → 配置与数据 → 运维 → 深入实现 →
                参考」分为五段。前两段是上线前需要读完的，其余三段可按需查阅。`
            )}
            ${P(
              {},
              html`站点由 Wunphile（单文件、零依赖的 Node SSG）在构建期生成静态
                HTML；评论区调用的是本站自身的 Netlify Function。源码片段在构建期从
                ${code('overlay/csv-depot/')} 现读，实现改动后本页内容随之变化。`
            )}
            ${P(
              {},
              html`本站选用 Wunphile，只是为了在 Node.js 生态下选择一个合适的轻量化
                SSG，并不构成对其它实现的取舍评价。也欢迎来体验作者使用 .NET F#
                开发的 SSG：
                <a
                  href="https://github.com/exyonefs/zest"
                  rel="noreferrer noopener"
                  class="font-semibold text-[#635bff] transition-colors duration-200 ease-out hover:text-[#5148d9]"
                  >zest</a
                >。`
            )}
          `
        )}
      </div>
    `
  )

export default IndexPage
