import assert from 'node:assert/strict'
import {test} from 'node:test'
import {loadTS} from './load-ts.mjs'
const {winRateColor}=await loadTS('../src/winRateColor.ts')
const {winRateBandInk}=await loadTS('../src/winRateTable.ts')
const {runePatchChange,runeCardTrend}=await loadTS('../src/runeComparison.ts')
const strength=color=>Number(color.match(/ ([\d.]+)%\)$/)?.[1] || 0)

test('inclusive one-point neutral interval works for arbitrary baselines',()=>{
 for(const baseline of [.5,.468,.59]){
  for(const offset of [-.01,-.009,0,.009,.01])assert.equal(winRateColor(baseline+offset,baseline),'var(--text)')
  assert.match(winRateColor(baseline+.010001,baseline),/positive/)
  assert.match(winRateColor(baseline-.010001,baseline),/negative/)
 }
 assert.equal(winRateColor(.53),winRateColor(.53,.5))
})
test('one continuous symmetric scale follows distance from baseline and caps at six points',()=>{
 let last=0
 for(const delta of [.011,.02,.03,.04,.05,.06]){
  const positive=winRateColor(.5+delta),negative=winRateColor(.5-delta)
  assert.ok(strength(positive)>last)
  assert.equal(strength(positive),strength(negative))
  assert.equal(positive,winRateColor(.59+delta,.59))
  assert.equal(negative,winRateColor(.468-delta,.468))
  last=strength(positive)
 }
 assert.equal(last,100)
 assert.equal(winRateColor(1),winRateColor(.56))
 assert.equal(winRateColor(0),winRateColor(.44))
})
test('color uses unrounded rates and invalid or absent values stay neutral',()=>{
 assert.equal(winRateColor(.51),'var(--text)')
 assert.notEqual(winRateColor(.5101),'var(--text)')
 for(const value of [null,undefined,NaN,Infinity])assert.equal(winRateColor(value),'var(--text)')
 assert.equal(winRateColor(.55,NaN),'var(--text)')
})
test('range labels and version comparisons delegate to the same scale',()=>{
 assert.equal(winRateBandInk(52,54),winRateColor(.53))
 assert.equal(winRateBandInk(48,50),'var(--text)')
 assert.equal(winRateBandInk(50,52),'var(--text)')
 for(const [value,baseline] of [[.55,.5],[.48,.54],[.51,.5],[.5301,.5]]){
  assert.equal(runePatchChange(value,baseline).color,winRateColor(value,baseline))
  const arrow=runeCardTrend(value,baseline)
  if(arrow)assert.equal(arrow.color,winRateColor(value,baseline))
 }
})
