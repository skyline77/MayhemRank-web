import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import ts from 'typescript'
const js=ts.transpile(readFileSync(new URL('../src/detailVisibility.ts',import.meta.url),'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022})
const {observeDetailVisibility}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))

test('pinning follows visible panels, survives handoff and removes stale observers',()=>{
 const saved={IntersectionObserver:globalThis.IntersectionObserver,MutationObserver:globalThis.MutationObserver}
 let notify,changed,mutationDisconnected=false,intersectionDisconnected=false
 const observed=new Set(),classes=new Set(),first={},second={}
 let elements=[first]
 globalThis.IntersectionObserver=class{
  constructor(callback){notify=callback}
  observe(panel){observed.add(panel)}
  unobserve(panel){observed.delete(panel)}
  disconnect(){intersectionDisconnected=true}
 }
 globalThis.MutationObserver=class{
  constructor(callback){changed=callback}
  observe(){}
  disconnect(){mutationDisconnected=true}
 }
 const root={querySelectorAll:()=>elements,classList:{add:name=>classes.add(name),toggle:(name,on)=>on?classes.add(name):classes.delete(name),remove:name=>classes.delete(name)}}
 try{
  const stop=observeDetailVisibility(root)
  assert.deepEqual([...observed],[first])
  assert.equal(classes.has('has-shown-detail'),false)
  notify([{target:first,isIntersecting:true}])
  assert.equal(classes.has('has-visible-detail'),true)
  assert.equal(classes.has('has-shown-detail'),true)
  // Scrolling the open detail above or below the viewport restores pinning.
  notify([{target:first,isIntersecting:false}])
  assert.equal(classes.has('has-visible-detail'),false)
  notify([{target:first,isIntersecting:true}])
  assert.equal(classes.has('has-visible-detail'),true)
  elements=[first,second];changed()
  notify([{target:first,isIntersecting:false},{target:second,isIntersecting:true}])
  assert.equal(classes.has('has-visible-detail'),true)
  elements=[first];changed()
  assert.equal(classes.has('has-visible-detail'),false)
  assert.equal(observed.has(second),false)
  notify([{target:second,isIntersecting:true}])
  assert.equal(classes.has('has-visible-detail'),false)
  stop()
  assert.equal(mutationDisconnected,true);assert.equal(intersectionDisconnected,true)
  assert.equal(classes.size,0)
 }finally{Object.assign(globalThis,saved)}
})
