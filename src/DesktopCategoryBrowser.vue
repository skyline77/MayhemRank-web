<script setup lang="ts">
import {computed,nextTick,ref,watch,onUnmounted} from 'vue'
import {closeTip} from './tooltip'
import {captureCategoryContents,captureCategoryGrid,dissolveCategoryContents} from './categoryDissolve'
type Group={id:string;name:string;label:string;css:string}
const props=defineProps<{enabled:boolean;groups:readonly Group[];panelId:string}>()
const root=ref<HTMLElement|null>(null),activeId=ref<string|null>(null),regionHeight=ref(0),cardHeight=ref(0),contentTop=ref(10),lineColor=ref('var(--prismatic)')
const current=computed(()=>props.groups.find(group=>group.id===activeId.value))
const colors:Record<string,string>={prismatic:'var(--prismatic)',gold:'var(--gold)',silver:'var(--silver-rail)',items:'var(--silver)'}
let clearDissolve=()=>{},revision=0
function stopMotion(){revision++;clearDissolve();clearDissolve=()=>{}}
async function toggle(id:string){
 closeTip()
 if(!props.enabled || !root.value)return
 const was=activeId.value,next=was===id?null:id
 stopMotion()
 const token=revision,reduced=matchMedia('(prefers-reduced-motion:reduce)').matches
 const viewport=root.value.querySelector<HTMLElement>('[data-browser-group="'+id+'"] > .detail-card-viewport')
 const shadowCopies:HTMLElement[]=[]
 if(!was && !reduced){
  const origin=root.value.getBoundingClientRect()
  for(const row of Array.from(root.value.querySelectorAll<HTMLElement>('.detail-card-viewport'))){
   const rect=row.getBoundingClientRect()
   for(const pseudo of ['::before','::after']){
    const style=getComputedStyle(row,pseudo)
    if(Number(style.opacity)<=0)continue
    const copy=document.createElement('span');copy.setAttribute('aria-hidden','true')
    Object.assign(copy.style,{position:'absolute',pointerEvents:'none',zIndex:'4',left:(rect.left-origin.left)+'px',top:(rect.top-origin.top)+'px',width:rect.width+'px',height:rect.height+'px',boxShadow:style.boxShadow,opacity:style.opacity})
    shadowCopies.push(copy)
   }
  }
 }
 const grid=(!was || !next) && !reduced?captureCategoryGrid(root.value):undefined
 const old=was && next && !reduced?captureCategoryContents(root.value.querySelector('.category-active > .detail-card-viewport')):[]
 if(!was){
  regionHeight.value=root.value.getBoundingClientRect().height
  const rail=root.value.querySelector('.build-detail-rail')?.getBoundingClientRect()
  cardHeight.value=rail?.height || 0
  contentTop.value=(rail?.top || 0)-root.value.getBoundingClientRect().top
 }
 const render=async()=>{
  if(next)lineColor.value=colors[props.groups.find(group=>group.id===next)!.css]!
  activeId.value=next
  await nextTick()
  root.value?.querySelector('.category-active > .detail-card-viewport')?.scrollTo({top:0})
 }

 await render()
 if(token===revision && !reduced){
  const clearCards=dissolveCategoryContents(next?viewport:root.value,old,grid,!next)
  const shadows:Animation[]=[]
  for(const copy of shadowCopies){root.value!.append(copy);shadows.push(copy.animate([{opacity:copy.style.opacity},{opacity:0}],{duration:260,easing:'ease',fill:'both'}))}
  if(!next)for(const row of Array.from(root.value!.querySelectorAll<HTMLElement>('.detail-card-viewport'))){
   for(const [pseudo,visible] of [['::before','has-previous'],['::after','has-more']] as const){
    if(row.classList.contains(visible))shadows.push(row.animate([{opacity:0},{opacity:1}],{duration:260,easing:'ease',pseudoElement:pseudo}))
   }
  }
  const clearShadows=()=>{shadows.forEach(animation=>animation.cancel());shadowCopies.forEach(copy=>copy.remove())}
  void Promise.allSettled(shadows.map(animation=>animation.finished)).then(clearShadows)
  clearDissolve=()=>{clearCards();clearShadows()}
 }
}
watch(()=>props.enabled,()=>{stopMotion();activeId.value=null})
onUnmounted(stopMotion)
</script>
<template>
 <div ref="root" class="desktop-category-browser" :class="{'is-browsing':enabled && current,'is-mobile':!enabled}" :style="{'--category-color':lineColor,'--browser-card-height':cardHeight+'px','--browser-content-top':contentTop+'px',height:enabled && current?regionHeight+'px':undefined}">
  <template v-for="(group,index) in groups" :key="group.id">
   <slot :group="group" :tab-mode="enabled && !!current" :expanded="enabled && activeId===group.id" :toggle="()=>toggle(group.id)" :row-attrs="{'data-browser-group':group.id,class:{'category-active':enabled && activeId===group.id,'category-inactive':enabled && !!current && activeId!==group.id,'category-first':index===0,'category-last':index===groups.length-1}}" />
  </template>
 </div>
