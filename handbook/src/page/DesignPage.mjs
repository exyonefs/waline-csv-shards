import { html } from 'wunphile'

import Layout from '../component/Layout.mjs'
import { PageHead, Block, P, List } from '../component/Blocks.mjs'
import { Table, code } from '../component/Table.mjs'
import Callout from '../component/Callout.mjs'
import Steps from '../component/Steps.mjs'
import config from '../config.mjs'

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

const DesignPage = () =>
  Layout(
    {
      title: `可靠性设计 · ${config.siteName}`,
      description:
        '写入为什么要「响应前落盘」、乐观锁与冲突合并如何实现，以及与上游实现有意保留的差异、按需加载范围与内存预算。',
      active: '/design/',
    },
    html`
      <div class="flex flex-col gap-10 md:gap-14">
        ${PageHead({
          title: '可靠性设计',
          lead: '本章说明写入链路为何不会丢失数据、并发冲突如何合并，以及为与 Waline 实际契约对齐而保留的差异。',
        })}
        ${Block(
          { title: '写入可靠性' },
          html`
            ${Steps({ items: reliability })}
          `
        )}
        ${Block(
          {
            title: '与上游实现的差异',
            lead: '本改造只替换底层存储适配器，未改动任何上层业务逻辑。以下几处必须与 Waline 的实际契约对齐，因此与上游存在有意为之的差异。',
          },
          html`
            ${Table({ head: ['差异点', '说明'], rows: diffRows })}
          `
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
      </div>
    `
  )

export default DesignPage
