<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { t } from './i18n'
const props = defineProps<{ target: HTMLElement | null }>()
const track = ref<HTMLElement | null>(null),
  width = ref(0),
  offset = ref(0),
  maximum = ref(0),
  value = ref(0),
  dragging = ref(false)
let stop = () => {},
  frame = 0,
  grab = 0
function measure() {
  frame = 0
  const el = props.target
  if (!el) return
  maximum.value = Math.max(0, el.scrollWidth - el.clientWidth)
  width.value = Math.max(24, (el.clientWidth * el.clientWidth) / Math.max(1, el.scrollWidth))
  value.value = el.scrollLeft
  offset.value = maximum.value
    ? (el.scrollLeft / maximum.value) * (el.clientWidth - width.value)
    : 0
}
function schedule() {
  if (!frame) frame = requestAnimationFrame(measure)
}
watch(
  () => props.target,
  el => {
    stop()
    if (!el) return
    const resize = new ResizeObserver(schedule),
      mutation = new MutationObserver(schedule)
    resize.observe(el)
    mutation.observe(el, { childList: true, subtree: true })
    el.addEventListener('scroll', schedule, { passive: true })
    stop = () => {
      resize.disconnect()
      mutation.disconnect()
      el.removeEventListener('scroll', schedule)
    }
    schedule()
  },
  { immediate: true, flush: 'post' },
)
function move(event: PointerEvent) {
  if (!dragging.value || !track.value || !props.target) return
  const box = track.value.getBoundingClientRect(),
    available = box.width - width.value
  props.target.scrollLeft =
    Math.max(0, Math.min(1, (event.clientX - box.left - grab) / Math.max(1, available))) *
    maximum.value
}
function start(event: PointerEvent) {
  if (event.button !== 0) return
  event.preventDefault()
  grab = (event.target as HTMLElement).classList.contains('overlay-scroll-thumb')
    ? event.clientX - track.value!.getBoundingClientRect().left - offset.value
    : width.value / 2
  dragging.value = true
  track.value?.setPointerCapture(event.pointerId)
  move(event)
}
function key(event: KeyboardEvent) {
  const el = props.target
  if (!el) return
  const target =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? maximum.value
        : event.key === 'ArrowLeft'
          ? el.scrollLeft - 82
          : event.key === 'ArrowRight'
            ? el.scrollLeft + 82
            : event.key === 'PageDown'
              ? el.scrollLeft + el.clientWidth
              : event.key === 'PageUp'
                ? el.scrollLeft - el.clientWidth
                : null
  if (target === null) return
  event.preventDefault()
  el.scrollLeft = target
}
onUnmounted(() => {
  stop()
  cancelAnimationFrame(frame)
})
</script>
<template>
  <div
    v-show="maximum > 1"
    ref="track"
    class="overlay-scrollbar"
    :class="{ 'is-dragging': dragging }"
    role="scrollbar"
    aria-orientation="horizontal"
    :aria-label="t('，可左右滚动查看全部')"
    :aria-valuemin="0"
    :aria-valuemax="Math.round(maximum)"
    :aria-valuenow="Math.round(value)"
    tabindex="0"
    @pointerdown="start"
    @pointermove="move"
    @pointerup="dragging = false"
    @lostpointercapture="dragging = false"
    @keydown="key"
  >
    <span
      class="overlay-scroll-thumb"
      :style="{ width: width + 'px', transform: 'translateX(' + offset + 'px)' }"
    />
  </div>
</template>
<style scoped>
.overlay-scrollbar {
  position: absolute;
  z-index: 3;
  left: 0;
  right: 0;
  bottom: 0;
  height: 8px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--surface) 80%, transparent);
  opacity: 0;
  pointer-events: none;
  touch-action: none;
  transition: opacity 120ms;
}
.overlay-scroll-thumb {
  position: absolute;
  inset: 1px auto 1px 0;
  border-radius: 4px;
  background: var(--border-strong);
  min-width: 24px;
}
:global(.detail-card-viewport:hover > .overlay-scrollbar),
.overlay-scrollbar:focus-visible,
.overlay-scrollbar.is-dragging {
  opacity: 1;
  pointer-events: auto;
}
.overlay-scrollbar:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
@media (prefers-reduced-motion: reduce) {
  .overlay-scrollbar {
    transition: none;
  }
}
</style>
