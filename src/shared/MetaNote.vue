<script setup lang="ts">
// 次级信息（数据来源、对比基准、版本范围、译文说明等）收纳为 ℹ 图标：
// 鼠标悬停时显示，点击图标（含手机触摸）切换固定显示。
// 文字以浮层显示在图标上方，不占排版位置：若在原位展开，图标会被挤离鼠标，
// 悬停与离开交替触发造成抖动。浮层挂到 body 并按视口定位，不会被提示框等滚动容器裁掉。
// 图标的无障碍名称即完整文字。
import { nextTick, onUnmounted, ref } from 'vue'

defineProps<{ text: string }>()
const pinned = ref(false)
const hovered = ref(false)
const icon = ref<HTMLElement | null>(null)
const bubble = ref<HTMLElement | null>(null)
const position = ref({ left: 0, top: 0 })
// 定位完成前隐藏，避免浮层在旧位置闪一帧
const placed = ref(false)

const MARGIN = 8
async function place() {
  await nextTick()
  const anchor = icon.value?.getBoundingClientRect()
  const box = bubble.value?.getBoundingClientRect()
  if (!anchor || !box) return
  const left = Math.min(
    Math.max(MARGIN, anchor.left + anchor.width / 2 - box.width / 2),
    window.innerWidth - box.width - MARGIN,
  )
  // 默认在上方；上方放不下时放到下方
  const above = anchor.top - box.height - 6
  const top = above >= MARGIN ? above : anchor.bottom + 6
  position.value = { left, top }
  placed.value = true
}
function show() {
  placed.value = false
  void place()
}
function close() {
  pinned.value = false
  hovered.value = false
}
function enter(event: PointerEvent) {
  if (event.pointerType !== 'mouse') return
  hovered.value = true
  show()
}
function leave(event: PointerEvent) {
  if (event.pointerType === 'mouse') hovered.value = false
}
function toggle() {
  pinned.value = !pinned.value
  if (pinned.value) {
    show()
    window.addEventListener('scroll', close, { capture: true, once: true, passive: true })
  } else hovered.value = false
}
onUnmounted(() => window.removeEventListener('scroll', close, { capture: true }))
</script>
<template>
  <span class="meta-note" :class="{ 'is-open': pinned || hovered }">
    <button
      ref="icon"
      type="button"
      class="meta-note-icon"
      :aria-label="text"
      :aria-expanded="pinned"
      @pointerenter="enter"
      @pointerleave="leave"
      @click.stop="toggle"
    >
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
        <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.4" />
        <rect x="7.25" y="7" width="1.5" height="5" rx="0.5" fill="currentColor" />
        <circle cx="8" cy="4.6" r="0.95" fill="currentColor" />
      </svg>
    </button>
    <Teleport to="body">
      <span
        v-if="pinned || hovered"
        ref="bubble"
        class="meta-note-bubble"
        aria-hidden="true"
        :style="{
          left: position.left + 'px',
          top: position.top + 'px',
          visibility: placed ? 'visible' : 'hidden',
        }"
        >{{ text }}</span
      >
    </Teleport>
  </span>
</template>
<style>
.meta-note {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
  color: var(--muted);
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
/* 浮层不接收指针，鼠标经过时不会触发图标的离开 */
.meta-note-bubble {
  position: fixed;
  z-index: 1000;
  max-width: min(280px, calc(100vw - 16px));
  padding: 6px 8px;
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  background: var(--card);
  box-shadow: var(--shadow);
  color: var(--text);
  font-size: 12px;
  font-weight: 400;
  line-height: 1.5;
  overflow-wrap: anywhere;
  pointer-events: none;
}
</style>
