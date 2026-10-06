// 分步显示统计行：数据就绪后，从下一帧开始每帧换出一行真实卡片，其余行保持加载占位。
// 即使数据在组件挂载前就已就绪（提前请求或缓存），挂载那一帧也只渲染占位。
// 占位与卡片同高，详情高度和最终画面都不变；只是把一帧内生成全部卡片的工作
// 分摊到多帧，减少展开动画中的长时间停顿。
//
// 传入 root 且其返回容器时，还会等到该行接近视口（上下 300px 内）才换出：
// 容器内的 .build-detail-row 按文档顺序对应行序号，由 IntersectionObserver 观察，
// 屏幕外的行在用户滚动到之前不生成卡片。root 返回 null 时不做视口判断。
import { nextTick, onUnmounted, ref, watch } from 'vue'

export function useStagedRows(
  ready: () => boolean,
  total: number,
  root?: () => HTMLElement | null,
) {
  const shown = ref(ready() ? total : 0)
  const near = new Set<number>()
  let rows: HTMLElement[] = []
  let frame = 0,
    waiting = false,
    observing = false
  const isNear = (index: number) => !observing || near.has(index)

  function revealNext() {
    frame = requestAnimationFrame(() => {
      frame = 0
      if (!isNear(shown.value)) {
        waiting = true
        return
      }
      shown.value++
      if (shown.value < total) revealNext()
    })
  }

  const observer =
    root &&
    new IntersectionObserver(
      entries => {
        for (const entry of entries)
          if (entry.isIntersecting) near.add(rows.indexOf(entry.target as HTMLElement))
        if (waiting && isNear(shown.value)) {
          waiting = false
          revealNext()
        }
      },
      { rootMargin: '300px 0px' },
    )

  let generation = 0
  watch(ready, async value => {
    const current = ++generation
    cancelAnimationFrame(frame)
    frame = 0
    waiting = false
    shown.value = 0
    observer?.disconnect()
    near.clear()
    observing = false
    if (!value) return
    if (observer && root) {
      await nextTick()
      // 等待期间状态又变化时，交给最新一次处理
      if (current !== generation) return
      const container = root()
      rows = container
        ? Array.from(container.querySelectorAll<HTMLElement>('.build-detail-row'))
        : []
      observing = rows.length === total
      if (observing) for (const row of rows) observer.observe(row)
    }
    revealNext()
  })
  onUnmounted(() => {
    cancelAnimationFrame(frame)
    observer?.disconnect()
  })
  /** 第 index 行是否仍显示加载占位 */
  return (index: number) => index >= shown.value
}
