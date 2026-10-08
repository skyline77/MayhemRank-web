import { detailHeaderMotion } from './detailHeaderMotion'
import { animateHeight } from '@/shared/heightTransition'
import { navigationInset } from '@/app/navigationLayout'

export function scrollDetailToTop(panel: HTMLElement | null, behavior?: ScrollBehavior) {
  if (!panel?.isConnected) return
  window.scrollBy({
    top: panel.getBoundingClientRect().top - navigationInset(),
    behavior:
      behavior ??
      (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'),
  })
}

type DetailTransition = {
  panel: () => HTMLElement | null
  anchor: () => HTMLElement | null
  render: () => Promise<void>
  opening: boolean
  scrollAfterOpen?: boolean
  closeInset?: number
}
let active: AbortController | null = null
let stopArrival = () => {}
export function cancelDetailTransition() {
  stopArrival()
  active?.abort()
}
function followInitialLayout(panel: HTMLElement) {
  if (typeof ResizeObserver === 'undefined') return
  let frame = 0,
    done = false
  const align = () => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      if (!done && panel.isConnected) scrollDetailToTop(panel, 'instant')
    })
  }
  const observer = new ResizeObserver(align)
  const table = panel.closest('.board-table')
  observer.observe(table || panel)
  observer.observe(panel)
  const cleanup = () => {
    if (done) return
    done = true
    observer.disconnect()
    cancelAnimationFrame(frame)
    clearTimeout(timer)
    window.removeEventListener('wheel', cleanup)
    window.removeEventListener('touchstart', cleanup)
    window.removeEventListener('pointerdown', cleanup)
    window.removeEventListener('keydown', cleanup)
  }
  const timer = setTimeout(cleanup, 10000)
  for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown'])
    window.addEventListener(event, cleanup, { passive: true })
  stopArrival = cleanup
  void document.fonts?.ready.then(() => {
    if (!done) align()
  })
  align()
}

// Link navigation mounts the full panel and aligns it in the same render turn.
// No height tween or animation frame exposes the trip through the board.
export async function revealDetailImmediately(
  panel: () => HTMLElement | null,
  render: () => Promise<void>,
) {
  cancelDetailTransition()
  const controller = new AbortController()
  active = controller
  const root = document.documentElement
  root.classList.add('is-detail-moving')
  try {
    await render()
    const target = panel()
    if (controller.signal.aborted || !target?.isConnected) return false
    scrollDetailToTop(target, 'instant')
    followInitialLayout(target)
    return true
  } finally {
    if (active === controller) {
      active = null
      root.classList.remove('is-detail-moving')
    }
  }
}

// Hero-to-hero selection replaces the old panel before paint, aligns the new
// panel immediately, then reveals its heading ahead of the card content.
export async function fadeDetailAtTop(
  panel: () => HTMLElement | null,
  render: () => Promise<void>,
) {
  cancelDetailTransition()
  const controller = new AbortController(),
    signal = controller.signal
  active = controller
  const root = document.documentElement
  root.classList.add('is-detail-moving')
  const animations: Animation[] = []
  const cancel = () => animations.forEach(animation => animation.cancel())
  signal.addEventListener('abort', cancel, { once: true })
  try {
    await render()
    const target = panel()
    if (signal.aborted || !target?.isConnected) return false
    scrollDetailToTop(target, 'instant')
    if (window.matchMedia('(max-width:700px)').matches) followInitialLayout(target)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true
    for (const element of Array.from(target.querySelectorAll<HTMLElement>('.build-detail > *'))) {
      const heading = element.classList.contains('build-detail-heading')
      animations.push(
        element.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: heading ? 140 : 380,
          delay: heading ? 0 : 90,
          easing: 'ease-out',
          fill: 'both',
        }),
      )
    }
    await Promise.all(animations.map(animation => animation.finished.catch(() => {})))
    return !signal.aborted
  } finally {
    cancel()
    signal.removeEventListener('abort', cancel)
    if (active === controller) {
      active = null
      root.classList.remove('is-detail-moving')
    }
  }
}

/** 动画参数。openingMaxStep：展开时动画时钟每帧最多前进的毫秒数；测试以粗粒度时间推进时设为 Infinity */
export const motionTuning = { openingMaxStep: 17 }

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

