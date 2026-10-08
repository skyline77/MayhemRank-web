// Decorative column tracks never participate in grid layout or intercept clicks.
type Track = { left: number; width: number; selected: boolean }
type Row = { element: HTMLElement; tracks: Track[] }
export type ColumnSnapshot = { header: Track[]; body: Track[]; labels: Map<string, DOMRect> }
function tracks(row: HTMLElement | null, selector: string): Track[] {
  if (!row) return []
  const origin = row.getBoundingClientRect().left
  const overlays = Array.from(row.querySelectorAll<HTMLElement>(':scope > .column-motion-fill'))
  if (overlays.length)
    return overlays.map(el => {
      const r = el.getBoundingClientRect()
      return { left: r.left - origin, width: r.width, selected: el.dataset.selected === 'true' }
    })
  const cells = Array.from(row.querySelectorAll<HTMLElement>(selector))
  let edge = 0
  return cells.map(cell => {
    const r = cell.getBoundingClientRect()
    const left = r.width ? r.left - origin : edge
    edge = left + r.width
    return { left, width: r.width, selected: !!cell.querySelector('[aria-pressed=true]') }
  })
}
export function captureColumns(root: HTMLElement): ColumnSnapshot {
  const labels = Array.from(
    root.querySelectorAll<HTMLElement>('.board-column-content,.rune-column-name'),
  )
  return {
    header: tracks(root.querySelector('.board-column-head'), ':scope > .board-column'),
    body: tracks(root.querySelector('.board-strip'), ':scope > .board-cell'),
    labels: new Map(labels.map((el, i) => [String(i), el.getBoundingClientRect()])),
  }
}
export function prepareColumns(root: HTMLElement, before: ColumnSnapshot) {
  // Batch geometry reads before creating any decoration or starting animations.
  const after = captureColumns(root)
  const rows: Row[] = Array.from(
    root.querySelectorAll<HTMLElement>('.board-column-head,.board-strip'),
  )
    .filter(row => {
      const r = row.getBoundingClientRect()
      return r.bottom > 0 && r.top < innerHeight
    })
    .map(element => ({
      element,
      tracks: element.classList.contains('board-column-head') ? after.header : after.body,
    }))
  const labels = Array.from(
    root.querySelectorAll<HTMLElement>('.board-column-content,.rune-column-name'),
  ).map((element, i) => ({
    element,
    before: before.labels.get(String(i)),
    after: element.getBoundingClientRect(),
  }))
  return () => {
    const animations: Animation[] = [],
      decorations: HTMLElement[] = [],
      active: HTMLElement[] = []
    const timing = { duration: 320, easing: 'cubic-bezier(0.2,0,0,1)', fill: 'both' as const }
    for (const row of rows) {
      const isHeader = row.element.classList.contains('board-column-head')
      const previous = isHeader ? before.header : before.body
      if (
        previous.length !== row.tracks.length ||
        !row.tracks.some(
          (end, i) =>
            Math.abs(end.left - previous[i]!.left) > 0.5 ||
            Math.abs(end.width - previous[i]!.width) > 0.5 ||
            (isHeader && end.selected !== previous[i]!.selected),
        )
      )
        continue
      row.element.classList.add('has-column-motion')
      active.push(row.element)
      // 海克斯榜选中列的下划线用品质色（棱彩紫等），过渡层沿用同色，避免动画中先金后紫
      const underlineColor =
        isHeader && row.element.closest?.('.rune-board')
          ? getComputedStyle(
              row.element.querySelector<HTMLElement>('.board-column-filter[aria-pressed="true"]') ||
                row.element,
            ).color
          : ''
      const selectedStart = previous.find(track => track.selected),
        selectedEnd = row.tracks.find(track => track.selected)
      const slidingUnderline =
        isHeader && matchMedia('(max-width:700px)').matches && selectedStart && selectedEnd
      if (slidingUnderline) {
        const underline = document.createElement('div'),
          width = Math.max(selectedStart.width, selectedEnd.width, 1)
        underline.className = 'column-motion-underline'
        if (underlineColor) underline.style.background = underlineColor
        underline.setAttribute('aria-hidden', 'true')
        underline.style.width = width + 'px'
        row.element.append(underline)
        decorations.push(underline)
        animations.push(
          underline.animate(
            [
              {
                transform: `translateX(${selectedStart.left}px) scaleX(${selectedStart.width / width})`,
              },
              {
                transform: `translateX(${selectedEnd.left}px) scaleX(${selectedEnd.width / width})`,
              },
            ],
            timing,
          ),
        )
      }
      row.tracks.forEach((end, i) => {
        const start = previous[i]!,
          width = Math.max(start.width, end.width, 1)
        const fill = document.createElement('div'),
          line = document.createElement('div')
        fill.className = 'column-motion-fill'
        line.className = 'column-motion-line'
        fill.dataset.selected = String(end.selected)
        fill.setAttribute('aria-hidden', 'true')
        line.setAttribute('aria-hidden', 'true')
        fill.style.width = width + 'px'
        row.element.append(fill, line)
        decorations.push(fill, line)
        animations.push(
          fill.animate(
            [
              { transform: `translateX(${start.left}px) scaleX(${start.width / width})` },
              { transform: `translateX(${end.left}px) scaleX(${end.width / width})` },
            ],
            timing,
          ),
        )
        animations.push(
          line.animate(
            [
              { transform: `translateX(${start.left}px)`, opacity: start.width ? 1 : 0 },
              { transform: `translateX(${end.left}px)`, opacity: end.width ? 1 : 0 },
            ],
            timing,
          ),
        )
        if (isHeader && (start.selected || end.selected)) {
          const highlight = document.createElement('div'),
            underline = document.createElement('div')
          highlight.className = 'column-motion-highlight'
          underline.className = 'column-motion-underline'
          if (underlineColor) underline.style.background = underlineColor
          for (const el of slidingUnderline ? [highlight] : [highlight, underline]) {
            el.setAttribute('aria-hidden', 'true')
            el.style.width = width + 'px'
            row.element.append(el)
            decorations.push(el)
          }
          animations.push(
            highlight.animate(
              [
                {
                  transform: `translateX(${start.left}px) scaleX(${start.width / width})`,
                  opacity: start.selected ? 1 : 0,
                },
                {
                  transform: `translateX(${end.left}px) scaleX(${end.width / width})`,
                  opacity: end.selected ? 1 : 0,
                },
              ],
              timing,
            ),
          )
          if (!slidingUnderline)
            animations.push(
              underline.animate(
                [
                  {
                    transform: `translateX(${start.left + (start.selected ? 0 : start.width / 2)}px) scaleX(${start.selected ? start.width / width : 0})`,
                  },
                  {
                    transform: `translateX(${end.left + (end.selected ? 0 : end.width / 2)}px) scaleX(${end.selected ? end.width / width : 0})`,
                  },
                ],
                timing,
              ),
            )
        }
      })
    }
    for (const { element, before: start, after: end } of labels) {
      if (!start || end.bottom < 0 || end.top > innerHeight) continue
      const dx = start.left + start.width / 2 - end.left - end.width / 2,
        dy = start.top + start.height / 2 - end.top - end.height / 2
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue
      animations.push(
        element.animate(
          [{ transform: `translate3d(${dx}px,${dy}px,0)` }, { transform: 'translate3d(0,0,0)' }],
          timing,
        ),
      )
    }
    return {
      animations,
      cleanup: () => {
        animations.forEach(a => a.cancel())
        decorations.forEach(el => el.remove())
        active.forEach(el => el.classList.remove('has-column-motion'))
      },
    }
  }
}
