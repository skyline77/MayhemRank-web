import assert from 'node:assert/strict'
import {test} from 'node:test'
import {loadTS} from './load-ts.mjs'
const {createBoardReflow}=await loadTS('../src/boardReflow.ts')
async function fixture(run,{reduced=false}={}){
 const keys=['window','matchMedia','innerWidth','innerHeight','getComputedStyle']
 const saved=Object.fromEntries(keys.map(k=>[k,globalThis[k]]))
 const events=new Map(),animations=[];let reads=0,shift=0
 Object.assign(globalThis,{window:{addEventListener:(k,f)=>events.set(k,f),removeEventListener:(k)=>events.delete(k)},matchMedia:()=>({matches:reduced}),innerWidth:1000,innerHeight:800,getComputedStyle:()=>({columnGap:'4',opacity:'.32'})})
 const cards=Array.from({length:60},(_,i)=>({style:{},getAttribute:()=>String(i),
  getBoundingClientRect(){reads++;return {left:10+(i%10)*70+shift,top:10+Math.floor(i/10)*70,right:70+(i%10)*70+shift,bottom:70+Math.floor(i/10)*70,width:60,height:60}},
  animate(keyframes,options){let finish;const finished=new Promise(resolve=>finish=resolve);const a={keyframes,options,finished,cancelled:false,cancel(){this.cancelled=true;finish()},finish};animations.push(a);return a}
 }))
 const root={isConnected:true,clientLeft:0,clientTop:0,clientWidth:1000,clientHeight:800,querySelectorAll:()=>cards,getBoundingClientRect:()=>({left:0,top:0})}
 try{await run({root,cards,animations,events,move:()=>{shift+=100},reads:()=>reads})}
 finally{for(const k of keys){if(saved[k]===undefined)delete globalThis[k];else globalThis[k]=saved[k]}}
}
test('large reflows keep real cards interactive and finish within a bounded time',()=>fixture(async f=>{
 const reflow=createBoardReflow(undefined,undefined,true)
 const done=reflow.run(f.root,async()=>f.move(),{orderedArrival:true,clipToRoot:true})
 await Promise.resolve();await Promise.resolve()
 assert.equal(f.animations.length,60)
 assert.ok(f.animations.every(a=>a.options.duration+a.options.delay<=380))
 assert.ok(f.cards.every(c=>c.style.visibility===undefined))
 assert.ok(f.animations.every(a=>a.keyframes.every(k=>!('height' in k) && !('gridTemplateColumns' in k))))
 f.animations.forEach(a=>a.finish());await done
 assert.equal(f.events.size,0)
}))
test('reduced motion renders without geometry snapshots or animations',()=>fixture(async f=>{
 let rendered=0
 await createBoardReflow().run(f.root,async()=>{rendered++;f.move()})
 assert.equal(rendered,1);assert.equal(f.reads(),0);assert.equal(f.animations.length,0)
},{reduced:true}))
test('an interrupted render cannot install stale animations',()=>fixture(async f=>{
 const reflow=createBoardReflow();let release
 const first=reflow.run(f.root,()=>new Promise(resolve=>release=resolve))
 const second=reflow.run(f.root,async()=>f.move())
 await Promise.resolve();await Promise.resolve()
 const count=f.animations.length
 release();await first
 assert.equal(f.animations.length,count)
 reflow.stop();await second
 assert.ok(f.animations.every(a=>a.cancelled));assert.equal(f.events.size,0)
}))

test('fade keeps search-dimmed cards dimmed',()=>fixture(async f=>{
 const done=createBoardReflow().run(f.root,async()=>f.move(),{fadeCards:true})
 await Promise.resolve();await Promise.resolve()
 assert.ok(f.animations.every(a=>a.keyframes[1].opacity===.32))
 f.animations.forEach(a=>a.finish());await done
}))

test('opt-in square-root timing doubles duration when distance quadruples',()=>fixture(async f=>{
 async function duration(steps){
  const count=f.animations.length
  const done=createBoardReflow().run(f.root,async()=>{for(let i=0;i<steps;i++)f.move()},{clipToRoot:true,maxTravelSlots:10,travelTiming:'sqrt'})
  await Promise.resolve();await Promise.resolve()
  const added=f.animations.slice(count),value=added[0].options.duration
  added.forEach(a=>a.finish());await done
  return value
 }
 const short=await duration(1),long=await duration(4)
 assert.ok(Math.abs(long/short-2)<1e-10)
}))
