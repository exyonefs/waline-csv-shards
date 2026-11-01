import { html } from 'wunphile'

import Layout from '../component/Layout.mjs'
import { PageHead, Block, P, List, DeployBadge } from '../component/Blocks.mjs'
import { Table, code } from '../component/Table.mjs'
import Callout from '../component/Callout.mjs'
import Steps from '../component/Steps.mjs'
import CodeBlock from '../component/CodeBlock.mjs'
import ServerUrlBuilder from '../component/ServerUrlBuilder.mjs'
import { primaryButton } from '../component/ui.mjs'
import config from '../config.mjs'

const tokenRows = [
  ['Token name', '自定义，例如 waline-comments'],
  ['Expiration', '建议 90 天或自定义；到期未更换时评论接口会开始返回 500'],
  ['Repository access', 'Only select repositories → 选择上一步创建的数据仓库'],
  ['Permissions → Contents', 'Read and write'],
]

const netlifyRows = [
  ['Base directory', '留空'],
  ['Build command', 'npm run site:build'],
  ['Publish directory', 'handbook/dist'],
  ['Functions directory', 'netlify/functions/（已在 netlify.toml 中配置）'],
  ['Node version', '24（已在 netlify.toml 中配置）'],
]

const walineSnippet = `<link rel="stylesheet" href="https://unpkg.com/@waline/client@v3/dist/waline.css" />
<div id="waline"></div>
<script type="module">
  import { init } from 'https://unpkg.com/@waline/client@v3/dist/waline.js';

  init({
    el: '#waline',
    serverURL: '${config.waline.serverURL}',
  });
</script>`

const apiRedirect = `[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/comment/:splat"
  status = 200`

const netlifyToml = `[build]
  command = "npm run site:build"
  publish = "handbook/dist"`

const checkList = [
  {
    title: '打开函数根路径',
    body: html`${code('https://<站点>/.netlify/functions/comment')} 为 Waline
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

const DeployPage = () =>
  Layout(
    {
      title: `部署 · ${config.siteName}`,
      description:
        '从准备数据仓库与 GitHub 令牌，到接入 Netlify、注册管理员、前端接入与上线验证的完整步骤。',
      active: '/deploy/',
    },
    html`
      <div class="flex flex-col gap-10 md:gap-14">
        ${PageHead({
          title: '部署',
          lead: '「快速开始」给出五步摘要，本章逐步说明每一步需要准备的内容与填写方式。',
        })}
        ${Block(
          { title: '一键部署' },
          html`
            ${P(
              {},
              html`如果想跳过手动 Fork，点击下面的按钮会直接以 starter 仓库创建一个属于你的
                Netlify 站点；创建完成后回到本章，按顺序补齐数据仓库、令牌与环境变量即可。`
            )}
            <div>${DeployBadge()}</div>
          `
        )}
        ${Block(
          {
            title: '准备数据仓库',
            lead: '新建一个 GitHub 仓库，例如 your-name/waline-comments，其余选项保持默认。',
          },
          html`
            ${List({
              items: [
                html`建议设为 Private：评论 CSV 中包含 ${code('mail')}、${code('ip')}、${code('ua')}
                  等字段，公开仓库等同于公开这些信息。`,
                '无需勾选 Add a README：本方案在空仓库上同样可用，首次写入时会自动创建分支与首个提交。',
                html`若仓库已有内容且存在 ${code('main')} 分支，将 ${code('GITHUB_BRANCH')}
                  指向该分支即可。`,
                '一个数据仓库只服务一个站点。多站点共用会让提交相互干扰。',
              ],
            })}
          `
        )}
        ${Block(
          {
            title: '准备 GitHub 访问令牌',
            lead: 'Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token。',
          },
          html`
            ${Table({ head: ['配置项', '填写内容'], rows: tokenRows })}
            ${P({}, html`令牌只在生成后显示一次，请立即复制保存。`)}
          `
        )}
        ${Block(
          {
            title: 'Fork 并接入 Netlify',
            lead: 'Add new site → Import an existing project → 选择已 Fork 的仓库。',
          },
          html`
            ${Table({ head: ['配置项', '值'], rows: netlifyRows })}
            ${P(
              {},
              html`建议先配置环境变量再触发首次部署。各变量的含义见「环境变量」一章。`
            )}
            ${Callout(
              { tone: 'warn', title: 'Fork 后需要修改的一处配置' },
              html`${code('netlify.toml')}
                末尾有一条 favicon 重定向指向本仓库作者的站点，请替换为你自己的图标地址，或直接删除该段配置。`
            )}
            ${P({}, html`手册自身的构建方式见本章末尾。`)}
          `
        )}
        ${Block(
          { title: '注册管理员' },
          html`
            ${P(
              {},
              html`部署成功后访问以下地址。注意 Netlify 的函数路径没有 ${code('/api')} 前缀：`
            )}
            ${CodeBlock({
              title: '浏览器地址栏',
              code: 'https://<你的站点>/.netlify/functions/comment/ui/register',
            })}
            ${P(
              {},
              html`第一个注册的账号自动成为管理员，后台入口位于同一目录下的
                ${code('/ui/login')}。若注册页返回 500，请先查看 Function 日志，常见原因是
                ${code('GITHUB_TOKEN')} 或 ${code('GITHUB_REPO')} 配置有误。`
            )}
          `
        )}
        ${Block(
          { title: '前端接入' },
          html`
            ${CodeBlock({ title: 'index.html', code: walineSnippet })}
            ${P(
              {},
              html`静态站点框架（Hexo、VitePress、Astro 等）的接入方式相同，只需将
                ${code('serverURL')} 指向该地址。末尾不要带斜杠，也不要添加 ${code('/api')}
                后缀——本仓库未配置 ${code('/api')} 重定向。`
            )}
            ${P(
              {},
              html`如需更短的 ${code('serverURL')}，可在 ${code('netlify.toml')}
                中添加一条重定向，之后即可写成 ${code('https://<你的站点>/api')}：`
            )}
            ${CodeBlock({ title: 'netlify.toml', code: apiRedirect })}
            ${P({}, html`填入自己的域名，直接生成可复制的接入片段：`)} ${ServerUrlBuilder()}
          `
        )}
        ${Block({ title: '部署后验证' }, html`${Steps({ items: checkList })}`)}
        ${Block(
          {
            title: '手册的构建方式',
            lead: '手册源码位于 handbook/，依赖与脚本挂在仓库根目录的 package.json 上，因此构建只需一条指令。',
          },
          html`
            ${CodeBlock({ title: 'netlify.toml', code: netlifyToml })}
            ${P(
              {},
              html`不要设置 base 目录。一旦把构建根目录移到 ${code('handbook/')}，
                ${code('netlify/functions/')} 的路径也会随之错位，评论函数将无法被找到。`
            )}
            ${P(
              {},
              html`本地预览使用 ${code('npm run site:dev')}，构建产物输出到
                ${code('handbook/dist')}。`
            )}
            <div><a href="/env/" class="${primaryButton}">查看环境变量</a></div>
          `
        )}
      </div>
    `
  )

export default DeployPage
