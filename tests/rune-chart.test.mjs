import assert from 'node:assert/strict'
import {test} from 'node:test'
import {loadTS} from './load-ts.mjs'
const {runeChartPoints,runeChartTotal,runeChartOption,runePointDescription,runeRateRange}=await loadTS('../src/runeChart.ts')
const {locale}=await loadTS('../src/locale.ts');locale.value='zh-CN'
const theme={count:'#98bca8',rate:'#f5d780',text:'#9aa0a6',grid:'#333',surface:'#242930',font:'sans-serif'}
const point=(slot,games,winRate,lowSample=false)=>({slot,games,winRate,lowSample,wins:0,interval:[.4,.6]})

test('only first four selections count toward the one-percent threshold',()=>{
 const points=runeChartPoints([point(5,900,.9),point(2,1,.6,true),point(1,98,.5),point(3,1,.4,true)])
 assert.deepEqual(points.map(p=>p.slot),[1,2,3])
 assert.equal(runeChartTotal(points),100)
 const option=runeChartOption(points,.55,theme)
 assert.equal(option.series[1].data[1].value,.6)
 assert.equal(option.series[1].data[1].symbol,'emptyCircle')
 assert.equal(option.series[1].markLine.data[0].yAxis,.55)
})

test('low share and zero records produce gaps without altering count data',()=>{
 const points=[point(1,100,.5),point(2,1,.9,true),point(3,0,null),point(4,100,.51)]
 const option=runeChartOption(points,.55,theme)
 assert.deepEqual(option.series[0].data,[100,1,0,100])
 assert.equal(option.series[1].connectNulls,false)
 assert.deepEqual(option.series[1].data.slice(1,3),[null,null])
 assert.equal(option.series[2].data[1],null)
 assert.match(runePointDescription(points[1],201),/占比不足 1%/)
 assert.doesNotMatch(runePointDescription(points[1],201),/区间|40.0%–60.0%/)
})

test('out-of-range data stay raw with boundary arrows; axes and baseline stay independent',()=>{
 const option=runeChartOption([point(1,100,.8),point(2,100,.2)],.55,theme)
 assert.equal(option.yAxis[1].min,.45)
 assert.equal(option.yAxis[1].max,.65)
 assert.deepEqual(option.series[1].data.map(p=>p.value),[.8,.2])
 assert.deepEqual(option.series[2].data.map(p=>[p.value,p.symbol,p.symbolRotate]),[[.65,'triangle',0],[.45,'triangle',180]])
 assert.equal(option.series[1].markLine.data[0].yAxis,.55)
 const tooltip=option.tooltip.formatter([{dataIndex:0}])
 assert.match(tooltip,/80.0%/)
})

test('empty data and version updates remove old series instead of inventing rates',()=>{
 const empty=runeChartOption([],0,theme)
 assert.ok(empty.yAxis[0].max>0)
 assert.deepEqual(empty.series[1].data,[])
 assert.deepEqual(empty.series[1].markLine.data,[{yAxis:0}])
 const missing=runeChartOption([point(1,0,null)],.5,theme)
 assert.equal(missing.series[1].data[0],null)
})

test('rate range spans twenty points around the nearest five-percent baseline tick',()=>{
 for(const [baseline,min,max] of [[.52,.4,.6],[.5249,.4,.6],[.525,.45,.65],[.53,.45,.65],[.575,.5,.7],[.47,.35,.55]]){
  assert.deepEqual(runeRateRange(baseline),{min,max})
  const option=runeChartOption([point(1,100,baseline)],baseline,theme)
  assert.equal(option.yAxis[1].min,min)
  assert.equal(option.yAxis[1].max,max)
  assert.equal(option.series[1].markLine.data[0].yAxis,baseline)
 }
})

test('new boundaries retain exact endpoints and show arrows only beyond the range',()=>{
 const option=runeChartOption([point(1,100,.4),point(2,100,.6),point(3,100,.399),point(4,100,.601)],.52,theme)
 assert.deepEqual(option.series[1].data.map(p=>p.symbol),['circle','circle','none','none'])
 assert.deepEqual(option.series[2].data.slice(0,2),[null,null])
 assert.deepEqual(option.series[2].data.slice(2).map(p=>[p.value,p.symbolRotate]),[[.4,180],[.6,0]])
})
