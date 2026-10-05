import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import ts from 'typescript'
import {ref,computed,watch,nextTick,effectScope,reactive} from 'vue'
import {loadTS} from './load-ts.mjs'
const source=readFileSync(new URL('../src/BuildDetail.vue',import.meta.url),'utf8')
const setup=source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm,'')
const compiled=ts.transpile(setup+'\nreturn {entry,roles,filter,changeFilter,detail,baseline,query,loading,error,load,displayedFilter,initialLoading,scopeName,replaceHero,heroQuery}',{target:ts.ScriptTarget.ES2022})
const {championBuilds}=await loadTS('../src/buildBoard.ts')
const {filterDetailGroups}=await loadTS('../src/detailSearch.ts')
const {heroFilter}=await loadTS('../src/heroFilter.ts')
const settle=async()=>{await nextTick();await Promise.resolve();await nextTick()}
function harness(t,delayed=false){
 const entries=[{id:'57:AP',championId:57,name:'茂凯',role:'AP',games:20,winRate:.7},
  {id:'57:tank',championId:57,name:'茂凯',role:'坦克',games:100,winRate:.5},
  {id:'10:AP',championId:10,name:'凯尔',role:'AP',games:200,winRate:.6}]
 const props=reactive({entry:entries[0],entries,patch:'16.18',panelId:'test'})
 const pending=[],events=[],scope=effectScope()
 const loadHeroDetail=async(entry,patch,filter)=>{
  const n=filter.role?entry.games:filter.rune?15:filter.item?30:150,baseline=filter.role?entry.winRate:.4
  const value={summary:{games:n,winRate:baseline},detail:{games:n,groups:{}},spells:{games:n},meta:{patch}}
  if(delayed)return new Promise((resolve,reject)=>pending.push({resolve:()=>resolve(value),reject}))
  return value
 }
 const env={ref,computed,watch,nextTick,preserveDetailPosition:async(panel,render)=>render(),onUnmounted:()=>{},provide:()=>{},readHistorySection:()=>undefined,registerHistorySection:()=>()=>{},
  usePatchAvailability:()=>ref(true),defineProps:()=>props,withDefaults:p=>p,defineEmits:()=> (...args)=>{events.push(args);if(args[0]==='hero-select')props.entry=args[1]},
  championBuilds,heroFilter,closeTip:()=>{},loadHeroDetail,loadDetailSearch:async()=>({items:{},augments:{}}),filterDetailGroups}
 const run=new Function(...Object.keys(env),compiled)
 const app=scope.run(()=>run(...Object.values(env)))
 t.after(()=>scope.stop());return {...app,props,pending,events}
}
const rune={id:'7',name:'亮剑',icon:'/7.png'}
test('role switch preserves board anchor; repeated selected role clears to all appearances',async t=>{
 const app=harness(t);await settle();assert.equal(app.entry.value.role,'AP')
 app.changeFilter({type:'role',role:'坦克'});await settle()
 assert.equal(app.detail.value.games,100);assert.equal(app.baseline.value,.5);assert.equal(app.props.entry.id,'57:AP')
 app.changeFilter({type:'role',role:'坦克'});await settle()
 assert.equal(app.filter.value.role,null);assert.equal(app.detail.value.games,150);assert.equal(app.baseline.value,.4)
})
test('rune and role conditions are mutually exclusive; clicking a rune directly replaces the selected role',async t=>{
 const app=harness(t);await settle()
 assert.equal(app.filter.value.role,'AP')
 app.changeFilter({type:'rune',rune});await settle();assert.equal(app.detail.value.games,15)
 app.changeFilter({type:'rune',rune});await settle();assert.equal(app.detail.value.games,150);assert.deepEqual(app.filter.value,{role:null,rune:null})
 app.changeFilter({type:'rune',rune});app.changeFilter({type:'role',role:'AP'});await settle()
 assert.deepEqual(app.filter.value,{role:'AP',rune:null});assert.equal(app.detail.value.games,20)
 // Standalone parent reflects the selected role without resetting the chosen filter.
 app.changeFilter({type:'role',role:'坦克'});app.props.entry=app.props.entries[1];await settle()
 assert.equal(app.detail.value.games,100)
})
test('new champion or patch clears rune selection, and champion change clears text search',async t=>{
 const app=harness(t);app.changeFilter({type:'rune',rune});app.query.value='剑'
 app.props.entry=app.props.entries[2];await settle()
 assert.deepEqual(app.filter.value,{role:'AP',rune:null});assert.equal(app.query.value,'');assert.equal(app.detail.value.games,200)
 app.changeFilter({type:'rune',rune});await settle();app.props.patch='16.19';await settle()
 assert.deepEqual(app.filter.value,{role:'AP',rune:null})
})
test('late responses cannot replace the current filter; completed cards remain during loading',async t=>{
 const app=harness(t,true);await nextTick();app.pending[0].resolve();await settle();assert.equal(app.detail.value.games,20)
 app.changeFilter({type:'role',role:'AP'});await nextTick();assert.equal(app.detail.value.games,20)
 assert.equal(app.initialLoading.value,false);assert.equal(app.displayedFilter.value.role,'AP');assert.equal(app.loading.value,true)
 app.changeFilter({type:'rune',rune});await nextTick();assert.equal(app.pending.length,3)
 app.pending[2].resolve();await settle();assert.equal(app.detail.value.games,15);assert.equal(app.displayedFilter.value.rune.id,'7')
 app.pending[1].resolve();await settle();assert.equal(app.detail.value.games,15)
 assert.equal(app.loading.value,false);assert.equal(app.error.value,'')
})
test('initial failure shows no stale values and retry loads the same selection',async t=>{
 const app=harness(t,true);await nextTick();app.pending[0].reject(new Error('offline'));await settle()
 assert.equal(app.detail.value,undefined);assert.equal(app.error.value,'offline')
 const retry=app.load();await nextTick();app.pending[1].resolve();await retry
 assert.equal(app.detail.value.games,20);assert.equal(app.error.value,'')
})

