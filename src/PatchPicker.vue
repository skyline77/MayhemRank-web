<script setup lang="ts">
import {t,message} from './i18n'
import {availablePatches,selectedVersion,choosePatch} from './versions'
defineProps<{hideLabel?:boolean}>()
</script>
<template>
 <label v-if="availablePatches.length" class="patch-picker"><span v-if="!hideLabel">{{t("版本")}}</span>
  <select :value="selectedVersion" :aria-label="t('统计版本')" :title="t('16.18：装备投票；16.18旧：原 KMeans 分类。两者同批对局，均要求至少2件成装。')" @change="choosePatch(($event.target as HTMLSelectElement).value)">
   <option v-for="version in availablePatches" :key="version.patch" :value="version.patch">{{version.patch}}</option>
  </select>
 </label>
</template>
