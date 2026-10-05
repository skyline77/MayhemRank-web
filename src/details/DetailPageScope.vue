<script setup lang="ts">
import { computed, provide, reactive, watch } from 'vue'
import { detailPaginationKey, pageWindow, type PageList } from './detailPagination'
const props = defineProps<{ enabled: boolean; page: number; size: number }>()
const emit = defineEmits<{
  state: [value: { pages: number; loading: boolean }]
  page: [value: number]
}>()
const lists = reactive<PageList[]>([])
const page = computed({ get: () => props.page, set: value => emit('page', value) })
provide(detailPaginationKey, {
  enabled: computed(() => props.enabled),
  page,
  size: computed(() => props.size),
  lists,
})
watch(
  () =>
    [
      lists.reduce((sum, list) => sum + list.count, 0),
      props.size,
      lists.some(list => list.loading),
    ] as const,
  ([count, size, loading]) => {
    const state = pageWindow(count, props.page, size)
    emit('state', { pages: state.pages, loading })
    if (!loading && state.page !== props.page) emit('page', state.page)
  },
  { immediate: true },
)
</script>
<template><slot /></template>
