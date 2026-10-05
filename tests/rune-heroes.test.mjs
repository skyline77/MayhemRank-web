import assert from 'node:assert/strict'
import {test} from 'node:test'
import {loadTS} from './load-ts.mjs'
const {loadRuneHeroes}=await loadTS('../src/runeHeroes.ts')

test('one cached rune request, exact patch/generation identity, failure retry',async()=>{
 const original=globalThis.fetch;const calls=[]
 const payload={meta:{queue:2400,patch:'16.19',snapshotId:'test-generation',scope:'all-valid-appearances',method:'beta50-fixed-hero-baseline-v1'},runeId:'1095',entries:[{games:20,winRate:.6,delta:.1,baseline:{games:100,winRate:.5}}]}
 try{
  globalThis.fetch=async url=>{calls.push(url);return {ok:true,json:async()=>structuredClone(payload)}}
  const [a,b]=await Promise.all([loadRuneHeroes('1095','16.19','test-generation'),loadRuneHeroes('1095','16.19','test-generation')])
  assert.equal(a,b);assert.equal(calls.length,1)
  assert.equal(calls[0],'/snapshots/test-generation/16.19/rune-heroes/1095.json')
  await assert.rejects(loadRuneHeroes('1095','16.18','test-generation'),/版本不一致/)
  payload.meta.patch='16.18'
  await loadRuneHeroes('1095','16.18','test-generation')
  assert.equal(calls.length,3)
  await assert.rejects(loadRuneHeroes('1095','16.19'),/更新数据/)
 }finally{globalThis.fetch=original}
})

test('rarity denominator contract rejects inconsistent rates and allows a retry',async()=>{
 const original=globalThis.fetch
 const payload={meta:{queue:2400,patch:'16.19',snapshotId:'rarity-test',scope:'all-valid-appearances',method:'hero-cohort-beta-1-1',sameRarityPickRateScope:'deduplicated-same-rarity-selections'},runeId:'7',entries:[{games:50,winRate:.6,delta:.1,baseline:{games:100,winRate:.5},rarity:'kGold',sameRaritySelections:200,sameRarityPickRate:.5}]}
 try{
  globalThis.fetch=async()=>({ok:true,json:async()=>structuredClone(payload)})
  await assert.rejects(loadRuneHeroes('7','16.19','rarity-test'),/同品质/)
  payload.entries[0].sameRarityPickRate=.25
  assert.equal((await loadRuneHeroes('7','16.19','rarity-test')).entries[0].sameRarityPickRate,.25)
 }finally{globalThis.fetch=original}
})
