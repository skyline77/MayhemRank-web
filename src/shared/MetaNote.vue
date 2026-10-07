<script setup lang="ts">
// 次级信息（数据来源、对比基准、版本范围、译文说明等）收纳为 ℹ 图标：
// 鼠标悬停时显示，点击图标（含手机触摸）切换固定显示。文字在图标旁展开，
// 不另开浮层，避免在提示框等可滚动容器中被裁掉。图标的无障碍名称即完整文字。
import { ref } from 'vue'

defineProps<{ text: string }>()
const pinned = ref(false)
const hovered = ref(false)

function enter(event: PointerEvent) {
  if (event.pointerType === 'mouse') hovered.value = true
}
function leave(event: PointerEvent) {
  if (event.pointerType === 'mouse') hovered.value = false
}
function toggle() {
  pinned.value = !pinned.value
  if (!pinned.value) hovered.value = false
}
</script>
<template>
  <span
    class="meta-note"
    :class="{ 'is-open': pinned || hovered }"
    @pointerenter="enter"
    @pointerleave="leave"
  >
    <button
      type="button"
      class="meta-note-icon"
      :aria-label="text"
      :aria-expanded="pinned"
      @click.stop="toggle"
    >
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
        <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.4" />
        <rect x="7.25" y="7" width="1.5" height="5" rx="0.5" fill="currentColor" />
        <circle cx="8" cy="4.6" r="0.95" fill="currentColor" />
      </svg>
    </button>
    <span v-if="pinned || hovered" class="meta-note-text" aria-hidden="true">{{ text }}</span>
  </span>
</template>
<style>
.meta-note {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  vertical-align: middle;
  color: var(--muted);
  font-size: 11px;
  font-weight: 400;
  line-height: 1.4;
}
.meta-note-icon {
  display: inline-grid;
  place-items: center;
  flex: none;
  width: 18px;
  height: 18px;
  margin: -3px 0;
  padding: 0;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  opacity: 0.75;
  cursor: help;
  transition: opacity 120ms ease;
}
.meta-note.is-open .meta-note-icon,
.meta-note-icon:hover {
  opacity: 1;
  color: var(--text);
}
.meta-note-icon:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.meta-note-text {
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>
