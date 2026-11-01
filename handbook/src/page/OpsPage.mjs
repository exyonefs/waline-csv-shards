import { html } from 'wunphile'

import Layout from '../component/Layout.mjs'
import { PageHead, Block, P, List } from '../component/Blocks.mjs'
import { Table, code } from '../component/Table.mjs'
import Callout from '../component/Callout.mjs'
import Steps from '../component/Steps.mjs'
import CodeBlock from '../component/CodeBlock.mjs'
import config from '../config.mjs'

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
    '把交错分片中的行搬回规范分片并返回搬迁报告；正常情况下刷新时会自动执行',
  ],
  ['POST', '/csv-depot/flush', '手动把内存中待提交的变更落盘'],
  [
    'GET',
    '/csv-depot/stats',
    '运行指标：提交 / 冲突 / 重试 / 回滚次数、GitHub 请求数、各表分片数、待提交数，以及未归位的交错分片数（misplaced）',
  ],
  [
    'POST',
    '/csv-depot/reset',
    '不可逆：丢弃全部历史提交，只保留当前数据；需要显式传入 confirm=1',
  ],
]

const curlSnippet = `BASE=https://<站点>/.netlify/functions/comment/csv-depot
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

const OpsPage = () =>
  Layout(
    {
      title: `备份与运维 · ${config.siteName}`,
      description:
        '快照、恢复、仓库瘦身、分片压缩与错位修复等运维接口，以及页面地址变更后评论不可见时的自愈机制。',
      active: '/ops/',
    },
    html`
      <div class="flex flex-col gap-10 md:gap-14">
        ${PageHead({
          title: '备份与运维',
          lead: '运维接口统一挂载在同一个 Netlify Function 的 /csv-depot 前缀下，全部需要管理员身份。',
        })}
        ${Block(
          {
            title: '接口一览',
            lead: html`完整路径为
              ${code('https://<站点>/.netlify/functions/comment/csv-depot/<action>')}；若已配置
              ${code('/api')} 重定向，则为 ${code('https://<站点>/api/csv-depot/<action>')}。`,
          },
          html`
            ${Table({ head: ['方法', '路径', '作用'], rows: opsRows })}
          `
        )}
        ${Block(
          { title: '调用方式' },
          html`
            ${CodeBlock({ title: 'bash', code: curlSnippet })}
            ${P(
              {},
              html`token 从浏览器中获取：登录后台后打开 DevTools → Network，任选一个后台请求，复制其
                ${code('Authorization: Bearer xxxxx')}
                部分。接口只识别 Authorization 请求头，不支持把 token 放在 URL query
                中（会被代理日志记录）。 ${code('restore')} 的 ${code('date')} 必须为
                ${code('YYYY-MM-DD')} 格式，非法值会直接报错，不会用于拼接路径。`
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
            lead: '写入即提交，历史中会累积每一次分片重写产生的 blob。仓库体积只增不减，时间一长会接近 GitHub 的建议上限。',
          },
          html`
            ${List({
              items: [
                '用当前 data/ 下的文件构造一个没有父提交的 commit，并强制更新分支指针；',
                html`仓库回到「只有一个提交」的状态，${code('.git')}
                  体积随之降至当前数据的大小；`,
                html`快照目录同样只是历史负担，默认一并丢弃；需要保留请传
                  ${code('keepSnapshots=1')}；`,
                '相比「新建仓库再切换环境变量」更直接：没有两份数据并存的切换窗口，也不需要改动配置。',
              ],
            })}
            ${Callout(
              { tone: 'warn', title: '重置不会删除评论' },
              html`reset 只清零 git 历史。它会把 ${code('data/')}
                下的全部当前文件（含 ${code('data/comments/**')}、${code('data/users/**')}、${code('data/counters/**')}
                ）以 ${code('{sha}')}
                的形式原样带入新提交，引用现有 blob，内容不发生任何变化——重置后的评论、用户与阅读量与重置前完全一致。唯一会丢失的是
                ${code('_snapshots/')} 快照目录，需要保留请传 ${code('keepSnapshots=1')}。`
            )}
            ${P({}, html`操作前建议先执行 ${code('POST /csv-depot/snapshot')}
              创建快照，确认无误后再执行 reset。`)}
          `
        )}
        ${Block(
          {
            title: '页面地址变更后评论不可见',
            lead: '页面 A 迁移到页面 B（例如 /friends/ → /links/）时，如果只修改了 CSV 中的 url 列而未移动文件，数据行会留在旧地址哈希出的分片中，成为错位行。',
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
      </div>
    `
  )

export default OpsPage
