<script setup lang="ts">
import {t,message} from './i18n'
import {formatCount} from './formatCount'
import {locale} from './locale'
import {winRateColor} from './winRateColor'
defineProps<{slots:{key:number;name:string;icon?:string;rune?:boolean}[];winRate?:number;pickRate:number;usageText?:string;usageTitle?:string;games?:number;showWinLabel?:boolean}>()
const emit=defineEmits<{'icon-error':[icon:string]}>()
const pct=(value:number)=>(value*100).toFixed(1)+'%'
</script>
<template>
 <span class="role-item-icons" aria-hidden="true"><span v-for="slot in slots" :key="slot.key" class="role-item-slot" :class="{'is-rune':slot.rune}"><img v-if="slot.icon" :src="slot.icon" alt="" width="28" height="28" @error="emit('icon-error',slot.icon)" /><span v-else class="role-item-placeholder"></span></span></span>
 <span class="role-choice-stats"><strong :style="{color:winRate===undefined?undefined:winRateColor(winRate)}"><span v-if="showWinLabel">{{locale==='en-US'?'WR: ':t('胜率：')}}</span>{{winRate===undefined?'—':pct(winRate)}}</strong><small :title="usageTitle">{{t("使用率：")}}{{usageText || pct(pickRate)}}</small><small v-if="games!==undefined">{{formatCount(games)}}{{locale==='en-US'?' games':t("场")}}</small></span>
</template>
<style scoped>
.role-item-icons{display:inline-flex;align-items:center;gap:4px;flex:none;width:var(--role-icons-width)}
.role-item-slot{display:block;flex:0 0 28px;width:28px;height:28px}
.role-item-placeholder{display:block;width:100%;height:100%;border-radius:3px;background:var(--chip);border:1px solid var(--border)}
img{display:block;width:28px;height:28px;object-fit:contain;border-radius:3px}
.role-choice-stats{display:flex;flex-direction:column;align-items:flex-start;gap:2px;flex:none;width:calc(4em + 6ch);font-size:12px;font-variant-numeric:tabular-nums}
strong{font-size:16px;line-height:1.2}
.role-choice-stats small{margin:0;font-size:12px;line-height:1.2;color:var(--muted);white-space:nowrap}
</style>
