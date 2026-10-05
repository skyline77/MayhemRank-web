<script setup lang="ts" generic="T extends string | number">
import { t } from '@/i18n/i18n'
import { computed } from 'vue'
const props = defineProps<{
  modelValue: T
  label: string
  options: readonly {
    value: T
    label: string
    disabled?: boolean
    id?: string
    controls?: string
  }[]
}>()
const emit = defineEmits<{ 'update:modelValue': [value: T] }>()
const activeIndex = computed(() =>
  Math.max(
    0,
    props.options.findIndex(option => option.value === props.modelValue),
  ),
)
</script>
<template>
  <div
    class="hero-ranking-mode"
    :style="{ '--active-mode': activeIndex }"
    role="group"
    :aria-label="label"
  >
    <button
      v-for="option in options"
      :key="option.value"
      :id="option.id"
      type="button"
      :disabled="option.disabled"
      :aria-pressed="modelValue === option.value"
      :aria-controls="option.controls"
      @click="emit('update:modelValue', option.value)"
    >
      {{ t(option.label) }}
    </button>
    <span class="ranking-mode-indicator" aria-hidden="true"></span>
  </div>
</template>
