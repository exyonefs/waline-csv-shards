import { html } from 'wunphile'

import Layout from '../component/Layout.mjs'
import { PageHead, Block, P, List } from '../component/Blocks.mjs'
import { Table, code } from '../component/Table.mjs'
import Callout from '../component/Callout.mjs'
import Steps from '../component/Steps.mjs'
import CodeBlock from '../component/CodeBlock.mjs'
import config from '../config.mjs'

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

const DataPage = () =>
  Layout(
    {
      title: `数据布局 · ${config.siteName}`,
      description:
        'CSV 分片在数据仓库中的目录结构、分片路由规则、manifest 的作用、每张表的列定义，以及从旧版单文件方案迁移的步骤。',
      active: '/data/',
    },
    html`
      <div class="flex flex-col gap-10 md:gap-14">
        ${PageHead({
          title: '数据布局',
          lead: '评论、用户与阅读量各占一张表，每张表按 key 的哈希值拆分为若干分片，并由一份 manifest 记录分片清单。',
        })}
        ${Block({ title: '目录结构' }, html`${CodeBlock({ title: 'data/', code: tree })}`)}
        ${Block(
          {
            title: '分片规则',
            lead: '规则稳定且可预测，仅由 key 决定：同一个 key 始终映射到同一个分片族。',
          },
          html`
            ${Table({ head: ['表', '分片 key', '路径'], rows: shardRuleRows })}
            ${List({
              items: [
                html`Comment 与 Counter 以 url 的哈希值作为文件名：同一篇文章的评论必然位于同一个分片族内，因此按文章查询只需读取一个分片，局部写入也只影响一个分片。`,
                html`Users 只取 ${code('objectId')}
                  的前两位，且目录名与文件名相同：Users 的每一行对应一个独立的 key，若照搬四位前缀，10
                  万用户会产生约 10 万个单行文件；两位前缀把分片数收敛为有限的桶，每个分片容纳成百上千行。`,
              ],
            })}
          `
        )}
        ${Block(
          { title: '裂变与合并' },
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
            lead: '读取路径的核心。刷新时只拉取三张表的 manifest（3 次 API 调用），逐条比对 sha，只有真正发生变化的分片才会被下载。',
          },
          html`
            ${CodeBlock({ title: 'data/comments/_manifest.csv', code: manifestCsv })}
            ${P(
              {},
              html`manifest 与分片始终在同一次 Git 提交中落地，不会出现两者不一致的中间状态。`
            )}
          `
        )}
        ${Block(
          {
            title: 'CSV 列',
            lead: '每张表的规范列与 Waline 上层实际读写的字段一致。sticky、like、2fa 以及自定义计数器类型等动态列，以「规范列 ∪ 实际出现的动态列」的形式写入表头（动态列按字母序追加），因此表头稳定且不丢字段。',
          },
          html`
            ${Table({ head: ['表', '列'], rows: columnRows })}
            ${P(
              {},
              html`文件编码为 UTF-8，换行符为 LF，仅在必要时加引号（遵循 RFC 4180 转义）。时间列统一为
                ISO 8601（字典序即时间序），手工编辑时请保持该格式。`
            )}
          `
        )}
        ${Callout(
          { tone: 'warn', title: '当前实现不读取 data/Comment.csv' },
          html`如果此前使用的是官方单文件方案，需要把三个文件拆分为分片后再迁移；没有历史数据时可跳过下一节。`
        )}
        ${Block(
          {
            title: '从旧版迁移',
            lead: '一次性本地操作。拆分逻辑复用 overlay/csv-depot 的分片规则，保证与线上使用的是同一套实现（需要先执行 npm install）。',
          },
          html`
            ${CodeBlock({ title: 'migrate.js', code: migrateScript })}
            ${P({}, html`迁移完成后：`)} ${Steps({ items: migrateSteps })}
          `
        )}
      </div>
    `
  )

export default DataPage