</template>
<style scoped>
.desktop-category-browser{position:relative;display:grid;grid-column:1 / -1;grid-template-columns:subgrid;min-width:0}
.desktop-category-browser.is-mobile{display:contents}
@media(min-width:701px){
 .desktop-category-browser{grid-template-columns:var(--detail-rail-width) minmax(0,1fr);column-gap:14px}
 .desktop-category-browser :deep(.build-detail-row){padding:10px 0;min-height:0}
 .desktop-category-browser :deep(.build-detail-cards){height:auto;padding-bottom:0;grid-auto-rows:max-content}
 .desktop-category-browser :deep(.detail-card-viewport)::before,.desktop-category-browser :deep(.detail-card-viewport)::after{bottom:0}
 .is-browsing{grid-template-rows:calc(var(--browser-card-height) + var(--browser-content-top) + 10px) repeat(3,calc(var(--browser-card-height) + 20px));align-content:start}
 .is-browsing :deep(.build-detail-row){height:calc(var(--browser-card-height) + 20px);box-sizing:border-box;position:static;overflow:visible}
 .is-browsing :deep(.build-detail-row.category-first){height:calc(var(--browser-card-height) + var(--browser-content-top) + 10px)}
 .is-browsing :deep(.build-detail-rail){border-color:transparent;border-top-right-radius:0;border-bottom-right-radius:0}
 
 .is-browsing :deep(.build-detail-rail:hover){filter:brightness(.9)}
 .is-browsing :deep(.build-detail-sort){border-top-color:transparent;color:color-mix(in srgb,var(--rail-ink) 65%,var(--rarity));pointer-events:none;filter:none}
 .desktop-category-browser :deep(.sort-direction){transition:opacity 260ms ease}
 .is-browsing :deep(.build-detail-sort .sort-direction){opacity:0}
 .is-browsing :deep(.rarity-expand){pointer-events:none}
 .is-browsing :deep(.category-active .build-detail-sort){background:var(--rarity)}
 .desktop-category-browser::before{content:'';opacity:0;transition:opacity 240ms ease,background-color 240ms ease,filter 180ms ease;position:absolute;left:var(--detail-rail-width);width:8px;top:var(--browser-content-top);bottom:10px;background:var(--category-color);pointer-events:none}
 .is-browsing::before{opacity:1}
 .is-browsing:has(.category-active .build-detail-rail:hover)::before{filter:brightness(.9)}
 .desktop-category-browser :deep(.build-detail-rail),.desktop-category-browser :deep(.rarity-expand),.desktop-category-browser :deep(.build-detail-sort){transition:background-color 260ms ease,color 260ms ease,border-color 260ms ease,border-radius 260ms ease,filter 180ms ease}
 .desktop-category-browser :deep(.rarity-expand){background:var(--rarity)}
 .is-browsing :deep(.category-inactive .build-detail-rail){--inactive-tab-bg:oklch(from color-mix(in srgb,var(--rarity) 84%,var(--rail-shade)) max(0,calc(l - .05)) c h);background:var(--inactive-tab-bg)}
 .is-browsing :deep(.category-inactive .rarity-expand),.is-browsing :deep(.category-inactive .build-detail-sort){background:var(--inactive-tab-bg)}
 .is-browsing :deep(.category-inactive > .detail-card-viewport){display:none}
 .is-browsing :deep(.category-active > .detail-card-viewport){position:absolute;left:calc(var(--detail-rail-width) + 14px);right:0;top:var(--browser-content-top);bottom:10px;overflow-y:auto;overflow-x:hidden;column-gap:var(--detail-card-gap);scrollbar-width:thin;scrollbar-color:var(--border-strong) transparent}
 .is-browsing :deep(.category-active > .detail-card-viewport)::before,.is-browsing :deep(.category-active > .detail-card-viewport)::after{display:none}
 .is-browsing :deep(.category-active .build-detail-cards){display:grid;grid-auto-flow:row;grid-template-columns:repeat(auto-fill,var(--detail-card-width));grid-auto-rows:var(--browser-card-height);gap:20px var(--detail-card-gap);max-height:none;overflow:visible;padding:0}
}
@media(prefers-reduced-motion:reduce){.desktop-category-browser::before,.desktop-category-browser :deep(.build-detail-rail),.desktop-category-browser :deep(.rarity-expand),.desktop-category-browser :deep(.build-detail-sort),.desktop-category-browser :deep(.sort-direction){transition:none}}
</style>
