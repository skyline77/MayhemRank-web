// 手机（≤700px）英雄详情标题默认 22px，放不下一行时按比例缩小，最低 12px。
import { nextTick, onMounted, onUnmounted, watch, type Ref, type WatchSource } from 'vue'

const baseSize = 22,
  minimumSize = 12

export function useFittedHeading(heading: Ref<HTMLElement | null>, text: WatchSource) {
  let observer: ResizeObserver | undefined,
    frame = 0
  function fit() {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      const el = heading.value
      if (!el) return
      el.style.removeProperty('font-size')
      if (
        window.matchMedia('(max-width:700px)').matches &&
        el.clientWidth > 0 &&
        el.scrollWidth > el.clientWidth
      ) {
        el.style.fontSize =
          Math.max(
            minimumSize,
            Math.floor(((baseSize * el.clientWidth) / el.scrollWidth) * 10) / 10,
          ) + 'px'
      }
    })
  }
  onMounted(() => {
    observer = new ResizeObserver(fit)
    if (heading.value) observer.observe(heading.value)
    fit()
  })
  watch(text, async () => {
    await nextTick()
    fit()
  })
  onUnmounted(() => {
    observer?.disconnect()
    cancelAnimationFrame(frame)
  })
}
