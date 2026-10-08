<script setup lang="ts">
import { t } from '@/i18n/i18n'
import { locale } from '@/i18n/locale'
import { availablePatches, selectedVersion, choosePatch } from '@/data/versions'
defineProps<{ hideLabel?: boolean }>()
</script>
<template>
  <label v-if="availablePatches.length" class="patch-picker"
    ><span v-if="!hideLabel">{{ t('版本') }}</span>
    <select
      name="patch"
      :value="selectedVersion"
      :aria-label="t('统计版本')"
      @change="choosePatch(($event.target as HTMLSelectElement).value)"
    >
      <option v-for="version in availablePatches" :key="version.patch" :value="version.patch">
        {{ locale === 'zh-CN' ? version.patch : version.patch.replace(/^16\./, '26.') }}
      </option>
    </select>
  </label>
</template>
