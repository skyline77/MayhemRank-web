<script setup lang="ts">
import {locale} from './locale'
import {t,message} from './i18n'
import {computed,ref,watch,onMounted,onBeforeUnmount} from 'vue'
import type {DescriptionEntry} from './tooltipData'
import type {RuneDescription} from './runeDescriptions'
import StatText from './StatText.vue'
import {readDescriptionPreference,saveDescriptionPreference,type DescriptionMode,type DescriptionSide} from './runeDescriptionPreference'
const props=defineProps<{
 id:string;label:string;initialMode:DescriptionMode;side:DescriptionSide;preferInitialMode?:boolean
 simple:DescriptionEntry|null;simpleLoading:boolean;simpleError:string
 wiki?:RuneDescription;wikiLoading:boolean;wikiError:string
 translation?:RuneDescription;translationLoading:boolean;translationError:string
}>()
const emit=defineEmits<{retry:[mode:DescriptionMode];requestTranslation:[]}>()
const modes=computed(()=>locale.value==='en-US'
 ?[{id:'wiki' as const,label:'Wiki'}]
 :[{id:'translation' as const,label:locale.value==='ja-JP'?'Wiki訳文':locale.value==='zh-TW'?'Wiki譯文':'Wiki译文'},
   {id:'wiki' as const,label:'Wiki原文'}])
const preferred=props.preferInitialMode?props.initialMode:readDescriptionPreference(props.side,props.initialMode)
const selected=ref<DescriptionMode>(locale.value==='zh-CN'?(preferred==='simple'?'translation':preferred):'wiki')
watch(locale,()=>{if(locale.value==='en-US')selected.value='wiki'})
const tabList=ref<HTMLElement|null>(null)
const indicator=ref({left:0,width:0})
let tabObserver:ResizeObserver|undefined
function measureIndicator(){
 const tab=tabList.value?.querySelector<HTMLElement>('[aria-selected=true]')
 if(tab)indicator.value={left:tab.offsetLeft,width:tab.offsetWidth}
}
watch([selected,locale],measureIndicator,{flush:'post'})
onMounted(()=>{
 measureIndicator()
 tabObserver=new ResizeObserver(measureIndicator)
 if(tabList.value){tabObserver.observe(tabList.value);tabList.value.querySelectorAll('button').forEach(tab=>tabObserver?.observe(tab))}
})
onBeforeUnmount(()=>tabObserver?.disconnect())
function select(mode:DescriptionMode){
 selected.value=mode
 saveDescriptionPreference(props.side,mode)
}
watch(selected,mode=>{if(mode==='translation')emit('requestTranslation')},{immediate:true})
const text=computed(()=>selected.value==='simple'?undefined:selected.value==='wiki'?props.wiki?.description:props.translation?.description)
const loading=computed(()=>selected.value==='simple'?props.simpleLoading:selected.value==='wiki'?props.wikiLoading:props.translationLoading || props.wikiLoading)
const error=computed(()=>selected.value==='simple'?props.simpleError:selected.value==='wiki'?props.wikiError:props.translationError || props.wikiError)
function navigate(event:KeyboardEvent,index:number){
 const next=event.key==='ArrowRight'?(index+1)%modes.value.length:event.key==='ArrowLeft'?(index+modes.value.length-1)%modes.value.length:event.key==='Home'?0:event.key==='End'?modes.value.length-1:null
 if(next===null)return
 event.preventDefault()
 select(modes.value[next]!.id)
 const list=(event.currentTarget as HTMLElement).parentElement
 list?.querySelectorAll<HTMLButtonElement>('[role=tab]')[next]?.focus()
}
function retry(){emit('retry',selected.value)}
</script>
<template>
 <section class="rune-description-panel" :aria-label="label">
  <div ref="tabList" class="rune-description-tabs" role="tablist" :aria-label="message('{p0}内容选择', { p0: label })">
   <button v-for="(mode,index) in modes" :id="id+'-tab-'+mode.id" :key="mode.id" type="button" role="tab" :aria-selected="selected===mode.id" :aria-controls="id+'-content'" :tabindex="selected===mode.id?0:-1" @click="select(mode.id)" @keydown="navigate($event,index)">{{mode.label}}</button>
   <span class="rune-description-tab-indicator" aria-hidden="true" :style="{width:indicator.width+'px',transform:`translateX(${indicator.left}px)`,visibility:indicator.width?'visible':'hidden'}"></span>
  </div>
  <div class="rune-description-content">
   <!-- On narrow screens, English copy keeps the panel height stable when switching modes. -->
   <div class="rune-description-sizer" aria-hidden="true" inert>
    <template v-if="wiki"><p v-for="(paragraph,index) in wiki.description.split('\n\n')" :key="index"><StatText :text="paragraph" lang="en-US" /></p></template>
    <p v-else><StatText :text="simple?.description || '正在加载说明…'" /></p>
   </div>
  <div :id="id+'-content'" class="rune-description-text" role="tabpanel" :aria-labelledby="id+'-tab-'+selected" :lang="selected==='wiki'?'en-US':selected==='translation'?'zh-CN':locale" tabindex="0">
    <Transition name="rune-copy-fade" mode="out-in">
    <div :key="selected+':'+(text || error || loading)" class="rune-description-copy">
    <p v-if="selected==='simple'" role="status">{{t('该语言暂无经核验的 Mayhem 效果描述。')}}</p>
    <template v-else-if="text"><p v-for="(paragraph,index) in text.split('\n\n')" :key="index"><StatText :text="paragraph" :lang="selected==='wiki'?'en-US':'zh-CN'" /></p></template>
    <p v-else-if="error" role="status">{{t(error)}} <button class="rune-description-retry" @click="retry">{{t("重试")}}</button></p>
    <p v-else-if="loading" role="status">{{selected === 'wiki' ? t("正在加载英文说明…") : t("正在加载 Wiki 中文译文…")}}</p>
    <p v-else role="status">{{selected === 'wiki' ? t("Wiki 暂无可确认对应的英文说明。") : t("暂无与当前 Wiki 原文对应的中文译文。")}}</p>
    </div>
    </Transition>
  </div>
  </div>
 </section>
</template>

<style scoped>
.rune-description-tabs{position:relative}
.rune-description-tabs button[aria-selected=true]{border-bottom-color:transparent}
.rune-description-tab-indicator{position:absolute;left:0;bottom:0;height:2px;background:var(--accent-text);pointer-events:none;transition:transform 220ms ease-in-out,width 220ms ease-in-out}
.rune-description-tabs button{transition:color 180ms ease,background-color 180ms ease,border-color 180ms ease}
.rune-copy-fade-enter-active{transition:opacity 200ms ease-out}
.rune-copy-fade-leave-active{transition:opacity 100ms ease-in}
.rune-copy-fade-enter-from,.rune-copy-fade-leave-to{opacity:0}
@media(prefers-reduced-motion:reduce){
 .rune-description-tabs button,.rune-description-tab-indicator{transition:none}
 .rune-copy-fade-enter-active,.rune-copy-fade-leave-active{transition:none}
}
</style>
