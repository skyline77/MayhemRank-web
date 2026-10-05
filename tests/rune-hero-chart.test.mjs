import assert from 'node:assert/strict'
import {test} from 'node:test'
import {loadTS} from './load-ts.mjs'
const {locale}=await loadTS('../src/locale.ts');locale.value='zh-CN'
const {chartHeroes,heroChartBounds,overlappingHeroes,heroArrowDescription}=await loadTS('../src/runeHeroChart.ts')
const hero=(id,games,winRate=.6,baseline=.5)=>({id,name:'英雄'+id,icon:'/role-portraits/'+id+'.png',games,winRate,baseline:{games:500,winRate:baseline},sameRaritySelections:1000,sameRarityPickRate:games/1000,delta:winRate-baseline,interval:[.45,.65]})
test('default fifty-game floor leaves the full rarity denominator unchanged',()=>{
 const rows=[hero('1',49),hero('2',50),hero('3',100)]
 assert.deepEqual(chartHeroes(rows).map(e=>e.id),['2','3'])
 assert.deepEqual(chartHeroes(rows,100).map(e=>e.id),['3'])
 assert.equal(chartHeroes(rows)[0].sameRarityPickRate,.05)
 assert.equal(rows[0].games,49)
})
test('missing or contradictory rarity denominators never fall back to appearance pick rate',()=>{
 assert.equal(chartHeroes([{...hero('1',100),sameRaritySelections:undefined,pickRate:.2}]).length,0)
 assert.equal(chartHeroes([{...hero('1',100),sameRarityPickRate:.5}]).length,0)
})
test('axes include both endpoints, padded to round ticks; description retains exact counts',()=>{
 const entries=[hero('1',50,.35,.7),hero('2',700,.62,.55)]
 const bounds=heroChartBounds(entries)
 assert.ok(bounds.yMin<.35 && bounds.yMax>.7 && bounds.xMax>.7)
 assert.match(heroArrowDescription(entries[0]),/50 \/ 1,000/)
 assert.match(heroArrowDescription(entries[0]),/70.0% → 选用后 35.0%/)
})
test('overlap candidates use pixel distances and do not move the input coordinates',()=>{
 const pixels=[[10,20],[30,30],[80,20],[10,80]]
 assert.deepEqual(overlappingHeroes(pixels,0),[0,1])
 assert.deepEqual(overlappingHeroes(pixels,-1),[])
 assert.deepEqual(pixels[0],[10,20])
})
