import assert from 'node:assert/strict'
import {test} from 'node:test'
import {readFileSync} from 'node:fs'
import {loadTS} from './load-ts.mjs'
const {locale,locales,resolveLocale,upstreamLocales}=await loadTS('../src/locale.ts')
const {t,message}=await loadTS('../src/i18n.ts')
const {loadGameLocale,gameName,gameAliases,gameTitle}=await loadTS('../src/gameLocalization.ts')
const {heroSuggestions}=await loadTS('../src/heroSuggestions.ts')
const {matchesDetailSearch}=await loadTS('../src/detailSearch.ts')
const {buildRows,columns}=await loadTS('../src/buildBoard.ts')

test('手动选择优先，浏览器语言显式匹配地区，上游代码分开映射',()=>{
 assert.equal(resolveLocale('ja-JP',['zh-CN']),'ja-JP')
 for(const [language,expected] of [['zh-Hant-HK','zh-TW'],['zh-TW','zh-TW'],['zh-SG','zh-CN'],['ja','ja-JP'],['en-GB','en-US']])assert.equal(resolveLocale(null,[language]),expected)
 assert.equal(resolveLocale('invalid',['fr','ja-JP']),'ja-JP')
 assert.equal(resolveLocale(null,['de-DE']),'en-US')
 assert.deepEqual(upstreamLocales['zh-TW'],{ddragon:'zh_TW',cdragon:'zh_tw'})
 assert.equal(upstreamLocales['en-US'].cdragon,'default')
})

test('文案参数、缺失标记及重复传入已译标签',()=>{
 locale.value='en-US'
 assert.equal(t('英雄榜'),'Champions')
 assert.equal(message('胜率 {p0}',{p0:'58.0%'}),'WR 58.0%')
 locale.value='ja-JP'
 assert.equal(t(t('英雄榜')),'チャンピオン')
 assert.match(t('测试未翻译文案'),/^⟦ja-JP:/)
})

test('四语言游戏名称按版本与 ID 搜索，语言切换不修改统计键和计数',async()=>{
 const original=globalThis.fetch;let calls=0
 try{
  globalThis.fetch=async url=>{calls++;const patch=String(url).match(/(\d+\.\d+)\.json/)[1];return {ok:true,json:async()=>JSON.parse(readFileSync(new URL('../public/localization/'+patch+'.json',import.meta.url),'utf8'))}}
  await loadGameLocale('16.19');await loadGameLocale('16.19');assert.equal(calls,1)
  const hero={id:'157',championId:157,name:'亚索',role:'近战暴击',label:'无尽之刃',column:'AD输出',games:123,wins:66,winRate:.5376,pickRate:1,lowSample:false}
  const before=JSON.stringify(hero)
  for(const code of locales){
   locale.value=code
   assert.ok(gameName('champions',157,'16.19'))
   for(const name of gameAliases('champions',157,'16.19'))assert.equal(heroSuggestions([hero],name)[0]?.championId,157,name)
   for(const [kind,id] of [['items','3031'],['augments','1041']]){
    const names=gameAliases(kind,id,'16.19');assert.ok(names.length>=3)
    for(const name of names)assert.ok(matchesDetailSearch(kind==='items'?'items':'kPrismatic',{id,name:'原名称'},name,{patch:'16.19',queue:2400,items:{},augments:{}}),name)
   }
   assert.ok(gameName('items','-1','16.19'))
   assert.equal(buildRows([hero])[0].cells[columns.indexOf('AD输出')][0],hero)
  }
  assert.equal(JSON.stringify(hero),before)
  assert.equal(calls,1,'切语言不重新请求目录或统计')
  const blitz={...hero,id:'53',championId:53,name:'布里茨'}
  for(const code of locales){
   locale.value=code
   assert.equal(gameTitle(53,'16.19'),({'zh-CN':'蒸汽机器人','zh-TW':'布里茨','en-US':'Blitzcrank','ja-JP':'ブリッツクランク'})[code])
   for(const name of ['布里茨','Blitzcrank','ブリッツクランク'])assert.equal(heroSuggestions([blitz],name)[0]?.championId,53)
   for(const title of ['蒸汽机器人','The Great Steam Golem','蒸汽魔像','ztjqr']){
    if(code==='zh-CN' && title==='蒸汽机器人')assert.equal(heroSuggestions([blitz],title)[0]?.championId,53)
    if(code!=='zh-CN')assert.equal(heroSuggestions([blitz],title).length,0,title)
   }
  }
 }finally{globalThis.fetch=original;locale.value='zh-CN'}
})

