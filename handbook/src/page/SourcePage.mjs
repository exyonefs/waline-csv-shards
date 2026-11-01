import { html } from 'wunphile'

import Layout from '../component/Layout.mjs'
import { PageHead, Block, P, List } from '../component/Blocks.mjs'
import { Table, code } from '../component/Table.mjs'
import Callout from '../component/Callout.mjs'
import CodeBlock from '../component/CodeBlock.mjs'
import { readRepoFile, excerpt } from '../util/source.mjs'
import config from '../config.mjs'

// 下面每一段都是从仓库真实文件里现截的，标记失效会在构建期直接报错。
const entrySource = readRepoFile('netlify/functions/comment.js')

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

const tree = `netlify/functions/comment.js    # 唯一改动的上游文件：Waline({ model, plugins })
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
    'netlify/functions/comment.js',
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
node --no-experimental-require-module -e "require('./netlify/functions/comment.js')"`

const packSnippet = `npm run pack:stubs      # 重新打包两个本地包 → overlay/*.tgz
rm package-lock.json    # 让 npm 从零解析（overrides 变动时必须执行）
npm install             # 重建 node_modules 与 lockfile`

const upgradeSnippet = `git remote add upstream https://github.com/walinejs/netlify-starter.git
git fetch upstream
git merge upstream/master --no-ff`

const SourcePage = () =>
  Layout(
    {
      title: `源码走读 · ${config.siteName}`,
      description:
        '从唯一改动的上游文件出发，逐段阅读分片路由、按需加载、冲突合并、原子提交、乐观锁与自愈的实现，以及代码结构、本地开发与同步上游的方法。',
      active: '/source/',
    },
    html`
      <div class="flex flex-col gap-10 md:gap-14">
        ${PageHead({
          title: '源码走读',
          lead: '本页所有代码片段都在构建期从仓库真实文件中截取，而非复制粘贴——实现改动后，这里的片段随之变化。',
        })}
        ${Block(
          {
            title: '代码结构',
            lead: '仓库保持「上游 + 补丁」的形状：所有改造收在 overlay/ 一层目录内，根目录不新增任何平级目录，因此与上游 starter 的差异可以一眼看清。',
          },
          html`
            ${CodeBlock({ title: '仓库结构', code: tree })}
            ${Table({ head: ['文件', '职责'], rows: fileRows })}
          `
        )}
        ${Block(
          {
            title: '唯一的上游接线点',
            lead: '整个改造只改动了这一个上游文件：把 model 换成 CSV 分片适配器，再添加一个插件提供「响应前刷盘」与运维接口。两者都是官方扩展点，因此上层业务逻辑未作修改。',
          },
          html`
            ${CodeBlock({ title: 'netlify/functions/comment.js', code: entrySource })}
          `
        )}
        ${Block(
          {
            title: '分片路由：一个 key 始终映射到同一个族',
            lead: '整套存储的前提包含在这十几行内。Comment 与 Counter 使用 url 的 sha1；Users 每行一个 key，因此只取两位前缀，以避免产生上万个单行文件。',
          },
          html`
            ${CodeBlock({ title: 'overlay/csv-depot/shard-manager.js', code: shardRouting })}
          `
        )}
        ${Block(
          {
            title: '按需加载：把 where 收敛为分片族',
            lead: '能够收敛时只加载命中的族，无法收敛时读取整表——宁可多读，也不返回不完整的结果。这正是「5 万条评论查询 0.20 ms、下载 0 B」的来源。',
          },
          html`
            ${CodeBlock({ title: 'overlay/csv-depot/csv-shard-cache.js', code: scopeSource })}
          `
        )}
        ${Block(
          {
            title: '冲突合并：本地优先，计数走增量',
          lead: '被 GitHub 拒绝后重新拉取，只下载 sha 发生变化的分片，再按三条规则合并。Counter 属于例外——两个实例各加一次的阅读量不应被后提交者覆盖。',
          },
          html`
            ${CodeBlock({ title: 'overlay/csv-depot/csv-shard-cache.js', code: mergeSource })}
          `
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
          html`
            ${CodeBlock({ title: 'overlay/csv-depot/shard-write-queue.js', code: atomicSource })}
          `
        )}
        ${Block(
          {
            title: '乐观锁：force=false 是冲突可见的原因',
          lead: '读取顺序固定为「先读 head、再读数据」，提交时以非快进方式更新 ref。只要在读取数据之后有其他提交产生，本次更新就会被 GitHub 拒绝。',
          },
          html`
            ${CodeBlock({ title: 'overlay/csv-depot/github-client.js', code: refSource })}
          `
        )}
        ${Block(
          {
            title: '自愈：搬迁失败不影响读取',
          lead: '页面地址变更留下的错位行由这一步搬回规范分片。同一张表的并发搬迁只执行一次，且失败时仍使用未搬迁的数据响应——错位可以等待，评论列表读不出来才是故障。',
          },
          html`
            ${CodeBlock({ title: 'overlay/csv-depot/csv-shard-cache.js', code: healSource })}
          `
        )}
        ${Block(
          {
            title: '快照为什么是清单而不是副本',
          lead: '若采用副本，文件数会变为「分片数 × 保留天数」，2000 个分片保留 30 天约等于 6 万条，正好撞上 Git Trees API 的截断上限，而且是在最需要快照的时候撞上。清单只引用已有 blob，不产生上传。',
          },
          html`
            ${CodeBlock({ title: 'overlay/csv-depot/snapshot.js', code: snapshotSource })}
          `
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
                  1.43.4。跟进上游新版本时需注意：升级会牵动 ${code('netlify/functions/comment.js')}
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
      </div>
    `
  )

export default SourcePage
