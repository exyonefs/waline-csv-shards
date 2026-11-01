import { Wunphile } from 'wunphile'

import IndexPage from './src/page/IndexPage.mjs'
import StartPage from './src/page/StartPage.mjs'
import DeployPage from './src/page/DeployPage.mjs'
import EnvPage from './src/page/EnvPage.mjs'
import DataPage from './src/page/DataPage.mjs'
import OpsPage from './src/page/OpsPage.mjs'
import DesignPage from './src/page/DesignPage.mjs'
import SourcePage from './src/page/SourcePage.mjs'
import LimitsPage from './src/page/LimitsPage.mjs'
import NotFoundPage from './src/page/NotFoundPage.mjs'

// 站点根路径 = 本文件所在目录；输出目录默认 <root>/dist，
// 可用 SSG_OUTPUT_PATH 环境变量覆盖（Netlify 里不用改，保持 dist 即可）。
const ssg = new Wunphile(import.meta.url)

// assets/ 下的文件整体挂到 /static 下：assets/style.css -> /static/style.css
ssg.staticDir('/static', './assets')

ssg.page('/index.html', IndexPage)
ssg.page('/start/index.html', StartPage)
ssg.page('/deploy/index.html', DeployPage)
ssg.page('/env/index.html', EnvPage)
ssg.page('/data/index.html', DataPage)
ssg.page('/ops/index.html', OpsPage)
ssg.page('/design/index.html', DesignPage)
ssg.page('/source/index.html', SourcePage)
ssg.page('/limits/index.html', LimitsPage)

ssg.notFoundPage(NotFoundPage)

// 无参数 -> 构建；--dev / -d -> 本地开发服务器（热重载）
await ssg.cli()
