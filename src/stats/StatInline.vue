<script setup lang="ts">
import { t } from '@/i18n/i18n'
import { computed } from 'vue'
import { statDefinitions, type StatKey } from './statTokens'
const props = defineProps<{ stat: StatKey; text?: string; prefix?: string }>()
const definition = computed(() => statDefinitions[props.stat])
const shown = computed(() =>
  props.prefix ? props.text?.slice(props.prefix.length) : (props.text ?? t(definition.value.label)),
)
// 只在显示外文原文（不含本地化属性名）时用浏览器提示给出译名；
// 显示文字已含属性名时提示与正文重复，不再显示。
const hint = computed(() => {
  // 部分语言的标签为“英文 · 本地名”，以最后一段（本地名）判断正文是否已含属性名
  const label = t(definition.value.label)
  const native = label.split(' · ').at(-1)!.toLowerCase()
  return shown.value?.toLowerCase().includes(native) ? undefined : label
})
</script>
<template>
  <span class="stat-inline" :data-stat="stat" :title="hint"
    >{{ prefix
    }}<img
      :src="'/stat-icons/' + definition.icon + '.webp'"
      width="16"
      height="16"
      alt=""
      aria-hidden="true"
    />{{ shown }}</span
  >
</template>
