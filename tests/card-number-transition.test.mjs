import assert from 'node:assert/strict'
import {test} from 'node:test'
import {loadTS} from './load-ts.mjs'
const {interpolateNumberText}=await loadTS('../src/cardNumberTransition.ts')
test('percentages count in both directions with fixed precision',()=>{
 assert.equal(interpolateNumberText('40.0%','60.0%',.5),'50.0%')
 assert.equal(interpolateNumberText('60.0%','40.0%',.5),'50.0%')
})
test('signed deltas cross zero and formatted counts keep separators',()=>{
 assert.equal(interpolateNumberText('-2.0%','+4.0%',.5),'+1.0%')
 assert.equal(interpolateNumberText('38,963,497','38,973,837',.5),'38,968,667')
})
test('unavailable statistics do not become fabricated numbers',()=>{
 assert.equal(interpolateNumberText('—','50.0%',.5),'—')
 assert.equal(interpolateNumberText('—','50.0%',1),'50.0%')
 assert.equal(interpolateNumberText('2.0千次','1.0万次',.5),'2.0千次')
})
