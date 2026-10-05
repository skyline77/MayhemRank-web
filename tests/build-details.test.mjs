import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import ts from 'typescript'
const source=readFileSync(new URL('../src/buildDetails.ts',import.meta.url),'utf8')
const js=ts.transpile(source,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022})
const {loadBuildDetail,winRateDelta}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))
test('detail shards are cached per champion and preserve separate role payloads',async()=>{
 const original=globalThis.fetch
 let calls=0
 const payload={meta:{patch:'16.18',queue:2400},roles:{'坦克':{games:500},'面具AP':{games:300}}}
 globalThis.fetch=async url=>{calls++;assert.equal(url,'/build-details/57.json?v=item-1pct-v5');return {ok:true,json:async()=>payload}}
 try{
  const [a,b]=await Promise.all([loadBuildDetail(57,'16.18'),loadBuildDetail(57,'16.18')])
  assert.equal(calls,1);assert.equal(a,b)
  assert.equal(a.roles['坦克'].games,500);assert.equal(a.roles['面具AP'].games,300)
 }finally{globalThis.fetch=original}
})
test('failed or wrong-scope details are not cached and can be retried',async()=>{
 const original=globalThis.fetch
 let calls=0
 globalThis.fetch=async()=>({ok:true,json:async()=>({meta:{patch:++calls===1?'16.19':'16.18',queue:2400},roles:{}})})
 try{
  await assert.rejects(loadBuildDetail(62,'16.18'),/版本/)
  assert.equal((await loadBuildDetail(62,'16.18')).meta.patch,'16.18')
  assert.equal(calls,2)
 }finally{globalThis.fetch=original}
})

test('detail delta uses the selected build baseline and formats signed percentage points',()=>{
 assert.equal(winRateDelta(.567,.514),'+5.3%')
 assert.equal(winRateDelta(.514,.567),'-5.3%')
 assert.equal(winRateDelta(.514,.514),'0.0%')
 assert.equal(winRateDelta(.5139999,.514),'0.0%')
 assert.equal(winRateDelta(.567,.55),'+1.7%')
})

// One page stays pinned to one immutable generation even while a new one publishes.
test('detail cache isolates both patches and snapshot generations',async()=>{
 const original=globalThis.fetch,urls=[]
 globalThis.fetch=async url=>{
  urls.push(url)
  return {ok:true,json:async()=>({meta:{patch:url.split('/')[3],snapshotId:url.split('/')[2],queue:2400},roles:{}})}
 }
 try{
  await loadBuildDetail(10,'16.18','generation-a')
  await loadBuildDetail(10,'16.19','generation-a')
  await loadBuildDetail(10,'16.19','generation-b')
  await loadBuildDetail(10,'16.19','generation-a')
  assert.equal(urls.length,3)
  assert.ok(urls[0].startsWith('/snapshots/generation-a/16.18/'))
  assert.ok(urls[1].startsWith('/snapshots/generation-a/16.19/'))
  assert.ok(urls[2].startsWith('/snapshots/generation-b/16.19/'))
 }finally{globalThis.fetch=original}
})
