<script setup lang="ts">
import RuneSearch from './RuneSearch.vue'
import type { RuneEntry } from './augmentBoard'
import type { DetailSearchIndex } from '@/details/detailSearch'
defineProps<{
  entries: readonly RuneEntry[]
  patch: string
  index: DetailSearchIndex | null
  loading: boolean
}>()
const query = defineModel<string>({ required: true })
const emit = defineEmits<{ select: [entry: RuneEntry] }>()
</script>
<template>
  <div class="search-with-version">
    <RuneSearch
      v-model="query"
      :entries="entries"
      :patch="patch"
      :index="index"
      :loading="loading"
      @select="emit('select', $event)"
    />
  </div>
</template>
