<script setup lang="ts">
import {nextTick,onUnmounted,ref,useId} from 'vue'
defineProps<{lines:string[]}>()
const id=useId(),open=ref(false),anchor=ref<HTMLElement|null>(null),tip=ref<HTMLElement|null>(null)
const position=ref({left:'0px',top:'0px'})
function hide(){open.value=false;window.removeEventListener('scroll',hide,true);window.removeEventListener('resize',hide)}
async function show(){
 if(!anchor.value)return
 open.value=true
 const rect=anchor.value.getBoundingClientRect()
 position.value={left:Math.max(12,Math.min(rect.right-250,window.innerWidth-262))+'px',top:rect.bottom+8+'px'}
 await nextTick()
 if(!open.value || !tip.value)return
 const box=tip.value.getBoundingClientRect()
 position.value={left:Math.max(12,Math.min(rect.right-box.width,window.innerWidth-box.width-12))+'px',
  top:(rect.top>box.height+16?rect.top-box.height-8:rect.bottom+8)+'px'}
 window.addEventListener('scroll',hide,true);window.addEventListener('resize',hide)
}
onUnmounted(hide)
</script>
<template>
 <button ref="anchor" type="button" class="combo-stat" :aria-describedby="id" @mouseenter="show" @mouseleave="hide" @focus="show" @blur="hide" @click="show" @keydown.esc.stop="hide"><slot /></button>
 <Teleport to="body"><span v-if="open" :id="id" ref="tip" role="tooltip" class="combo-stat-tip" :style="position"><span v-for="line in lines" :key="line">{{line}}</span></span></Teleport>
</template>
<style scoped>
.combo-stat{display:inline-flex;align-items:center;padding:4px 0;border:0;background:none;color:inherit;font:inherit;cursor:help;white-space:nowrap}
.combo-stat:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.combo-stat-tip{position:fixed;z-index:1000;width:max-content;max-width:min(280px,calc(100vw - 24px));padding:9px 12px;border:1px solid var(--border-strong);border-radius:6px;background:var(--card);color:var(--text);box-shadow:var(--shadow);font:13px/1.7 "Noto Sans TC",system-ui,sans-serif;text-align:left;pointer-events:none}
.combo-stat-tip>span{display:block}.combo-stat-tip>span+span{color:var(--muted)}
</style>
