// Preserve a valid scroll range while filtering a tall board into a short one.
// 可选在筛选完成后回到表格底部，避免占位空间留下空白视窗。
export function createBoardScrollFloor(options: { keepBoardVisible?: boolean } = {}) {
  let spacer: HTMLDivElement | undefined,
    frame = 0,
    previousY = 0,
    revision = 0
  function trim() {
    if (!spacer?.isConnected) return
    const height = spacer.getBoundingClientRect().height
    const naturalHeight = document.documentElement.scrollHeight - height
    const needed = Math.max(0, window.scrollY + window.innerHeight + 2 - naturalHeight)
    spacer.style.height = Math.min(height, needed) + 'px'
  }
  function scroll() {
    if (window.scrollY < previousY) {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(trim)
    }
    previousY = window.scrollY
  }
  window.addEventListener('scroll', scroll, { passive: true })
  function settle(root: HTMLElement | null, token: number) {
    if (token !== revision) return
    if (options.keepBoardVisible && root?.isConnected) {
      const bottom = root.getBoundingClientRect().bottom
      if (bottom < window.innerHeight - 1) {
        const top = Math.max(0, window.scrollY + bottom - window.innerHeight)
        cancelAnimationFrame(frame)
        spacer?.remove()
        spacer = undefined
        window.scrollTo({ top, behavior: 'instant' })
        previousY = window.scrollY
        return
      }
    }
    trim()
  }
  async function preserve(root: HTMLElement | null, render: () => Promise<void>) {
    const token = ++revision
    const y = window.scrollY,
      max = document.documentElement.scrollHeight - window.innerHeight
    if (!root || y < 4 || max - y < 4) {
      await render()
      settle(root, token)
      return
    }
    if (!spacer?.isConnected) {
      spacer = document.createElement('div')
      spacer.setAttribute('aria-hidden', 'true')
      spacer.style.cssText = 'height:0;pointer-events:none;overflow-anchor:none;'
    }
    root.after(spacer)
    const anchor = document.documentElement.style.overflowAnchor
    document.documentElement.style.overflowAnchor = 'none'
    // Reserve before Vue changes the DOM, so no intermediate layout clamps scrollY.
    spacer.style.height =
      spacer.getBoundingClientRect().height + root.getBoundingClientRect().height + 'px'
    previousY = y
    try {
      await render()
      settle(root, token)
    } finally {
      document.documentElement.style.overflowAnchor = anchor
    }
  }
  function dispose() {
    ++revision
    cancelAnimationFrame(frame)
    window.removeEventListener('scroll', scroll)
    spacer?.remove()
  }
  return { preserve, dispose }
}
