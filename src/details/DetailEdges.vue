<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { scheduleDetailMeasurement, cancelDetailMeasurement } from './detailMeasurements'
const edge = ref<HTMLElement | null>(null)
let observer: ResizeObserver | undefined
function measure() {
  const element = edge.value,
    row = element?.parentElement
  if (!element || !row) return
  // 两条金线之间的可见空间；阴影保持原来的渐变尺度，只裁切越界部分。
  const space = Math.max(
    0,
    row.getBoundingClientRect().bottom - 1 - element.getBoundingClientRect().bottom,
  )
  return () => {
    row.style.setProperty('--detail-bottom-shadow-height', Math.min(16, space) + 'px')
    element.style.setProperty('--detail-edge-height', Math.min(16, space) + 'px')
  }
}
function schedule() {
  scheduleDetailMeasurement(measure)
}
onMounted(() => {
  observer = new ResizeObserver(schedule)
  if (edge.value?.parentElement) observer.observe(edge.value.parentElement)
  document.addEventListener('scroll', schedule, { capture: true, passive: true })
  window.addEventListener('resize', schedule, { passive: true })
  schedule()
})
onUnmounted(() => {
  observer?.disconnect()
  document.removeEventListener('scroll', schedule, true)
  window.removeEventListener('resize', schedule)
  cancelDetailMeasurement(measure)
})
</script>
<template><div ref="edge" class="board-detail-gold-edge" aria-hidden="true"></div></template>
<style scoped>
.board-detail-gold-edge {
  --detail-edge-height: 0px;
}
.board-detail-gold-edge::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: var(--detail-edge-height);
  pointer-events: none;
  background-size: 100% 16px;
  background-repeat: no-repeat;
}
.board-detail-gold-edge::after {
  top: 1px;
  background-image: linear-gradient(to bottom, var(--detail-edge-shadow), transparent);
}
</style>
