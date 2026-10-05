// 只叠加卡片内部内容，外框始终留在原位。临时副本不参与交互。
export function captureCategoryContents(viewport: HTMLElement | null) {
  if (!viewport || !viewport.getClientRects().length) return []
  const box = viewport.getBoundingClientRect()
  return Array.from(viewport.querySelectorAll<HTMLElement>('.build-stat-card')).map(card => {
    const rect = card.getBoundingClientRect(),
      content = card.querySelector<HTMLElement>('.stat-card-layout')
    if (
      !content ||
      rect.bottom <= Math.max(0, box.top) ||
      rect.top >= Math.min(innerHeight, box.bottom)
    )
      return null
    const copy = content.cloneNode(true) as HTMLElement
    copy.removeAttribute('id')
    copy.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'))
    copy.setAttribute('aria-hidden', 'true')
    copy.inert = true
    copy.style.cssText = 'position:absolute;inset:0;z-index:2;pointer-events:none'
    return copy
  })
}
export function captureCategoryGrid(root: HTMLElement) {
  const origin = root.getBoundingClientRect()
  return Array.from(root.querySelectorAll<HTMLElement>('.detail-card-viewport')).flatMap(
    viewport => {
      const box = viewport.getBoundingClientRect(),
        copies = captureCategoryContents(viewport)
      return Array.from(viewport.querySelectorAll<HTMLElement>('.build-stat-card')).flatMap(
        (card, index) => {
          const rect = card.getBoundingClientRect(),
            content = copies[index]
          if (!content || rect.right <= box.left || rect.left >= box.right) return []
          const frame = card.cloneNode(false) as HTMLElement,
            style = getComputedStyle(card)
          frame.removeAttribute('id')
          frame.removeAttribute('href')
          frame.removeAttribute('tabindex')
          frame.setAttribute('aria-hidden', 'true')
          frame.inert = true
          frame.append(content.cloneNode(true))
          Object.assign(frame.style, {
            position: 'absolute',
            left: rect.left - origin.left + 'px',
            top: rect.top - origin.top + 'px',
            width: rect.width + 'px',
            height: rect.height + 'px',
            boxSizing: 'border-box',
            margin: '0',
            zIndex: '3',
            pointerEvents: 'none',
            background: style.background,
            border: style.border,
            borderRadius: style.borderRadius,
            clipPath:
              'inset(' +
              Math.max(0, box.top - rect.top) +
              'px ' +
              Math.max(0, rect.right - box.right) +
              'px ' +
              Math.max(0, rect.bottom - box.bottom) +
              'px ' +
              Math.max(0, box.left - rect.left) +
              'px)',
          })
          return [{ x: rect.left - origin.left, y: rect.top - origin.top, content, frame }]
        },
      )
    },
  )
}
export function dissolveCategoryContents(
  viewport: HTMLElement | null,
  previous: (HTMLElement | null)[],
  grid?: ReturnType<typeof captureCategoryGrid>,
  restoring = false,
) {
  const animations: Animation[] = [],
    copies: HTMLElement[] = [],
    used = new Set<HTMLElement>()
  const origin = viewport?.closest('.desktop-category-browser')?.getBoundingClientRect()
  const box = viewport?.getBoundingClientRect()
  const span = Math.max(1, (box?.width || 0) + (box?.height || 0))
  for (const [index, card] of Array.from(
    viewport?.querySelectorAll<HTMLElement>('.build-stat-card') || [],
  ).entries()) {
    const rect = card.getBoundingClientRect()
    const clip = card.closest('.detail-card-viewport')?.getBoundingClientRect()
    if (
      !card.getClientRects().length ||
      rect.bottom < 0 ||
      rect.top > innerHeight ||
      (clip &&
        (rect.right <= clip.left ||
          rect.left >= clip.right ||
          rect.bottom <= clip.top ||
          rect.top >= clip.bottom))
    )
      continue
    const content = card.querySelector<HTMLElement>('.stat-card-layout')
    if (!content) continue
    const old =
      grid && origin
        ? grid.find(
            slot =>
              Math.abs(slot.x - (rect.left - origin.left)) < 2 &&
              Math.abs(slot.y - (rect.top - origin.top)) < 2,
          )?.content
        : previous[index]
    const delay =
      grid && box
        ? 200 *
          Math.min(1, (Math.max(0, rect.left - box.left) + Math.max(0, rect.top - box.top)) / span)
        : 0
    if (old) {
      used.add(old)
      card.append(old)
      copies.push(old)
      animations.push(
        old.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 260,
          delay,
          easing: 'linear',
          fill: 'both',
        }),
      )
    }
    animations.push(
      (restoring && !old ? card : content).animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 260,
        delay,
        easing: 'linear',
        fill: 'both',
      }),
    )
  }
  // 没有新卡片接替的位置也保留旧外框，按相同涟漪时序淡出；裁剪保留原横向视窗边缘。
  const root = viewport?.closest<HTMLElement>('.desktop-category-browser')
  if (grid && root && origin && box)
    for (const slot of grid) {
      if (used.has(slot.content)) continue
      root.append(slot.frame)
      copies.push(slot.frame)
      const delay =
        200 *
        Math.min(
          1,
          (Math.max(0, origin.left + slot.x - box.left) +
            Math.max(0, origin.top + slot.y - box.top)) /
            span,
        )
      animations.push(
        slot.frame.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 260,
          delay,
          easing: 'linear',
          fill: 'both',
        }),
      )
    }
  const cleanup = () => {
    animations.forEach(a => a.cancel())
    copies.forEach(copy => copy.remove())
  }
  void Promise.allSettled(animations.map(a => a.finished)).then(cleanup)
  return cleanup
}
