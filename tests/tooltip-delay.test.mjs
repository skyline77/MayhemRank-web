import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import ts from 'typescript'
import {shallowRef} from 'vue'
const source=readFileSync(new URL('../src/tooltip.ts',import.meta.url),'utf8')
const script=ts.transpile(source.replace(/^import .*$/gm,'').replace(/export /g,''),{target:ts.ScriptTarget.ES2022})
function harness(t){
 t.mock.timers.enable({apis:['setTimeout']})
 return new Function('shallowRef',script+';return {activeTip,showTip,hideTip,closeTip,keepTip,toggleTip}')(shallowRef)
}
const anchor=()=>({isConnected:true})
const enter=currentTarget=>({type:'mouseenter',currentTarget})

test('rune and equipment hover waits the full 500 ms',t=>{
 const tip=harness(t)
 for(const kind of ['augments','items']){
  const card=anchor();tip.showTip(enter(card),{kind})
  t.mock.timers.tick(499);assert.equal(tip.activeTip.value,null)
  t.mock.timers.tick(1);assert.equal(tip.activeTip.value.anchor,card)
  tip.closeTip()
 }
})
test('leaving early cancels the popup and a new card gets a fresh delay',t=>{
 const tip=harness(t),a=anchor(),b=anchor()
 tip.showTip(enter(a),{id:'a'});t.mock.timers.tick(400);tip.hideTip()
 t.mock.timers.tick(1100);assert.equal(tip.activeTip.value,null)
 tip.showTip(enter(a),{id:'a'});t.mock.timers.tick(400)
 tip.showTip(enter(b),{id:'b'});t.mock.timers.tick(499);assert.equal(tip.activeTip.value,null)
 t.mock.timers.tick(1);assert.equal(tip.activeTip.value.data.id,'b')
})
test('close and removed cards cannot open a delayed tooltip',t=>{
 const tip=harness(t),card=anchor()
 tip.showTip(enter(card),{});tip.closeTip();t.mock.timers.tick(1000);assert.equal(tip.activeTip.value,null)
 tip.showTip(enter(card),{});card.isConnected=false;t.mock.timers.tick(1000);assert.equal(tip.activeTip.value,null)
})
test('moving into the popup keeps its detail link accessible; focus and touch stay immediate',t=>{
 const tip=harness(t),card=anchor()
 tip.showTip({type:'focusin',currentTarget:card},{});assert.ok(tip.activeTip.value)
 tip.hideTip();t.mock.timers.tick(100);tip.keepTip();t.mock.timers.tick(1000);assert.ok(tip.activeTip.value)
 tip.closeTip();tip.toggleTip({currentTarget:card},{});assert.equal(tip.activeTip.value.pinned,true)
})
