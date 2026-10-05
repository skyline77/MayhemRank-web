<script setup lang="ts">
import {t,message} from './i18n'
import {gameName,gameTitle,roleName} from './gameLocalization'
import {computed} from 'vue'
import {recentViews} from './recentViews'
import SuggestionSearch from './SuggestionSearch.vue'
import {buildDetailUrl} from './detailLink'
import {heroSuggestions} from './heroSuggestions'
import {locale} from './locale'
import type {BuildEntry} from './buildBoard'
const props=defineProps<{entries:readonly BuildEntry[];patch:string;loading:boolean}>()
const query=defineModel<string>({required:true})
const emit=defineEmits<{select:[entry:BuildEntry]}>()
const recentResults=computed(()=>recentViews.hero.value.flatMap(id=>{const entry=props.entries.find(entry=>String(entry.championId)===id);return entry?[entry]:[]}))
const results=computed(()=>heroSuggestions(props.entries,query.value))
const hintIcon=computed(()=>props.entries.find(entry=>entry.championId===17)?.icon)
</script>
<template>
 <SuggestionSearch v-model="query" :results="results" :recent-results="recentResults" :loading="loading" scope="hero" :visible-limit="5"
  :label="t('搜索英雄或流派')" placeholder="" hint="timo | tm" :hint-icon="hintIcon" :loading-text="t('正在加载英雄……')" :empty-text="t('未找到英雄')" :list-label="t('匹配的英雄')"
  :href="(entry:BuildEntry)=>buildDetailUrl(entry.championId,entry.role,patch)" :title="(entry:BuildEntry)=>gameTitle(entry.championId,patch,entry.name)" :subtitle="(entry:BuildEntry)=>locale==='zh-CN'?gameName('champions',entry.championId,patch,entry.name):''" @select="emit('select',$event)" />
</template>
