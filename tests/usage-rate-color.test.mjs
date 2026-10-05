import assert from 'node:assert/strict'
import {test} from 'node:test'
import {loadTS} from './load-ts.mjs'
const {usageRateColor}=await loadTS('../src/usageRateColor.ts')
test('zero through half a percent, missing and invalid usage retain muted text',()=>{
 for(const value of [0,.001,.00499,.005,-.1,null,undefined,NaN,Infinity])assert.equal(usageRateColor(value),'var(--muted)')
})
test('usage interpolates continuously to full yellow at five percent and then caps',()=>{
 for(const [value,strength] of [[.005001,.002222],[.0095,10],[.014,20],[.0275,50],[.0455,90],[.05,100],[.5,100]])assert.equal(usageRateColor(value),`color-mix(in oklab, var(--muted), var(--usage-yellow) ${strength}%)`)
})
