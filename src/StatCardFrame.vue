<script setup lang="ts">
import type {Component} from 'vue'
withDefaults(defineProps<{as?:string|Component;captionAs?:string;captionClass?:string}>(),{as:'div',captionAs:'div'})
</script>
<template>
 <component :is="as" class="stat-card-frame">
  <component :is="captionAs" class="stat-card-layout" :class="captionClass"><slot /></component>
 </component>
</template>
<style>
.stat-card-frame { box-sizing:border-box; width:var(--stat-card-width,var(--detail-card-width)); min-width:0; align-self:start; margin:0; padding:0; border:1px solid var(--border); border-radius:9px; background:var(--surface); overflow:hidden; }
.stat-card-layout { display:grid; grid-template-rows:var(--stat-card-rows,74px repeat(var(--stat-card-metric-count,2),28px)); margin:0; }
</style>
