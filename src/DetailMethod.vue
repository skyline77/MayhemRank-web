<script setup lang="ts">
import { t, message } from './i18n'
import { nextTick, ref } from 'vue'
const element = ref<HTMLDetailsElement | null>(null)
const trailingSpace = ref(0)
async function reveal(id: string) {
  if (!element.value) return
  element.value.open = true
  trailingSpace.value = 0
  await nextTick()
  const target = Array.from(element.value.querySelectorAll<HTMLElement>('[id]')).find(
    node => node.id === id,
  )
  if (!target) return
  // Near the document end, allow enough scroll distance to align the heading at the top.
  const targetTop = window.scrollY + target.getBoundingClientRect().top
  trailingSpace.value = Math.max(
    0,
    Math.ceil(window.innerHeight - (document.documentElement.scrollHeight - targetTop)),
  )
  await nextTick()
  target.focus({ preventScroll: true })
  target.scrollIntoView({
    block: 'start',
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
  })
}
defineExpose({ reveal })
</script>
<template>
  <details
    ref="element"
    class="build-detail-method"
    :style="trailingSpace ? { paddingBottom: trailingSpace + 'px' } : undefined"
    @toggle="!element?.open && (trailingSpace = 0)"
  >
    <summary>{{ t('统计口径与数据范围') }}</summary>
    <slot />
  </details>
</template>
<style>
.build-detail .detail-note-link {
  border: 0;
  background: none;
  color: var(--accent-text);
  padding: 4px 6px;
  min-height: 32px;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.build-detail .detail-note-link:focus-visible,
.build-detail-method summary:focus-visible,
.build-detail-method [tabindex='-1']:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
.build-detail-method a {
  color: var(--accent-text);
  text-underline-offset: 3px;
}
.build-detail-method h3 {
  font-size: 12px;
  margin: 16px 0 8px;
  color: var(--text);
}
.build-detail-method .rune-chart-data {
  overflow-x: auto;
}
</style>
