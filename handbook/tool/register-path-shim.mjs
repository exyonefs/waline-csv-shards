import { register } from 'node:module'

register('./path-shim-loader.mjs', import.meta.url)
