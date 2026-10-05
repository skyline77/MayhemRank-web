<script setup lang="ts">
import { t } from './i18n'
import { computed } from 'vue'
import { statDefinitions, type StatKey } from './statTokens'
const props = defineProps<{ stat: StatKey; text?: string; prefix?: string }>()
const definition = computed(() => statDefinitions[props.stat])
</script>
<template>
  <span class="stat-inline" :data-stat="stat" :title="t(definition.label)"
    >{{ prefix
    }}<img
      :src="'/stat-icons/' + definition.icon + '.webp'"
      width="16"
      height="16"
      alt=""
      aria-hidden="true"
    />{{ prefix ? text?.slice(prefix.length) : (text ?? t(definition.label)) }}</span
  >
</template>
