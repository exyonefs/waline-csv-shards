import { html } from 'wunphile'

import Layout from '../component/Layout.mjs'
import { PageHead, Block, P, CardGrid, Panel } from '../component/Blocks.mjs'
import { code } from '../component/Table.mjs'
import Callout from '../component/Callout.mjs'
import Steps from '../component/Steps.mjs'
import { primaryButton } from '../component/ui.mjs'
import config from '../config.mjs'

const quickStart = [
  {
    title: '新建一个空的 GitHub 仓库作为数据仓库',
    body: '建议设为 Private。站点仓库与数据仓库需要分开，原因见下方说明。',
  },
  {
    title: '申请一个 Fine-grained personal access token',
    body: html`仅授权该数据仓库的 ${code('Contents: Read and write')}。`,
  },
  {
    title: 'Fork 本仓库，在 Netlify 中选择 Import from Git，填写环境变量后部署',
    body: '必需变量为 GITHUB_TOKEN 与 GITHUB_REPO，另建议设置 JWT_TOKEN。',
  },
  {
    title: '打开 /ui/register 注册管理员',
    body: html`即 ${code('https://<站点>/.netlify/functions/comment/ui/register')}。第一个注册的账号自动获得管理员权限。`,
  },
  {
    title: '将前端的 serverURL 指向 /comment',
    body: html`即 ${code('https://<站点>/.netlify/functions/comment')}。`,
  },
]

const paths = [
  {
    title: '我要完成部署',
    body: html`前往「部署」：数据仓库的创建方式、令牌的申请步骤、Netlify 中每一项配置的含义，以及前端接入代码。`,
    href: '/deploy/',
    cta: '查看部署步骤',
  },
  {
    title: '我要理解仓库里的 CSV',
    body: html`前往「数据布局」：目录结构、分片规则、manifest 的作用、每张表的列，以及从旧版单文件方案迁移的方法。`,
    href: '/data/',
    cta: '查看数据布局',
  },
  {
    title: '我要修改实现',
    body: html`前往「源码走读」：从唯一改动的上游文件出发，逐段阅读分片路由、按需加载、冲突合并与原子提交。`,
    href: '/source/',
    cta: '阅读源码',
  },
]

const StartPage = () =>
  Layout(
    {
      title: `快速开始 · ${config.siteName}`,
      description: '五个步骤在 Netlify 上运行 Waline，随后按目的选择后续章节。',
      active: '/start/',
    },
    html`
      <div class="flex flex-col gap-10 md:gap-14">
        ${PageHead({
          title: '快速开始',
          lead: '五个步骤完成部署，约需五分钟。不需要数据库，也不需要对象存储。',
        })}
        ${Block({ title: '部署步骤' }, html`${Steps({ items: quickStart })}`)}
        ${Callout(
          { tone: 'warn', title: '数据仓库不要指向站点仓库自身' },
          html`每次写入评论都会向数据仓库提交一次 commit。两者若为同一仓库，Netlify
            会把每次提交视为部署触发，形成「写入 → 部署 → 写入」的循环。`
        )}
        ${Block(
          {
            title: '后续章节',
            lead: '手册分为五段，段与段之间没有依赖关系。按当前要完成的任务选择其中一段即可。',
          },
          html`
            ${CardGrid(
              { columns: 3 },
              html`
                ${paths.map(
                  (path) => html`
                    ${Panel(
                      {},
                      html`
                        <h3 class="font-semibold text-[#0a2540] text-base md:text-lg">
                          ${path.title}
                        </h3>
                        <p class="mt-3 text-sm md:text-base text-gray-600">${path.body}</p>
                        <a href="${path.href}" class="${primaryButton} mt-6">${path.cta}</a>
                      `
                    )}
                  `
                )}
              `
            )}
          `
        )}
        ${P(
          {},
          html`如果只需要确认服务是否可用，可以直接访问
            ${code('https://<站点>/.netlify/functions/comment')}。该页面为 Waline
            自带的示例页，提交一条评论后，数据仓库中应出现对应的分片文件。`
        )}
      </div>
    `
  )

export default StartPage