test('资源故障可重试，错误版本不可写入缓存',async()=>{
 const original=globalThis.fetch;let calls=0
 try{
  globalThis.fetch=async()=>{calls++;return {ok:true,json:async()=>({schema:1,patch:'wrong',locales:{}})}}
  await assert.rejects(loadGameLocale('99.1'),/版本/)
  await assert.rejects(loadGameLocale('99.1'),/版本/)
  assert.equal(calls,2)
 }finally{globalThis.fetch=original}
})

test('静态与动态迁移文案四语言覆盖、参数一致',()=>{
 const dictionary=JSON.parse(readFileSync(new URL('../src/messages.json',import.meta.url),'utf8'))
 const parameters=s=>[...s.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort()
 for(const [key,values] of Object.entries(dictionary)){
  assert.equal(values.length,3,key)
  for(const value of values){assert.ok(value.trim(),key);assert.deepEqual(parameters(value),parameters(key),key)}
 }
})
import {readdirSync} from 'node:fs'
import ts from 'typescript'
import {parse,compileScript} from 'vue/compiler-sfc'
import {createSSRApp,h} from 'vue'
import {renderToString} from 'vue/server-renderer'
import {moduleUrl} from './load-ts.mjs'

test('数据异常文案和全部属性图标提示覆盖三种目标语言',async()=>{
 const errors=new Set()
 for(const file of readdirSync(new URL('../src/',import.meta.url))){
  if(!/\.(ts|vue)$/.test(file))continue
  const source=readFileSync(new URL('../src/'+file,import.meta.url),'utf8')
  const script=file.endsWith('.vue')?parse(source).descriptor.scriptSetup?.content || '':source
  const ast=ts.createSourceFile(file,script,ts.ScriptTarget.Latest,true)
  function visit(node){
   if(ts.isNewExpression(node) && node.expression.getText(ast)==='Error'){
    function literals(child){if(ts.isStringLiteral(child)&&/[\u3400-\u9fff]/.test(child.text))errors.add(child.text);ts.forEachChild(child,literals)}
    for(const arg of node.arguments || [])literals(arg)
   }
   ts.forEachChild(node,visit)
  }
  visit(ast)
 }
 // 动态拼接的 Wiki 读取异常单独覆盖。
 for(const prefix of ['英文说明','Wiki 中文译文'])for(const suffix of ['暂时无法读取','格式不匹配'])errors.add(prefix+suffix)
 const {statDefinitions}=await loadTS('../src/statTokens.ts')
 for(const code of ['zh-TW','ja-JP','en-US']){
  locale.value=code
  for(const value of errors)if(!['暂时无法读取','格式不匹配'].includes(value))assert.ok(!t(value).includes('⟦'),code+': '+value)
  for(const value of Object.values(statDefinitions))assert.ok(!t(value.label).includes('⟦'),code+': '+value.label)
 }
 const {descriptor}=parse(readFileSync(new URL('../src/StatInline.vue',import.meta.url),'utf8'))
 let js=ts.transpile(compileScript(descriptor,{id:'stat-inline',inlineTemplate:true}).content,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022})
 js=js.replace(/from ['"]vue['"]/g,'from '+JSON.stringify(import.meta.resolve('vue'))).replace(/from ['"](\.\/[^'"]+)['"]/g,(_,path)=>'from '+JSON.stringify(moduleUrl(new URL('../src/'+path.slice(2)+'.ts',import.meta.url))))
 const component=(await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))).default
 locale.value='ja-JP'
 const html=await renderToString(createSSRApp({render:()=>h(component,{stat:'ad',text:'Attack damage'})}))
 assert.match(html,/title="攻撃力"/)
 assert.match(html,/>Attack damage<\/span>/,'社区原文不会被属性提示翻译替换')
 locale.value='zh-CN'
})
