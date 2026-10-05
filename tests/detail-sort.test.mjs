import assert from 'node:assert/strict'
import {test} from 'node:test'
import {loadTS} from './load-ts.mjs'
const {sortDetailCells}=await loadTS('../src/detailSort.ts')
const {visibleSpellPairs}=await loadTS('../src/spellBuilds.ts')
const cell=(id,pickRate,winRate,games=100)=>({id,pickRate,winRate,games})

test('sorts unrounded rates descending without mutating cached input; ties are stable',()=>{
 const cells=[cell('popular',.8,.54),cell('winner',.1,.59004),cell('near',.2,.59001),cell('tie-b',.2,.54),cell('tie-a',.2,.54)]
 const original=cells.map(c=>c.id)
 assert.deepEqual(sortDetailCells(cells,'winRate').map(c=>c.id),['winner','near','popular','tie-a','tie-b'])
 assert.deepEqual(sortDetailCells(cells,'winRateAsc').map(c=>c.id),['popular','tie-a','tie-b','near','winner'])
 assert.deepEqual(sortDetailCells(cells,'pickRate').map(c=>c.id),['popular','near','tie-a','tie-b','winner'])
 assert.deepEqual(cells.map(c=>c.id),original)
 assert.deepEqual(sortDetailCells([],'winRate'),[])
})

test('spell sorting cannot add excluded pairs or change the minimum-three membership',()=>{
 const pairs=[cell('a',.9,.5),cell('b',.09,.6),cell('c',.004,.7),cell('excluded',.003,1)]
 const shown=visibleSpellPairs(pairs)
 assert.deepEqual(sortDetailCells(shown,'winRate').map(c=>c.id),['c','b','a'])
 assert.deepEqual(sortDetailCells(shown,'winRateAsc').map(c=>c.id),['a','b','c'])
 assert.deepEqual(sortDetailCells(shown,'pickRate').map(c=>c.id),['a','b','c'])
 assert.equal(sortDetailCells(shown,'winRate').some(c=>c.id==='excluded'),false)
})


test('hero delta sorting uses full precision and keeps small samples last in both directions',()=>{
 const cells=[{...cell('low',.1,.99,19),delta:.49},{...cell('a',.5,.60,20),delta:.10004},{...cell('b',.5,.70,80),delta:.10001}]
 assert.deepEqual(sortDetailCells(cells,'winRate',true).map(c=>c.id),['b','a','low'])
 assert.deepEqual(sortDetailCells(cells,'winRateAsc',true).map(c=>c.id),['a','b','low'])
 assert.deepEqual(sortDetailCells(cells,'delta',true).map(c=>c.id),['a','b','low'])
 assert.deepEqual(sortDetailCells(cells,'deltaAsc',true).map(c=>c.id),['b','a','low'])
 assert.deepEqual(sortDetailCells(cells,'winRate').map(c=>c.id),['low','b','a'])
})


test('hero pick rate and game count sort descending even for small samples',()=>{
 const cells=[cell('many',.2,.5,1200),cell('few',.9,.5,5),cell('near',.90001,.5,19),cell('tie',.2,.5,1200)]
 assert.deepEqual(sortDetailCells(cells,'pickRate',true).map(c=>c.id),['near','few','many','tie'])
 assert.deepEqual(sortDetailCells(cells,'games',true).map(c=>c.id),['many','tie','near','few'])
 assert.deepEqual(cells.map(c=>c.id),['many','few','near','tie'])
})


test('rune hero ranking treats both 49 and 50 as low sample',()=>{
 const cells=[{...cell('below',.9,.9,49),delta:.4},{...cell('boundary',.2,.6,50),delta:.1},{...cell('large',.3,.7,80),delta:.2}]
 assert.deepEqual(sortDetailCells(cells,'winRate',51).map(c=>c.id),['large','below','boundary'])
 assert.deepEqual(sortDetailCells(cells,'delta',51).map(c=>c.id),['large','below','boundary'])
 assert.deepEqual(sortDetailCells(cells,'deltaAsc',51).map(c=>c.id),['large','boundary','below'])
 assert.deepEqual(sortDetailCells(cells,'pickRate',51).map(c=>c.id),['below','large','boundary'])
 assert.deepEqual(sortDetailCells(cells,'games',51).map(c=>c.id),['large','boundary','below'])
})


test('hero detail runes with at most 50 games stay last for either win-rate direction',()=>{
 const cells=[cell('under',.8,.9,49),cell('exactly50',.7,.8,50),cell('exactly51',.2,.6,51),cell('large',.3,.5,100)]
 assert.deepEqual(sortDetailCells(cells,'winRate',51).map(c=>c.id),['exactly51','large','under','exactly50'])
 assert.deepEqual(sortDetailCells(cells,'winRateAsc',51).map(c=>c.id),['large','exactly51','exactly50','under'])
 assert.deepEqual(sortDetailCells(cells,'pickRate',51).map(c=>c.id),['under','exactly50','large','exactly51'])
 assert.deepEqual(sortDetailCells(cells,'winRate',false).map(c=>c.id),['under','exactly50','exactly51','large'])
})

test('runes below fifty retain order only for win-rate and delta sorting',()=>{
 const rows=[cell('low-a',.8,.1,49),cell('fifty',.1,.6,50),cell('low-b',.9,.99,10),cell('winner',.2,.8,80)]
 for(const sort of ['winRate'])assert.deepEqual(sortDetailCells(rows,sort,50,true).map(c=>c.id),['winner','fifty','low-a','low-b'])
 assert.deepEqual(sortDetailCells(rows,'winRateAsc',50,true).map(c=>c.id),['fifty','winner','low-a','low-b'])
 assert.deepEqual(sortDetailCells(rows,'pickRate',50,true).map(c=>c.id),['low-b','low-a','winner','fifty'])
 const deltas=rows.map(c=>({...c,delta:c.winRate-.5}))
 assert.deepEqual(sortDetailCells(deltas,'delta',50,true).map(c=>c.id),['winner','fifty','low-a','low-b'])
 assert.deepEqual(sortDetailCells(deltas,'deltaAsc',50,true).map(c=>c.id),['fifty','winner','low-a','low-b'])
})
