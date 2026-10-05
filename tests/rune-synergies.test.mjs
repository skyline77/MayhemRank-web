import assert from 'node:assert/strict'
import {test} from 'node:test'
import {loadTS} from './load-ts.mjs'
const {loadRuneSynergies}=await loadTS('../src/runeSynergies.ts')
const {sortDetailCells}=await loadTS('../src/detailSort.ts')
function fixture(generation='synergy-test'){
 const cell={id:'8',name:'搭配',icon:'/icon.png',rarity:'kGold',games:50,wins:30,rawWinRate:.6,winRate:.55,baselineWinRate:.5,delta:.05,interval:[.4,.7],lowSample:false,heroCount:2,pickRate:.5}
 return {meta:{queue:2400,patch:'16.19',snapshotId:generation,method:'beta50-fixed-hero-baseline-v1',synergyMethod:'hero-standardized-rune-cooccurrence-v1',scope:'all-valid-appearances',itemScope:'inventory-complete-appearances',weighting:'combination-hero-appearances',baselineIncludesCombination:true,confidenceLevel:.9,intervalMethod:'moment-matched-weighted-beta-90'},runeId:'7',augments:{games:100,entries:[cell]},items:{games:80,entries:[]}}
}
test('both modules share one request, exact scope, failed requests retry',async()=>{
 const original=globalThis.fetch,calls=[];const data=fixture()
 try{
  globalThis.fetch=async path=>{calls.push(path);return {ok:true,json:async()=>structuredClone(data)}}
  const [a,b]=await Promise.all([loadRuneSynergies('7','16.19','synergy-test'),loadRuneSynergies('7','16.19','synergy-test')])
  assert.equal(a,b);assert.equal(calls.length,1)
  assert.equal(calls[0],'/snapshots/synergy-test/16.19/rune-synergies/7.json')
  await assert.rejects(loadRuneSynergies('7','16.18','synergy-test'),/版本不一致/)
  data.meta.patch='16.18'
  await loadRuneSynergies('7','16.18','synergy-test')
  assert.equal(calls.length,3)
  await assert.rejects(loadRuneSynergies('7','16.19'),/更新数据/)
 }finally{globalThis.fetch=original}
})
test('reject malformed counts, deltas, self-pairs and wrong item cohort',async()=>{
 const original=globalThis.fetch
 try{
  for(const [index,mutate] of [
   d=>d.augments.entries[0].delta=.1,
   d=>d.augments.entries[0].games=101,
   d=>d.augments.entries[0].id='7',
   d=>d.meta.itemScope='all-valid-appearances',
   d=>d.augments.entries[0].interval=[.7,.4],
   d=>d.augments.entries.push({...d.augments.entries[0]}),
  ].entries()){
   const generation='bad-'+index,data=fixture(generation);mutate(data)
   globalThis.fetch=async()=>({ok:true,json:async()=>data})
   await assert.rejects(loadRuneSynergies('7','16.19',generation),/不完整|不一致/)
  }
 }finally{globalThis.fetch=original}
})
test('point-only snapshots load without inventing interval values',async()=>{
 const original=globalThis.fetch,data=fixture('point-only')
 data.meta.confidenceLevel=null;data.meta.intervalMethod='not-computed'
 data.augments.entries[0].interval=[]
 try{
  globalThis.fetch=async()=>({ok:true,json:async()=>data})
  const result=await loadRuneSynergies('7','16.19','point-only')
  assert.deepEqual(result.augments.entries[0].interval,[])
 }finally{globalThis.fetch=original}
})

test('shared sorting puts under 50 samples last in both win-rate and delta directions',()=>{
 const cells=[{id:'1',games:49,winRate:.9,delta:.4,pickRate:.1},{id:'2',games:50,winRate:.4,delta:-.1,pickRate:.2},{id:'3',games:100,winRate:.6,delta:.1,pickRate:.3}]
 assert.deepEqual(sortDetailCells(cells,'winRate',50).map(c=>c.id),['3','2','1'])
 assert.deepEqual(sortDetailCells(cells,'winRateAsc',50).map(c=>c.id),['2','3','1'])
 assert.deepEqual(sortDetailCells(cells,'delta',50).map(c=>c.id),['3','2','1'])
 assert.deepEqual(sortDetailCells(cells,'deltaAsc',50).map(c=>c.id),['2','3','1'])
})
