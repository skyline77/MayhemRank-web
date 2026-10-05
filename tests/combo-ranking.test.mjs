import {test} from 'node:test'
import assert from 'node:assert/strict'
import {loadTS} from './load-ts.mjs'
const {rankCombos,orderComboRunes}=await loadTS('../src/comboRanking.ts')
const rows=[
 {championId:'51',championName:'皮城女警',runeId:'1',runeName:'亮剑',games:300,winRate:.681,delta:.151},
 {championId:'120',championName:'战争之影',runeId:'2',runeName:'终极唤醒',games:1000,winRate:.671,delta:.089},
 {championId:'4',championName:'崔斯特',runeId:'3',runeName:'双重施法',games:99,winRate:.9,delta:.3}
]

test('double rune display puts higher rarity first and keeps each name/icon with its link identity',()=>{
 const pair={...rows[1],runeId:'1029',runeName:'虚幻武器',runeIcon:'gold.png',secondRuneId:'1058',secondRuneName:'秘术冲拳',secondRuneIcon:'prismatic.png'}
 const displayed=orderComboRunes(pair,{'1029':'kGold','1058':'kPrismatic'})
 assert.deepEqual(displayed,{...pair,runeId:'1058',runeName:'秘术冲拳',runeIcon:'prismatic.png',secondRuneId:'1029',secondRuneName:'虚幻武器',secondRuneIcon:'gold.png'})
 assert.equal(pair.runeId,'1029')
 for(const [first,second] of [['kSilver','kGold'],['kSilver','kPrismatic']]){
  assert.equal(orderComboRunes(pair,{'1029':first,'1058':second}).runeId,'1058')
 }
 for(const [first,second] of [['kGold','kGold'],['kPrismatic','kSilver'],['kGold','unknown']]){
  assert.equal(orderComboRunes(pair,{'1029':first,'1058':second}),pair)
 }
 assert.equal(orderComboRunes(pair,{}),pair)
 assert.equal(orderComboRunes(rows[0],{'1':'kGold'}),rows[0])
})
test('ranking applies floor before ordering and does not mutate source',()=>{
 assert.deepEqual(rankCombos(rows,'',100,'winRate').map(r=>r.championId),['51','120'])
 assert.deepEqual(rankCombos(rows,'',1000,'delta').map(r=>r.championId),['120'])
 assert.equal(rows.length,3)
})
test('combined search accepts hero plus rune and whitespace',()=>{
 for(const query of ['皮城女警＋亮剑','皮城女警 + 亮剑','女警 亮剑']){
  assert.deepEqual(rankCombos(rows,query,100,'delta').map(r=>r.championId),['51'])
 }
 assert.equal(rankCombos(rows,'不存在',100,'delta').length,0)
})
test('delta sort uses full precision instead of rounded labels',()=>{
 const changed=[{...rows[0],delta:.1},{...rows[1],delta:.10001}]
 assert.equal(rankCombos(changed,'',100,'delta')[0].championId,'120')
})
test('canonical hero names remain searchable by their Chinese titles',()=>{
 const named=[{...rows[0],championName:'凯特琳'}]
 assert.equal(rankCombos(named,'皮城女警',100,'winRate').length,1)
})
test('double-rune search matches either rune, hero title and unordered search terms',()=>{
 const pairs=[{...rows[1],championName:'赫卡里姆',runeId:'1029',runeName:'虚幻武器',secondRuneId:'1058',secondRuneName:'秘术冲拳'}]
 for(const query of ['战争之影＋秘术冲拳＋虚幻武器','虚幻武器 秘术冲拳','秘术冲拳']){
  assert.equal(rankCombos(pairs,query,100,'winRate').length,1)
 }
 assert.equal(rankCombos(pairs,'亮剑',100,'winRate').length,0)
})
test('double-rune ties have a stable second-rune identity',()=>{
 const pairs=[{...rows[0],secondRuneId:'2'},{...rows[0],secondRuneId:'1'}]
 assert.deepEqual(rankCombos(pairs,'',100,'delta').map(r=>r.secondRuneId),['1','2'])
})
