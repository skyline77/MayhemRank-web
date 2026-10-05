import assert from 'node:assert/strict'
import {test} from 'node:test'
import {loadTS} from './load-ts.mjs'
const {boardCardSize,compactHeroSlots}=await loadTS('../src/boardCardSize.ts')
test('hero sizes never rebound when narrowing across layout and slot changes',()=>{
 let previous=54
 for(let width=1500;width>=350;width--){
  const size=boardCardSize('hero',width,width<=1024?32:76,width<=1024)
  assert.ok([54,48,42].includes(size))
  assert.ok(size<=previous,`size rebounded at ${width}`)
  previous=size
 }
 assert.equal(previous,42)
})

test('full desktop board uses actual 54px tier at its 1180px maximum',()=>{assert.equal(boardCardSize('hero',1180,76,false),54)})

test('compact capacity is stable around the mobile padding breakpoint',()=>{
 for(let width=695;width<=717;width++)assert.equal(compactHeroSlots(width),3)
 assert.equal(compactHeroSlots(760),4)
 assert.equal(compactHeroSlots(759),3)
 assert.equal(compactHeroSlots(560),3)
 assert.equal(compactHeroSlots(559),2)
})
