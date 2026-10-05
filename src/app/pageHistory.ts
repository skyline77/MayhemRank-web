// Per-history-entry UI state: returning to a page restores its own view, not another tab's.
const stateKey = 'teamPageViewV1'
type SavedView = {
  url: string
  sections: Record<string, unknown>
  x: number
  y: number
  anchor?: { id: string; top: number }
  rails: { panel: string; label: string; left: number }[]
}
const navigation = performance.getEntriesByType('navigation')[0] as
  PerformanceNavigationTiming | undefined
const candidate = history.state?.[stateKey] as SavedView | undefined
let returning =
  navigation?.type === 'back_forward' && candidate?.url === location.href ? candidate : undefined
let currentUrl = location.href
const views = new Map<string, SavedView>()
const sections = new Map<string, () => unknown>()
const restored = new Set<string>()
export function readHistorySection<T>(key: string): T | undefined {
  if (restored.has(key)) return undefined
  restored.add(key)
  return returning?.sections[key] as T | undefined
}
export function registerHistorySection(key: string, read: () => unknown) {
  sections.set(key, read)
  return () => {
    if (sections.get(key) === read) sections.delete(key)
  }
}
export function saveView() {
  const panels = Array.from(document.querySelectorAll<HTMLElement>('.build-detail[id]'))
  const anchor = panels.find(panel => {
    const box = panel.getBoundingClientRect()
    return box.bottom > 0 && box.top < innerHeight
  })
  const value: SavedView = {
    url: currentUrl,
    sections: Object.fromEntries([...sections].map(([key, read]) => [key, read()])),
    x: scrollX,
    y: scrollY,
    anchor: anchor ? { id: anchor.id, top: anchor.getBoundingClientRect().top } : undefined,
    rails: panels.flatMap(panel =>
      Array.from(panel.querySelectorAll<HTMLElement>('.build-detail-cards[aria-label]')).map(
        rail => ({
          panel: panel.id,
          label: rail.getAttribute('aria-label')!,
          left: rail.scrollLeft,
        }),
      ),
    ),
  }
  views.set(currentUrl, value)
  try {
    if (currentUrl === location.href)
      history.replaceState({ ...history.state, [stateKey]: value }, '')
  } catch {
    /* Navigation remains usable if browser storage is unavailable. */
  }
}
export function installPageHistory() {
  // SPA 导航由本模块恢复滚动，避免浏览器在异步详情挂载前恢复并截断位置。
  // 即使本次恢复已结束或被用户取消，也继续保持 manual，供后续单页导航使用。
  history.scrollRestoration = 'manual'
  window.addEventListener('pagehide', saveView)
  let stopRestore = () => {}
  if (returning) {
    let frame = 0,
      settling = false,
      stopped = false
    const deadline = window.setTimeout(() => finish(), 20000)
    const observer = new MutationObserver(check)
    const cancel = () => finish()
    function finish() {
      if (stopped) return
      stopped = true
      observer.disconnect()
      cancelAnimationFrame(frame)
      clearTimeout(deadline)
      for (const event of ['pointerdown', 'wheel', 'touchstart', 'keydown'])
        window.removeEventListener(event, cancel, true)
    }
    function apply() {
      if (stopped) return
      const anchor = returning!.anchor && document.getElementById(returning!.anchor.id)
      const y = anchor
        ? scrollY + anchor.getBoundingClientRect().top - returning!.anchor!.top
        : returning!.y
      window.scrollTo({ left: returning!.x, top: y, behavior: 'instant' })
      for (const saved of returning!.rails) {
        const panel = document.getElementById(saved.panel)
        const rail = Array.from(
          panel?.querySelectorAll<HTMLElement>('.build-detail-cards[aria-label]') || [],
        ).find(el => el.getAttribute('aria-label') === saved.label)
        if (rail) rail.scrollLeft = saved.left
      }
    }
    async function check() {
      if (stopped || settling || !document.querySelector('main')) return
      if (document.querySelector('main[aria-busy="true"],main [aria-busy="true"]')) return
      if (returning!.anchor && !document.getElementById(returning!.anchor.id)) return
      settling = true
      await document.fonts.ready
      let frames = 0
      function settle() {
        if (stopped) return
        apply()
        if (++frames < 20) frame = requestAnimationFrame(settle)
        else finish()
      }
      frame = requestAnimationFrame(settle)
    }
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-busy'],
    })
    for (const event of ['pointerdown', 'wheel', 'touchstart', 'keydown'])
      window.addEventListener(event, cancel, { capture: true, passive: true })
    void check()
    stopRestore = finish
  }
  return () => {
    window.removeEventListener('pagehide', saveView)
    stopRestore()
  }
}

export function preparePageHistory(restore: boolean) {
  saveView()
  const candidate = views.get(location.href) || (history.state?.[stateKey] as SavedView | undefined)
  currentUrl = location.href
  returning = restore && candidate?.url === location.href ? candidate : undefined
  restored.clear()
}

// Record detail navigation without remounting the current board.
export function pushDetailHistory(href: string) {
  const target = new URL(href, location.href)
  const url = target.href
  if (url === location.href) return
  saveView()
  history.pushState({}, '', url)
  currentUrl = url
}
