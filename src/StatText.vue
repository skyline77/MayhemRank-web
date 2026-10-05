<script setup lang="ts">
import {computed} from 'vue'
import StatInline from './StatInline.vue'
import {tokenizeStats} from './statTokens'
import {locale} from './locale'
const props=defineProps<{text:string;lang?:string}>()
const tokens=computed(()=>tokenizeStats(props.text,props.lang || locale.value))
</script>
<template><template v-for="(token,index) in tokens" :key="index"><StatInline v-if="token.stat" :stat="token.stat" :text="token.text" :prefix="token.prefix" /><template v-else>{{token.text}}</template></template></template>