function scrollExpandedDetail(
  panel: HTMLElement,
  signal: AbortSignal,
  follow: () => boolean,
  fromRest = false,
) {
  const fromTop = panel.getBoundingClientRect().top
  const targetTop = navigationInset()
  // Moving to an earlier row needs a gentler pace; preserve the existing
  // downward motion and the immediate sticky-header handoff.
  const upward = fromTop < targetTop
  // fromRest：首次展开结束后再滚动，详情此时静止；ease-out 会让滚动以最高速度突然开始，
  // 衔接处像一下顿挫，改用缓入缓出从静止起步，时长相应放宽。切换详情等其他滚动保持原曲线。
  const duration = fromRest
    ? Math.max(260, Math.abs(fromTop - targetTop) / 1.5)
    : Math.max(upward ? 240 : 120, Math.abs(fromTop - targetTop) / (upward ? 1 : 2))
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return new Promise<boolean>(resolve => {
    let frame = 0,
      start: number | undefined,
      finished = false
    function finish(ok: boolean) {
      if (finished) return
      finished = true
      cancelAnimationFrame(frame)
      signal.removeEventListener('abort', abort)
      resolve(ok)
    }
    const abort = () => finish(false)
    signal.addEventListener('abort', abort, { once: true })
    function tick(time: number) {
      if (signal.aborted || !panel.isConnected) {
        finish(false)
        return
      }
      if (!follow()) {
        finish(true)
        return
      }
      start ??= time
      const progress = reduced ? 1 : Math.min(1, (time - start) / duration)
      const delta =
        panel.getBoundingClientRect().top -
        (targetTop +
          (fromTop - targetTop) * (1 - (fromRest ? easeInOut(progress) : easeOut(progress))))
      // Late layout changes must not reverse an in-progress arrival scroll.
      // Wait for the easing path to catch up instead of visibly bouncing back.
      if (Math.abs(delta) > 0.1 && (upward ? delta < 0 : delta > 0))
        window.scrollBy({ top: delta, behavior: 'instant' })
      if (progress === 1) finish(true)
      else frame = requestAnimationFrame(tick)
    }
    if (reduced) tick(0)
    else frame = requestAnimationFrame(tick)
  })
}

