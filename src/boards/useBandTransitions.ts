// 胜率区间标签的过渡：表格重排前记录各区间标签的位置，重排后
// 位置变化的旧标签以副本淡出（120ms），新位置的标签淡入（180ms，有旧标签时延迟 80ms）。
// 详情展开或收起期间（html.is-detail-moving）改为等布局稳定后直接显示，不重复播放。
import { onBeforeUpdate, onUnmounted, onUpdated, type Ref } from 'vue'

export function useBandTransitions(
  tableRoot: Ref<HTMLElement | null>,
  header: Ref<HTMLElement | null>,
  /** 批量布局结束时先重新测量尺寸 */
  measure: () => void,
) {
  let batchingBands = false
  let previousBands = new Map<
    string,
    { top: number; left: number; width: number; height: number; copy: HTMLElement }
  >()
  let bandCopies: HTMLElement[] = []
  let bandAnimations: Animation[] = []
  let fadeNextUpdate = false
  let revealFrame = 0
  function fadeNextBands() {
    cancelAnimationFrame(revealFrame)
    fadeNextUpdate = true
    stopBands()
    // 详情高度与吸顶表头稳定前保持标签可见。
  }
  function revealBands() {
    if (!fadeNextUpdate) return
    cancelAnimationFrame(revealFrame)
    if (document.documentElement.classList.contains('is-detail-moving')) {
      revealFrame = requestAnimationFrame(revealBands)
      return
    }
    // 等待详情移除、滚动补偿与吸顶表头恢复完成。
    revealFrame = requestAnimationFrame(() => {
      revealFrame = requestAnimationFrame(() => {
        if (document.documentElement.classList.contains('is-detail-moving')) {
          revealBands()
          return
        }
        fadeNextUpdate = false
        // 详情过渡已经移动过各行，最终网格更新后不再重复播放淡入或位移。
        previousBands.clear()
      })
    })
  }
  function stopBands() {
    bandAnimations.forEach(animation => animation.cancel())
    bandAnimations = []
    bandCopies.forEach(copy => copy.remove())
    bandCopies = []
  }
  function bandLabels() {
    return Array.from(
      tableRoot.value?.querySelectorAll<HTMLElement>('.board-range-label:not(.band-fade-copy)') ||
        [],
    )
  }
  function captureBands() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      stopBands()
      return
    }
    previousBands = new Map(
      bandLabels().flatMap(band => {
        const label = band.querySelector<HTMLElement>('b')
        if (!label) return []
        const rect = label.getBoundingClientRect(),
          copy = document.createElement('div')
        copy.className = 'board-range-label band-fade-copy'
        copy.setAttribute('aria-hidden', 'true')
        copy.style.setProperty(
          '--range-ink',
          getComputedStyle(band).getPropertyValue('--range-ink'),
        )
        copy.append(label.cloneNode(true))
        return [
          [
            band.dataset.range!,
            {
              top: rect.top + window.scrollY,
              left: rect.left + window.scrollX,
              width: rect.width,
              height: rect.height,
              copy,
            },
          ] as const,
        ]
      }),
    )
    stopBands()
  }
  function beginBandLayout() {
    captureBands()
    batchingBands = true
  }
  function finishBandLayout() {
    batchingBands = false
    measure()
    animateBands()
  }
  onBeforeUpdate(() => {
    if (!batchingBands) captureBands()
  })
  // 组件先在 onUpdated 中测量尺寸，再由此处播放区间动画
  onUpdated(() => {
    if (!batchingBands) animateBands()
  })
  function animateBands() {
    if (document.documentElement.classList.contains('is-detail-moving')) {
      fadeNextBands()
      revealBands()
      return
    }
    if (fadeNextUpdate) {
      revealBands()
      return
    }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const root = tableRoot.value
    if (!root) return
    const bounds = root.getBoundingClientRect(),
      current = new Map(bandLabels().map(band => [band.dataset.range!, band]))
    for (const [key, previous] of previousBands) {
      const label = current.get(key)?.querySelector<HTMLElement>('b')
      if (
        label &&
        Math.abs(label.getBoundingClientRect().top + window.scrollY - previous.top) < 0.5
      )
        continue
      if (
        previous.top + previous.height < window.scrollY ||
        previous.top > window.scrollY + innerHeight
      )
        continue
      const copy = previous.copy
      Object.assign(copy.style, {
        position: 'absolute',
        left: previous.left - window.scrollX - bounds.left + 'px',
        top: previous.top - window.scrollY - bounds.top + 'px',
        width: previous.width + 'px',
        height: previous.height + 'px',
        display: 'grid',
        placeItems: 'center',
        border: '0',
        padding: '0',
        background: 'transparent',
        pointerEvents: 'none',
        zIndex: '2',
        clipPath:
          'inset(' +
          Math.max(
            0,
            (header.value?.getBoundingClientRect().bottom ?? 0) - (previous.top - window.scrollY),
          ) +
          'px 0 0 0)',
      })
      root.append(copy)
      bandCopies.push(copy)
      const animation = copy.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 120,
        easing: 'ease-out',
        fill: 'both',
      })
      bandAnimations.push(animation)
      void animation.finished.then(
        () => copy.remove(),
        () => {},
      )
    }
    for (const [key, band] of current) {
      const label = band.querySelector<HTMLElement>('b')
      if (!label) continue
      const previous = previousBands.get(key),
        rect = label.getBoundingClientRect()
      if (previous && Math.abs(previous.top - rect.top - window.scrollY) < 0.5) continue
      if (rect.bottom < 0 || rect.top > innerHeight) continue
      bandAnimations.push(
        label.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 180,
          delay: previous ? 80 : 0,
          easing: 'ease-out',
          fill: 'both',
        }),
      )
    }
  }
  onUnmounted(() => {
    cancelAnimationFrame(revealFrame)
    stopBands()
  })

  return { fadeNextBands, revealBands, beginBandLayout, finishBandLayout }
}
