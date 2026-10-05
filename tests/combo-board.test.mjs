import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
import {stripImports} from './load-ts.mjs'

test('combo requests isolate query and sort, reuse results, reject unbounded payloads and retry failures',async()=>{
 const source=stripImports(readFileSync(new URL('../src/comboBoard.ts',import.meta.url),'utf8'),{
  './locale':"const locale={value:'zh-CN'}",
  './versions':`const selectedPatch={value:'16.19'};const loadVersions=async()=>({generation:'test-generation',patches:[{patch:'16.19'},{patch:'16.18'}]})`})
 const js=ts.transpile(source,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022})
 const {loadComboBoard,cachedComboBoard}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))
 const original=globalThis.fetch,calls=[]
 let oversized=false
 globalThis.fetch=async url=>{
  calls.push(url)
  const params=new URL(url,'http://localhost').searchParams
  const entries=oversized?Array.from({length:101},()=>({})):[]
  return {ok:true,json:async()=>({meta:{queue:2400,patch:params.get('patch'),snapshotId:'test-generation',
   scope:'all-valid-appearances',confidenceLevel:null,resultLimit:100,returnedEntries:entries.length,
   totalEntries:1000,matchedEntries:1000,sort:params.get('sort'),query:params.get('q'),
   runeCount:2,method:'beta50-fixed-hero-baseline-v1',combinationDefinition:'same-hero-same-appearance-unordered-distinct-runes'},entries})}
 }
 try{
  const first=await loadComboBoard('16.19',2)
  assert.equal(await loadComboBoard('16.19',2),first)
  assert.equal(calls.length,1)
  assert.equal(cachedComboBoard('test-generation','16.19',2,'winRate',''),first)
  assert.equal(cachedComboBoard('old-generation','16.19',2,'winRate',''),undefined)
  assert.equal(cachedComboBoard('test-generation','16.19',2,'delta',''),undefined)
  await loadComboBoard('16.19',2,'delta','战争之影 + 秘术冲拳')
  assert.equal(new URL(calls.at(-1),'http://localhost').searchParams.get('q'),'战争之影 + 秘术冲拳')
  await loadComboBoard('16.18',2)
  assert.equal(calls.length,3)
  oversized=true
  await assert.rejects(loadComboBoard('16.19',1,'winRate','retry'))
  oversized=false
  await loadComboBoard('16.19',1,'winRate','retry')
  assert.equal(calls.length,5)
 }finally{globalThis.fetch=original}
})
