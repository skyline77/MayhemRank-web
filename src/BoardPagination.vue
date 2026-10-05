<script setup lang="ts">
import { t } from './i18n'
defineProps<{
  page: number
  pageCount: number
  disabled?: boolean
  controls: string
  label: string
  announce?: boolean
  bottom?: boolean
}>()
const emit = defineEmits<{ change: [page: number] }>()
</script>
<template>
  <nav class="combo-pagination" :class="{ 'combo-pagination-bottom': bottom }" :aria-label="label">
    <button
      type="button"
      :disabled="disabled || page <= 1"
      :aria-controls="controls"
      @click="emit('change', page - 1)"
    >
      {{ t('上一页') }}
    </button>
    <span :role="announce ? 'status' : undefined" :aria-live="announce ? 'polite' : undefined"
      >{{ page }} / {{ pageCount }}</span
    >
    <button
      type="button"
      :disabled="disabled || page >= pageCount"
      :aria-controls="controls"
      @click="emit('change', page + 1)"
    >
      {{ t('下一页') }}
    </button>
  </nav>
</template>
<style scoped>
.combo-pagination {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
  margin: 0 0 10px;
  font-size: 14px;
}
.combo-pagination-bottom {
  margin: 12px 0 0;
}
.combo-pagination button {
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 12px;
  min-height: 40px;
  font: inherit;
  cursor: pointer;
}
.combo-pagination:lang(en) button {
  inline-size: 7em;
  flex-shrink: 0;
  white-space: nowrap;
}
.combo-pagination button:disabled {
  opacity: 0.4;
  cursor: default;
}
.combo-pagination span {
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
</style>
