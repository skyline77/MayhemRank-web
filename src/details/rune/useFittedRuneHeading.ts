// 符文详情标题：按实际换行测量，逐步缩小字号直到完整显示且不超过两行。
// 不截断任何语言的完整符文名；标题区尺寸、文字或字体加载完成时重新测量。
import { nextTick, onMounted, onUnmounted, watch, type Ref, type WatchSource } from 'vue'

export function useFittedRuneHeading(heading: Ref<HTMLElement | null>, sources: WatchSource[]) {
  let observer: ResizeObserver | undefined,
    frame = 0
  function fit() {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      const el = heading.value
      if (!el || !el.clientWidth) return
      el.style.removeProperty('font-size')
      let size = parseFloat(getComputedStyle(el).fontSize)
      while (
        size > 1 &&
        (el.scrollHeight > parseFloat(getComputedStyle(el).lineHeight) * 2 + 1 ||
          el.scrollWidth > el.clientWidth + 1)
      ) {
        size = Math.max(1, size - 0.5)
        el.style.fontSize = size + 'px'
      }
    })
  }
  onMounted(() => {
    observer = new ResizeObserver(fit)
    const container = heading.value?.closest('.build-detail-heading')
    if (container) observer.observe(container)
    fit()
    void document.fonts.ready.then(() => {
      if (heading.value) fit()
    })
  })
  watch(
    sources,
    async () => {
      await nextTick()
      fit()
    },
    { flush: 'post' },
  )
  onUnmounted(() => {
    observer?.disconnect()
    cancelAnimationFrame(frame)
  })
}