test('refreshing the same anchor object does not clear a rune or all-appearance selection',async t=>{
 const app=harness(t);app.changeFilter({type:'rune',rune});await settle()
 app.props.entry={...app.props.entry};await settle();assert.equal(app.filter.value.rune.id,'7')
 app.changeFilter({type:'rune',rune});await settle();app.props.entry={...app.props.entry};await settle()
 assert.deepEqual(app.filter.value,{role:null,rune:null});assert.equal(app.detail.value.games,150)
})

test('clicking another rune replaces the first without retaining a role or intersecting conditions',async t=>{
 const app=harness(t);await settle()
 app.changeFilter({type:'rune',rune});await settle()
 const other={id:'8',name:'另一符文',icon:'/8.png'}
 app.changeFilter({type:'rune',rune:other});await settle()
 assert.deepEqual(app.filter.value,{role:null,rune:other})
 app.changeFilter({type:'rune',rune:other});await settle()
 assert.deepEqual(app.filter.value,{role:null,rune:null});assert.equal(app.detail.value.games,150)
})


test('equipment replaces role or rune, toggles off, and cannot collide with rune IDs',async t=>{
 const app=harness(t);await settle()
 const item={id:'7',name:'三相之力',icon:'/item.png'}
 app.changeFilter({type:'item',item});await settle()
 assert.equal(app.detail.value.games,30);assert.deepEqual(app.filter.value,{role:null,rune:null,item})
 app.changeFilter({type:'rune',rune});await settle()
 assert.equal(app.detail.value.games,15);assert.deepEqual(app.filter.value,{role:null,rune})
 app.changeFilter({type:'item',item});await settle()
 app.changeFilter({type:'item',item});await settle()
 assert.deepEqual(app.filter.value,{role:null,rune:null});assert.equal(app.detail.value.games,150)
 app.changeFilter({type:'item',item});await settle()
 app.changeFilter({type:'role',role:'AP'});await settle()
 assert.deepEqual(app.filter.value,{role:'AP',rune:null});assert.equal(app.detail.value.games,20)
 app.changeFilter({type:'item',item});await settle();app.props.patch='16.19';await settle()
 assert.deepEqual(app.filter.value,{role:'AP',rune:null})
})

test('late item response cannot overwrite a more recent rune filter',async t=>{
 const app=harness(t,true);await nextTick();app.pending[0].resolve();await settle()
 app.changeFilter({type:'item',item:{id:'100',name:'装备',icon:'/item.png'}});await nextTick()
 app.changeFilter({type:'rune',rune});await nextTick()
 app.pending[2].resolve();await settle();app.pending[1].resolve();await settle()
 assert.equal(app.detail.value.games,15);assert.equal(app.filter.value.rune.id,'7')
})


test('failed refresh retains coherent completed data and retry commits the requested filter',async t=>{
 const app=harness(t,true);await nextTick();app.pending[0].resolve();await settle()
 app.changeFilter({type:'rune',rune});await nextTick()
 assert.equal(app.detail.value.games,20);assert.equal(app.displayedFilter.value.role,'AP')
 app.pending[1].reject(new Error('offline'));await settle()
 assert.equal(app.detail.value.games,20);assert.equal(app.displayedFilter.value.role,'AP')
 assert.equal(app.error.value,'offline');assert.equal(app.loading.value,false)
 const retry=app.load();await nextTick();app.pending[2].resolve();await retry
 assert.equal(app.detail.value.games,15);assert.equal(app.displayedFilter.value.rune.id,'7');assert.equal(app.error.value,'')
})

test('changing champion, patch or snapshot cannot retain stale cohort cards',async t=>{
 for(const update of [app=>app.props.entry=app.props.entries[2],app=>app.props.patch='16.19',app=>{app.props.entries=app.props.entries.map(entry=>({...entry,snapshotId:'new'}));app.props.entry=app.props.entries[0]}]){
  const app=harness(t,true);await nextTick();app.pending[0].resolve();await settle()
  update(app);await nextTick()
  assert.equal(app.detail.value,undefined);assert.equal(app.initialLoading.value,true)
  app.pending[1].resolve();await settle();assert.ok(app.detail.value)
 }
})


test('detail hero search replaces the current hero and clears old filters without closing the panel',async t=>{
 const app=harness(t);await settle()
 app.changeFilter({type:'rune',rune});app.query.value='hgjbg';app.heroQuery.value='ke'
 await app.replaceHero(app.props.entries[2]);await settle()
 assert.equal(app.entry.value.championId,10)
 assert.equal(app.props.panelId,'test')
 assert.equal(app.heroQuery.value,'');assert.equal(app.query.value,'')
 assert.deepEqual(app.filter.value,{role:'AP',rune:null})
 assert.equal(app.detail.value.games,200)
 assert.equal(app.events.filter(([name])=>name==='hero-select').length,1)
 assert.equal(app.events.some(([name])=>name==='close'),false)
 await app.replaceHero(app.props.entries[2]);await settle()
 assert.equal(app.events.filter(([name])=>name==='hero-select').length,1)
})
