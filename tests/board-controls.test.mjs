import {moduleUrl,loadTS} from './load-ts.mjs'
const {locale}=await loadTS('../src/locale.ts');locale.value='zh-CN'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {parse,compileScript} from 'vue/compiler-sfc'
import ts from 'typescript'
import {createSSRApp,h} from 'vue'
import {renderToString} from 'vue/server-renderer'

async function component(name){
 const filename=new URL('../src/'+name+'.vue',import.meta.url)
 const {descriptor}=parse(readFileSync(filename,'utf8'))
 const compiled=compileScript(descriptor,{id:name,inlineTemplate:true})
 const js=ts.transpile(compiled.content,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022})
  .replace(/from ["']\.\/i18n["']/g,'from '+JSON.stringify(moduleUrl(new URL('../src/i18n.ts',import.meta.url))))
  .replace(/from ["']vue["']/g,'from '+JSON.stringify(import.meta.resolve('vue')))
 return (await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))).default
}
const Pagination=await component('BoardPagination'),Mode=await component('BoardModeSwitch')
const render=(component,props)=>renderToString(createSSRApp({render:()=>h(component,props)}))
test('pagination boundaries, loading and announcements remain accessible',async()=>{
 const props={page:1,pageCount:10,controls:'results',label:'分页'}
 let html=await render(Pagination,{...props,announce:true})
 assert.match(html,/<button[^>]*disabled[^>]*>上一页/)
 assert.doesNotMatch(html,/<button[^>]*disabled[^>]*>下一页/)
 assert.match(html,/aria-controls="results"/)
 assert.match(html,/role="status" aria-live="polite"/)
 html=await render(Pagination,{...props,page:10,bottom:true})
 assert.match(html,/<button[^>]*disabled[^>]*>下一页/)
 assert.doesNotMatch(html,/aria-live=/)
 html=await render(Pagination,{...props,page:5,disabled:true})
 assert.equal((html.match(/ disabled/g)||[]).length,2)
})
test('mode switch keeps selected state, disabled option and panel associations',async()=>{
 const options=[{value:1,label:'单',disabled:true,id:'one',controls:'panel-one'},{value:2,label:'双',id:'two',controls:'panel-two'}]
 const html=await render(Mode,{modelValue:2,options,label:'模式'})
 assert.match(html,/--active-mode:1/)
 assert.match(html,/id="one"[^>]*disabled[^>]*aria-pressed="false"/)
 assert.match(html,/id="two"[^>]*aria-pressed="true"[^>]*aria-controls="panel-two"/)
 assert.match(html,/ranking-mode-indicator/)
})
