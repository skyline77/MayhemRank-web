import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
const require = createRequire(import.meta.url)
const cache = new Map()
export function moduleUrl(url) {
  if (cache.has(url.href)) return cache.get(url.href)
  if (url.pathname.endsWith('.json'))
    return (
      'data:text/javascript;base64,' +
      Buffer.from(
        'export default ' + JSON.stringify(JSON.parse(readFileSync(url, 'utf8'))),
      ).toString('base64')
    )
  const js = ts.transpile(readFileSync(url, 'utf8'), {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
  })
  const result =
    'data:text/javascript;base64,' + Buffer.from(rewriteImports(js, url)).toString('base64')
  cache.set(url.href, result)
  return result
}

const srcRoot = new URL('../src/', import.meta.url)
// 把源码中的 import 路径换成可直接加载的地址：本地模块（./、../、@/）转为 data URL，
// 第三方包转为 node_modules 中的文件地址。
function rewriteImports(js, fromUrl) {
  return js.replace(/from (["'])([^"']+)\1/g, (_, quote, spec) => {
    if (spec.startsWith('data:')) return 'from ' + quote + spec + quote
    const local = spec.startsWith('.') || spec.startsWith('@/')
    if (!local) return 'from ' + quote + pathToFileURL(require.resolve(spec)).href + quote
    const path = /\.(json|ts)$/.test(spec) ? spec : spec + '.ts'
    const url = spec.startsWith('@/') ? new URL(path.slice(2), srcRoot) : new URL(path, fromUrl)
    return 'from ' + quote + moduleUrl(url) + quote
  })
}
export const loadTS = path => import(moduleUrl(new URL(path, import.meta.url)))

// 编译单文件组件（内联模板），返回组件定义，供服务端渲染测试使用。
export async function loadSFC(path) {
  const { parse, compileScript } = await import('vue/compiler-sfc')
  const url = new URL(path, import.meta.url)
  const { descriptor } = parse(readFileSync(url, 'utf8'))
  const compiled = compileScript(descriptor, { id: path, inlineTemplate: true })
  const js = ts.transpile(compiled.content, {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
  })
  const code = rewriteImports(js, url)
  return (await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64')))
    .default
}

// 按语法树移除 import 声明（含跨多行的 import），供测试注入替身依赖。
export function stripImports(source, replacements = {}) {
  const file = ts.createSourceFile('source.ts', source, ts.ScriptTarget.ES2022, true)
  let output = '',
    position = 0
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    output +=
      source.slice(position, statement.getStart(file)) +
      (replacements[statement.moduleSpecifier.text] ?? '')
    position = statement.end
  }
  return output + source.slice(position)
}

// 读取单文件组件的 <script setup> 内容。
export function scriptSetup(path) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8')
  return source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
}
