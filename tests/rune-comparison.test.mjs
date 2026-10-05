import assert from 'node:assert/strict'
import {test} from 'node:test'
import {loadTS} from './load-ts.mjs'
const {locale}=await loadTS('../src/locale.ts');locale.value='zh-CN'
const {previousRunePatch,runePatchChange,runeCardTrend}=await loadTS('../src/runeComparison.ts')
test('previous patch is numeric, earlier and handles missing history',()=>{
 assert.equal(previousRunePatch('16.19',['16.9','16.18','16.20']),'16.18')
 assert.equal(previousRunePatch('17.1',['16.24','16.9']),'16.24')
 assert.equal(previousRunePatch('16.18',['16.18','16.19']),undefined)
})
test('neutral threshold includes both one-point boundaries without negative zero',()=>{
 for(const old of [.49,.50,.51])assert.equal(runePatchChange(.50,old).color,'var(--text)')
 assert.equal(runePatchChange(.50,.50001).label,'±0.0%')
 assert.equal(runePatchChange(.577,.581).label,'-0.4%')
})
test('increases beyond one point get progressively greener and saturate',()=>{
 assert.match(runePatchChange(.511,.50).color,/var\(--win-positive-3\) 2%/)
 assert.match(runePatchChange(.53,.50).color,/var\(--win-positive-3\) 40%/)
 assert.match(runePatchChange(.70,.50).color,/var\(--win-positive-3\) 100%/)
})

test('decreases beyond one point get progressively redder and saturate',()=>{
 assert.match(runePatchChange(.489,.50).color,/var\(--win-negative-3\) 2%/)
 assert.match(runePatchChange(.47,.50).color,/var\(--win-negative-3\) 40%/)
 assert.match(runePatchChange(.30,.50).color,/var\(--win-negative-3\) 100%/)
 assert.equal(runePatchChange(.47,.50).label,'-3.0%')
})

test('card arrows use strict two and four point boundaries in both directions',()=>{
 for(const current of [.48,.50,.52])assert.equal(runeCardTrend(current,.50),null)
 for(const [current,symbol,tone] of [[.5201,'↑','up'],[.54,'↑','up'],[.5401,'↑↑','up-strong'],[.4799,'↓','down'],[.46,'↓','down'],[.4599,'↓↓','down-strong']]){
  assert.equal(runeCardTrend(current,.50).symbol,symbol)
  assert.equal(runeCardTrend(current,.50).tone,tone)
 }
})
test('new runes and missing or invalid history do not get arrows',()=>{
 assert.equal(runeCardTrend(.55),null)
 assert.equal(runeCardTrend(.55,NaN),null)
 assert.equal(runeCardTrend(Infinity,.5),null)
})
