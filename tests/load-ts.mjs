import { readFileSync } from 'node:fs'
import ts from 'typescript'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
const require=createRequire(import.meta.url)
const cache=new Map()
export function moduleUrl(url){
 if(cache.has(url.href))return cache.get(url.href)
 if(url.pathname.endsWith('.json'))return 'data:text/javascript;base64,'+Buffer.from('export default '+JSON.stringify(JSON.parse(readFileSync(url,'utf8')))).toString('base64')
 let js=ts.transpile(readFileSync(url,'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022})
 js=js.replace(/from (["'])(\.[^"']+)\1/g,(_,quote,path)=>'from '+quote+moduleUrl(new URL(path+(path.endsWith('.json')?'':'.ts'),url))+quote)
 js=js.replace(/from (["'])([^.'"][^'"]*)\1/g,(_,quote,path)=>path.startsWith('data:')?'from '+quote+path+quote:'from '+quote+pathToFileURL(require.resolve(path)).href+quote)
 const result='data:text/javascript;base64,'+Buffer.from(js).toString('base64')
 cache.set(url.href,result)
 return result
}
export const loadTS=path=>import(moduleUrl(new URL(path,import.meta.url)))

// 按语法树移除 import 声明（含跨多行的 import），供测试注入替身依赖。
export function stripImports(source,replacements={}){
 const file=ts.createSourceFile('source.ts',source,ts.ScriptTarget.ES2022,true)
 let output='',position=0
 for(const statement of file.statements){
  if(!ts.isImportDeclaration(statement))continue
  output+=source.slice(position,statement.getStart(file))+(replacements[statement.moduleSpecifier.text] ?? '')
  position=statement.end
 }
 return output+source.slice(position)
}

// 读取单文件组件的 <script setup> 内容。
export function scriptSetup(path){
 const source=readFileSync(new URL(path,import.meta.url),'utf8')
 return source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
}
