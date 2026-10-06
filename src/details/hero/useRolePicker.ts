// 桌面英雄详情的流派按钮行：选中框随选中项移动，横向滚动时同步滚动条与两侧阴影。
import { onMounted, onUnmounted, onUpdated, ref } from 'vue'

export function useRolePicker() {
  const picker = ref<HTMLElement | null>(null)
  const highlight = ref<HTMLElement | null>(null)
  const scrollLeft = ref(0),
    scrollLimit = ref(0),
    scrollThumb = ref(24)
  let highlightFrame = 0,
    highlightReady = false

  function syncHighlight() {
    const row = picker.value,
      box = highlight.value
    if (!row || !box) return
    const selected = row.querySelector<HTMLElement>('.role-choice[aria-current="true"]')
    if (!selected) {
      box.style.opacity = '0'
      return
    }
    // 坐标属于滚动内容，选中框跟随横向滚动，不需要第二个滚动动画，也不影响按钮布局。
    // 首次定位不播放过渡。
    if (!highlightReady) box.style.transition = 'none'
    const selectedBox = selected.getBoundingClientRect(),
      rowBox = row.getBoundingClientRect()
    box.style.transform = `translate(${selectedBox.left - rowBox.left + row.scrollLeft}px,${selectedBox.top - rowBox.top + row.scrollTop}px)`
    box.style.width = selectedBox.width + 'px'
    box.style.height = selectedBox.height + 'px'
    box.style.opacity = '1'
    if (!highlightReady) {
      cancelAnimationFrame(highlightFrame)
      highlightFrame = requestAnimationFrame(() => {
        highlightReady = true
        box.style.removeProperty('transition')
      })
    }
  }

  function syncScroll() {
    const el = picker.value
    if (!el) return
    syncHighlight()
    scrollLimit.value = Math.max(0, el.scrollWidth - el.clientWidth)
    scrollLeft.value = el.scrollLeft
    scrollThumb.value = Math.max(
      24,
      (el.clientWidth * el.clientWidth) / Math.max(1, el.scrollWidth),
    )
  }
  /** 自定义滚动条（range 输入）拖动时滚动按钮行 */
  function moveScroll(event: Event) {
    if (picker.value) picker.value.scrollLeft = Number((event.target as HTMLInputElement).value)
  }

  // 组件更新后不立即测量：详情展开时数据分批到达、组件会连续更新，
  // 立即读取位置会在页面仍在变化时反复强制整页布局。合并到下一帧开始时测量一次。
  let updateFrame = 0
  function scheduleSync() {
    if (updateFrame) return
    updateFrame = requestAnimationFrame(() => {
      updateFrame = 0
      syncScroll()
    })
  }

  let observer: ResizeObserver | undefined
  onMounted(() => {
    // ResizeObserver 在布局完成后回调，此时读取位置没有额外开销，保持直接同步
    observer = new ResizeObserver(syncScroll)
    if (picker.value) observer.observe(picker.value)
    syncScroll()
  })
  onUpdated(scheduleSync)
  onUnmounted(() => {
    observer?.disconnect()
    cancelAnimationFrame(highlightFrame)
    cancelAnimationFrame(updateFrame)
  })

  return { picker, highlight, scrollLeft, scrollLimit, scrollThumb, syncScroll, moveScroll }
}
