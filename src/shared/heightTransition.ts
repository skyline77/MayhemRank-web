type HeightTween = {
  to: number
  measureTo?: () => number
  from?: number
  signal: AbortSignal
  onProgress?: (eased: number) => void
  prepareProgress?: (
    eased: number,
    nextHeight: number,
    previousHeight: number,
  ) => (() => void) | undefined
  preserveHeightOnAbort?: boolean
  hideWhenCollapsed?: boolean
  /** 每帧动画时钟最多前进的毫秒数；不传则按实际时间 */
  maxStep?: number
  /** 时长（毫秒）与 ease-out 幂次，默认 220ms、3（cubic）；幂次越高，末段减速越明显 */
  duration?: number
  power?: number
}
// Shared by full detail transitions and smaller disclosures; scrolling stays with callers.
export function animateHeight(panel: HTMLElement, options: HeightTween): Promise<boolean> {
  if (options.signal.aborted || !panel.isConnected) return Promise.resolve(false)
  let from = options.from ?? panel.getBoundingClientRect().height,
    to = options.to
  let paintedHeight = from
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  panel.style.overflow = 'clip'
  panel.style.height = from + 'px'
  return new Promise(resolve => {
    let frame = 0,
      start: number | undefined,
      scrollStart: number | undefined,
      finished = false,
      // 动画时钟：传入 maxStep 时每帧最多前进 maxStep 毫秒。挂载新内容的长帧（实测约 60ms）
      // 若按实际时间计，ease-out 会让高度一帧跳到六成以上；限幅后长帧只让动画稍慢，不跳。
      clock = 0,
      last: number | undefined
    function finish(ok: boolean) {
      if (finished) return
      finished = true
      cancelAnimationFrame(frame)
      options.signal.removeEventListener('abort', abort)
      if (ok || !options.preserveHeightOnAbort) {
        panel.style.removeProperty('height')
        panel.style.removeProperty('overflow')
      }
      resolve(ok)
    }
    const abort = () => finish(false)
    options.signal.addEventListener('abort', abort, { once: true })
    function tick(time: number) {
      if (options.signal.aborted || !panel.isConnected) {
        finish(false)
        return
      }
      clock += last === undefined ? 0 : Math.min(time - last, options.maxStep ?? Infinity)
      last = time
      start ??= clock
      scrollStart ??= clock
      const measured = options.measureTo?.() ?? to
      if (Math.abs(measured - to) > 0.5) {
        // Retarget from the currently painted height; never snap to late-loaded content.
        from = paintedHeight
        to = measured
        start = clock
      }
      const duration = options.duration ?? 220,
        power = options.power ?? 3
      const progress = reduced ? 1 : Math.min(1, (clock - start) / duration)
      const eased = 1 - Math.pow(1 - progress, power)
      const nextHeight = from + (to - from) * eased
      // Retargeting height must not rewind the outer detail's scroll alignment.
      const scrollProgress = reduced ? 1 : Math.min(1, (clock - scrollStart) / duration)
      const scrollEased = 1 - Math.pow(1 - scrollProgress, power)
      const commit = options.prepareProgress?.(scrollEased, nextHeight, paintedHeight)
      panel.style.height = nextHeight + 'px'
      paintedHeight = nextHeight
      commit?.()
      options.onProgress?.(scrollEased)
      // 收起末段剩余不足半像素时直接结束：幂次高时最后约四分之一时长都在 1px 以内，画面像停顿
      if (progress === 1 || (to === 0 && nextHeight < 0.5)) {
        if (to === 0 && options.hideWhenCollapsed) panel.style.visibility = 'hidden'
        finish(true)
      } else frame = requestAnimationFrame(tick)
    }
    if (reduced) tick(0)
    else frame = requestAnimationFrame(tick)
  })
}
