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
      finished = false
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
      start ??= time
      scrollStart ??= time
      const measured = options.measureTo?.() ?? to
      if (Math.abs(measured - to) > 0.5) {
        // Retarget from the currently painted height; never snap to late-loaded content.
        from = paintedHeight
        to = measured
        start = time
      }
      const progress = reduced ? 1 : Math.min(1, (time - start) / 220)
      const eased = 1 - Math.pow(1 - progress, 3)
      const nextHeight = from + (to - from) * eased
      // Retargeting height must not rewind the outer detail's scroll alignment.
      const scrollProgress = reduced ? 1 : Math.min(1, (time - scrollStart) / 220)
      const scrollEased = 1 - Math.pow(1 - scrollProgress, 3)
      const commit = options.prepareProgress?.(scrollEased, nextHeight, paintedHeight)
      panel.style.height = nextHeight + 'px'
      paintedHeight = nextHeight
      commit?.()
      options.onProgress?.(scrollEased)
      if (progress === 1) {
        if (to === 0 && options.hideWhenCollapsed) panel.style.visibility = 'hidden'
        finish(true)
      } else frame = requestAnimationFrame(tick)
    }
    if (reduced) tick(0)
    else frame = requestAnimationFrame(tick)
  })
}