// One height tween owns scrolling too: never race native smooth scrolling
// against a moving target. Only the wrapper and one anchor are measured.
export async function transitionDetail(options: DetailTransition): Promise<boolean> {
  const anchorTop = options.anchor()?.getBoundingClientRect().top
  cancelDetailTransition()
  const controller = new AbortController(),
    signal = controller.signal
  active = controller
  const root = document.documentElement
  const headerMotion = detailHeaderMotion(options.anchor() || options.panel(), options.opening)
  root.classList.add('is-detail-moving')
  let follow = true
  const interrupt = () => {
    follow = false
  }
  const onKey = (event: KeyboardEvent) => {
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key))
      interrupt()
  }
  window.addEventListener('wheel', interrupt, { passive: true })
  window.addEventListener('touchstart', interrupt, { passive: true })
  window.addEventListener('keydown', onKey)
  function align(element: HTMLElement | null, top: number | undefined) {
    if (!follow || signal.aborted || !element?.isConnected || top === undefined) return
    const delta = element.getBoundingClientRect().top - top
    if (Math.abs(delta) > 0.1) window.scrollBy({ top: delta, behavior: 'instant' })
  }
  function tween(
    panel: HTMLElement,
    to: number,
    anchor: () => HTMLElement | null,
    fromTop: number | undefined,
    toTop = fromTop,
    measureTo?: () => number,
    maxStep?: number,
  ) {
    const initialAnchor = anchor(),
      panelRect = panel.getBoundingClientRect()
    const below =
      !!initialAnchor &&
      initialAnchor !== panel &&
      initialAnchor.getBoundingClientRect().top >= panelRect.top + panelRect.height - 0.5
    return animateHeight(panel, {
      to,
      measureTo,
      signal,
      hideWhenCollapsed: true,
      maxStep,
      onProgress: headerMotion.progress,
      prepareProgress: (eased, nextHeight, previousHeight) => {
        const element = anchor()
        if (!follow || signal.aborted || !element?.isConnected || fromTop === undefined) return
        // Read before height changes; predict the flow displacement of a lower anchor.
        const desired = fromTop + ((toTop ?? fromTop) - fromTop) * eased
        const delta =
          element.getBoundingClientRect().top + (below ? nextHeight - previousHeight : 0) - desired
        return () => {
          if (follow && !signal.aborted && Math.abs(delta) > 0.1)
            window.scrollBy({ top: delta, behavior: 'instant' })
        }
      },
    })
  }
  try {
    // Aborting a prior animation restores its natural height before this correction.
    align(options.anchor(), anchorTop)
    const old = options.panel()
    const closeTop =
      !options.opening && options.closeInset !== undefined && anchorTop !== undefined
        ? Math.max(
            options.closeInset + navigationInset(),
            Math.min(window.innerHeight - 80, anchorTop),
          )
        : anchorTop
    if (old && !(await tween(old, 0, options.anchor, anchorTop, closeTop))) return false
    if (signal.aborted) return false
    await options.render()
    if (signal.aborted) return false
    const panel = options.panel()
    if (options.opening && panel) {
      panel.style.removeProperty('visibility')
      const height = panel.getBoundingClientRect().height
      const content =
        panel.querySelector<HTMLElement>(':scope > [role=cell]') || panel.firstElementChild
      const inset = content ? height - content.getBoundingClientRect().height : 0
      panel.style.height = '0px'
      panel.style.overflow = 'clip'
      align(options.anchor(), anchorTop)
      const top = panel.getBoundingClientRect().top
      let targetHeight = height
      const sizeObserver =
        content && typeof ResizeObserver !== 'undefined'
          ? new ResizeObserver(() => {
              targetHeight = content.getBoundingClientRect().height + inset
            })
          : undefined
      if (content) sizeObserver?.observe(content)
      let expanded = false
      try {
        expanded = await tween(
          panel,
          height,
          () => panel,
          top,
          options.scrollAfterOpen ? top : navigationInset(),
          () => targetHeight,
          // 展开刚挂载内容时第一帧很长，限幅避免高度一帧跳过大半（见 animateHeight）
          motionTuning.openingMaxStep,
        )
      } finally {
        sizeObserver?.disconnect()
      }
      if (!expanded || signal.aborted) return false
      if (options.scrollAfterOpen) {
        const arrived = await scrollExpandedDetail(panel, signal, () => follow, true)
        if (arrived && follow && !signal.aborted && window.matchMedia('(max-width:700px)').matches)
          followInitialLayout(panel)
        return arrived
      }
      return true
    }
    align(options.anchor(), closeTop)
    return true
  } finally {
    headerMotion.dispose()
    window.removeEventListener('wheel', interrupt)
    window.removeEventListener('touchstart', interrupt)
    window.removeEventListener('keydown', onKey)
    if (active === controller) {
      active = null
      root.classList.remove('is-detail-moving')
    }
  }
}

type DetailHandoff = {
  previous: () => HTMLElement | null
  target: () => HTMLElement | null
  prepare: () => Promise<void>
  finish: () => Promise<void>
  sameRow: boolean
  /** 被点击的卡片。新详情插在旧详情上方时改为固定它，而不是固定旧详情 */
  anchor?: () => HTMLElement | null
}

