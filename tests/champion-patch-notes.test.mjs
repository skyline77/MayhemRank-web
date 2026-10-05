import assert from 'node:assert/strict'
import {test} from 'node:test'
import {readFileSync} from 'node:fs'
import {loadTS} from './load-ts.mjs'
const {recentPatches,coveredPatchLabel,loadPatchNotes:loadChampionPatchNotes}=await loadTS('../src/patchNotes.ts')
const recentChampionPatches=(data,id,patch)=>recentPatches(data,'champion',id,patch)
const data=JSON.parse(readFileSync(new URL('../public/champion-patches/recent.json',import.meta.url),'utf8'))

test('older selected patches never show later changes; missing heroes stay empty',()=>{
 assert.deepEqual(recentChampionPatches(data,266,'16.18').map(p=>p.patch),['26.12','26.11'])
 assert.deepEqual(recentChampionPatches(data,9999,'16.19'),[])
 assert.deepEqual(recentChampionPatches(data,266,'invalid'),[])
 assert.equal(recentChampionPatches(data,266,'16.19')[0].patch,'26.19')
 assert.deepEqual(recentChampionPatches(data,11,'16.19').map(p=>p.patch),['26.19','26.18','26.15','26.14'])
 assert.equal(coveredPatchLabel(data,'16.18'),'26.10–26.18')
 assert.equal(coveredPatchLabel(data,'16.9'),'')
})

test('general changes and Mayhem fixes remain separately tagged for the same hero',()=>{
 assert.deepEqual(recentChampionPatches(data,234,'16.19')[0].changes.map(c=>c.scope),['general','general','mayhem'])
})

test('failed downloads can retry, and concurrent detail panels share a successful download',async()=>{
 const original=globalThis.fetch
 let calls=0
 globalThis.fetch=async()=>{calls++;return calls===1?{ok:false}:{ok:true,json:async()=>data}}
 try{
  await assert.rejects(loadChampionPatchNotes(),/暂时无法/)
  const [a,b]=await Promise.all([loadChampionPatchNotes(),loadChampionPatchNotes()])
  assert.equal(calls,2)
  assert.equal(a,b)
 }finally{globalThis.fetch=original}
})
