<script setup lang="ts">
import {t} from './i18n'
import HeightReveal from './HeightReveal.vue'
defineProps<{id:string;title:string;modelValue?:boolean;disabled?:boolean;nonCollapsible?:boolean}>()
defineEmits<{'update:modelValue':[value:boolean]}>()
</script>
<template>
 <section :id="id" class="detail-section" :aria-labelledby="id+'-title'">
  <header class="detail-section-heading">
   <slot name="heading-note" />
   <h3 :id="id+'-title'"><span v-if="nonCollapsible" class="detail-section-label">{{t(title)}}</span><button v-else class="detail-section-toggle" type="button" :disabled="disabled" :aria-expanded="!disabled && modelValue" :aria-controls="id+'-content'" @click="$emit('update:modelValue',!modelValue)"><span>{{t(title)}}</span><span v-if="!disabled" class="detail-section-sign" aria-hidden="true">{{modelValue?'−':'+'}}</span></button></h3>
  </header>
  <div :id="id+'-content'">
   <HeightReveal :open="nonCollapsible || (!disabled && !!modelValue)"><div class="detail-section-content"><slot /></div></HeightReveal>
  </div>
 </section>
</template>
<style scoped>
.detail-section { min-width:0; padding:12px 0; border-bottom:1px solid var(--border) }
.detail-section-heading { display:flex; align-items:center; gap:0 }
.detail-section-heading h3 { margin:0; font-size:18px; font-weight:600; line-height:1.4 }
.detail-section-label { display:flex; align-items:center; min-height:40px; padding:4px 0; color:var(--text) }
.detail-section-toggle { display:inline-flex; align-items:center; gap:12px; min-height:40px; padding:4px 0; border:0; background:transparent; color:var(--text); font:inherit; text-align:left; cursor:pointer }
.detail-section-toggle:hover:not(:disabled) { color:var(--accent-text) }
.detail-section-toggle:focus-visible { outline:2px solid var(--accent); outline-offset:2px }
.detail-section-toggle:disabled { color:var(--muted); cursor:default }
.detail-section-sign { font-size:16px; font-weight:400; color:var(--muted) }
.detail-section-content { padding-top:8px }
.detail-section-content :deep(.champion-patch-notes) { padding:0; margin:0; border:0 }
</style>
