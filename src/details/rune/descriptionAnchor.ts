// 深链接带 #rune-description 时，把符文详情中的“符文说明”对齐到导航与详情标题下方。
// 异步内容改变高度时持续重新对齐，用户一旦滚动、触摸或按键就停止跟随。
import { navigationInset } from '@/app/navigationLayout'

const userInputs = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const

export function createDescriptionAnchor() {
  let stop = () => {}

  function anchor(panel: HTMLElement | null) {
    stop()
    const section = panel?.querySelector<HTMLElement>('.rune-description')
    if (!panel || !section) return
    let frame = 0
    const align = () => {
      const header = panel.querySelector<HTMLElement>('.build-detail-heading')
      window.scrollBy({
        top:
          section.getBoundingClientRect().top - navigationInset() - (header?.offsetHeight || 0) - 9,
        behavior: 'instant',
      })
    }
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(align)
    })
    stop = () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      for (const event of userInputs) window.removeEventListener(event, stop, true)
    }
    for (const event of userInputs)
      window.addEventListener(event, stop, { capture: true, passive: true })
    observer.observe(panel)
    align()
  }

  return { anchor, stop: () => stop() }
}