// Keep both rows mounted until the destination is reached. Inserting above the
// current detail gets one compensation; retirement uses the same height/scroll
// transition as Esc, anchored to the destination rather than the old portrait.
export async function handoffDetail(options: DetailHandoff): Promise<boolean> {
  const previous = options.previous()
  const previousTop = previous?.getBoundingClientRect().top
  const anchor = options.anchor?.() ?? null
  const anchorTop = anchor?.getBoundingClientRect().top
  let arriving: HTMLElement | null = null
  cancelDetailTransition()
  const controller = new AbortController(),
    signal = controller.signal
  active = controller
  const root = document.documentElement
  root.classList.add('is-detail-moving')
  const interrupt = () => controller.abort()
  const onKey = (event: KeyboardEvent) => {
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key))
      interrupt()
  }
  window.addEventListener('wheel', interrupt, { passive: true })
  window.addEventListener('touchstart', interrupt, { passive: true })
  window.addEventListener('keydown', onKey)
  function preserve(element: HTMLElement | null, top: number | undefined) {
    if (signal.aborted || !element?.isConnected || top === undefined) return
    const delta = element.getBoundingClientRect().top - top
    if (Math.abs(delta) > 0.1) window.scrollBy({ top: delta, behavior: 'instant' })
  }
  try {
    await options.prepare()
    if (signal.aborted) return false
    const destination = options.target()
    // 新详情在旧详情上方：固定旧详情会让被点击的卡片连同上方内容一帧内被推出视口，
    // 再滚回来，看起来像闪烁。改为固定被点击的卡片，新详情在它下方展开，旧详情被推到下方。
    const insertedAbove =
      !!anchor?.isConnected &&
      !!previous &&
      typeof destination?.compareDocumentPosition === 'function' &&
      // 4 = Node.DOCUMENT_POSITION_FOLLOWING（测试环境没有 Node 全局对象）
      !!(destination.compareDocumentPosition(previous) & 4)
    if (insertedAbove) preserve(anchor, anchorTop)
    else preserve(previous || null, previousTop)
    if (!destination?.isConnected) return false
    if (!options.sameRow && destination.getBoundingClientRect().top < navigationInset()) {
      // An upper destination is already above the viewport when mounted. Keep its
      // heading in normal flow until arrival, rather than pinning it for one frame.
      arriving = destination
      arriving.setAttribute?.('data-detail-arriving', '')
    }
    if (!options.sameRow) {
      const arrived = await scrollExpandedDetail(destination, signal, () => true)
      if (!arrived || signal.aborted) return false
      arriving?.removeAttribute?.('data-detail-arriving')
      arriving = null
    }
    if (!options.sameRow && previous?.isConnected && previous !== destination) {
      // Transfer animation ownership to the shared close path. It collapses the
      // old shell before finish unmounts it and preserves the new detail each frame.
      return await transitionDetail({
        panel: () => previous,
        anchor: () => destination,
        opening: false,
        render: options.finish,
      })
    }
    // A same-row selection reuses its shell; there is no old row to destroy.
    const top = destination.getBoundingClientRect().top
    await options.finish()
    if (signal.aborted) return false
    preserve(destination, top)
    return true
  } finally {
    arriving?.removeAttribute?.('data-detail-arriving')
    window.removeEventListener('wheel', interrupt)
    window.removeEventListener('touchstart', interrupt)
    window.removeEventListener('keydown', onKey)
    if (active === controller) {
      active = null
      root.classList.remove('is-detail-moving')
    }
  }
}

// Apply a data-driven relocation in one Vue render, preserving the current
// viewport offset rather than scrolling the detail to the top again.
export async function preserveDetailPosition(
  panel: () => HTMLElement | null,
  render: () => Promise<void>,
) {
  cancelDetailTransition()
  const controller = new AbortController()
  active = controller
  const root = document.documentElement
  const before = panel()
  const top = before?.getBoundingClientRect().top
  const restorePicker =
    !!before?.contains(document.activeElement) &&
    document.activeElement?.matches('select[aria-label="统计版本"]')
  root.classList.add('is-detail-moving')
  try {
    await render()
    const after = panel()
    if (controller.signal.aborted || !after?.isConnected || top === undefined) return
    const delta = after.getBoundingClientRect().top - top
    if (Math.abs(delta) > 0.1) window.scrollBy({ top: delta, behavior: 'instant' })
    if (restorePicker)
      after
        .querySelector<HTMLSelectElement>('select[aria-label="统计版本"]')
        ?.focus({ preventScroll: true })
  } finally {
    if (active === controller) {
      active = null
      root.classList.remove('is-detail-moving')
    }
  }
}

// Search replaces one mounted slot; callers choose viewport preservation or
// the same top-aligned reveal used by portrait selection.
export async function replaceDetailEntry<T>(options: {
  entry: T
  key: string
  loading: boolean
  selected: { value: T | null }
  openPanels: { value: Record<string, T> }
  panel: () => HTMLElement | null
  beforeReplace?: () => void
  afterRender: () => Promise<unknown>
  transition?: (panel: () => HTMLElement | null, render: () => Promise<void>) => Promise<unknown>
}): Promise<boolean> {
  const { entry, key, selected, openPanels } = options
  if (options.loading || !openPanels.value[key]) return false
  await (options.transition ?? preserveDetailPosition)(options.panel, async () => {
    options.beforeReplace?.()
    selected.value = entry
    openPanels.value = { [key]: entry }
    await options.afterRender()
  })
  return true
}
