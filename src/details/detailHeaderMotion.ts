import { navigationInset } from '@/app/navigationLayout'

// Keep a clipped copy at the nav edge while the real header changes sticky state.
export function detailHeaderMotion(anchor: HTMLElement | null, opening: boolean) {
  const table = anchor?.closest?.('.board-table')
  const header = table?.querySelector<HTMLElement>('.board-sticky-header')
  const noop = { progress: (_value: number) => {}, dispose: () => {} }
  if (!header || !table || window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    return noop
  const rect = header.getBoundingClientRect(),
    top = navigationInset()
  if (opening && (rect.bottom <= top || rect.top >= innerHeight)) return noop
  if (!opening && table.getBoundingClientRect().top > top) return noop
  const mask = document.createElement('div'),
    copy = header.cloneNode(true) as HTMLElement
  mask.setAttribute('aria-hidden', 'true')
  mask.inert = true
  mask.style.cssText = `position:fixed;left:${rect.left}px;top:${opening ? Math.max(top, rect.top) : top}px;width:${rect.width}px;height:${rect.height}px;overflow:clip;pointer-events:none;z-index:4;`
  copy.removeAttribute('id')
  copy.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'))
  copy.style.cssText =
    'position:relative;top:0;visibility:visible;animation:none;opacity:1;transform:translateY(0);'
  const originalGrid = header.querySelector('.board-column-head'),
    grid = copy.querySelector<HTMLElement>('.board-column-head')
  if (originalGrid && grid)
    grid.style.gridTemplateColumns = getComputedStyle(originalGrid).gridTemplateColumns
  mask.append(copy)
  table.append(mask)
  const visibility = header.style.visibility
  header.style.visibility = 'hidden'
  function progress(value: number) {
    copy.style.transform = `translateY(${(opening ? -value : value - 1) * rect.height}px)`
  }
  progress(0)
  return {
    progress,
    dispose: () => {
      mask.remove()
      header.style.visibility = visibility
    },
  }
}
