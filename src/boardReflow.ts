import { captureColumns, prepareColumns } from './boardColumnMotion'
// Animate real cards after one layout change; keep links interactive throughout.
export function createBoardReflow(
  selector = '.build-tile[data-build-id]',
  identityAttribute = 'data-build-id',
  sqrtTravelTiming = false,
) {
  let revision = 0
  let cleanup = () => {}
  function stop() {
    ++revision
    cleanup()
    cleanup = () => {}
  }
  async function run(
    root: HTMLElement | null,
    render: () => Promise<void>,
    settings: {
      columnVisual?: boolean
      revealNew?: boolean
      fadeCards?: boolean
      enterOnly?: boolean
      clipToRoot?: boolean
      maxTravelSlots?: number
      diagonalReveal?: boolean
      orderedArrival?: boolean
      travelTiming?: 'sqrt'
    } = {},
  ) {
    if (!root || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      stop()
      await render()
      return
    }
    // Read the painted positions before cancelling an interrupted movement.
    const before = new Map(
      Array.from(root.querySelectorAll<HTMLElement>(selector)).map(
        tile => [tile.getAttribute(identityAttribute)!, tile.getBoundingClientRect()] as const,
      ),
    )
    const columns = settings.columnVisual ? captureColumns(root) : undefined
    stop()
    const token = revision
    await render()
    if (token !== revision || !root.isConnected) return
    const box = root.getBoundingClientRect()
    const bounds = settings.clipToRoot
      ? {
          left: Math.max(0, box.left + root.clientLeft),
          top: Math.max(0, box.top + root.clientTop),
          right: Math.min(innerWidth, box.left + root.clientLeft + root.clientWidth),
          bottom: Math.min(innerHeight, box.top + root.clientTop + root.clientHeight),
        }
      : { left: 0, top: 0, right: innerWidth, bottom: innerHeight }
    const visible = (rect: DOMRect) =>
      rect.bottom > bounds.top &&
      rect.top < bounds.bottom &&
      rect.right > bounds.left &&
      rect.left < bounds.right
    const gap =
      settings.maxTravelSlots === undefined ? 0 : parseFloat(getComputedStyle(root).columnGap) || 0
    // Finish all geometry reads before starting any animation.
    const targets = Array.from(root.querySelectorAll<HTMLElement>(selector)).map(tile => ({
      tile,
      end: tile.getBoundingClientRect(),
      opacity: parseFloat(getComputedStyle(tile).opacity) || 0,
    }))
    const beginColumns = columns ? prepareColumns(root, columns) : undefined
    const columnMotion = beginColumns?.()
    const animations: Animation[] = [...(columnMotion?.animations || [])]
    const incoming = targets.filter(({ end }) => visible(end))
    const origin = {
      left: Math.min(...incoming.map(({ end }) => end.left)),
      top: Math.min(...incoming.map(({ end }) => end.top)),
    }
    const rippleDistance = (end: DOMRect) =>
      Math.max(0, end.left - origin.left) + Math.max(0, end.top - origin.top)
    const rippleSpan = Math.max(1, ...incoming.map(({ end }) => rippleDistance(end)))
    let arrivalIndex = 0
    for (const { tile, end, opacity } of targets) {
      const start = before.get(tile.getAttribute(identityAttribute)!)
      if (!visible(end)) continue
      if (
        settings.enterOnly ||
        (settings.revealNew && (!start || start.width < 1 || start.height < 1))
      ) {
        const delay = (200 * rippleDistance(end)) / rippleSpan
        animations.push(
          tile.animate([{ opacity: 0 }, { opacity }], {
            duration: 200,
            delay,
            easing: 'ease-out',
            fill: 'both',
          }),
        )
        continue
      }
      let dx = start ? start.left - end.left : 0,
        dy = start ? start.top - end.top : 0
      const distance = Math.hypot(dx, dy),
        limit = (end.width + gap) * (settings.maxTravelSlots ?? Infinity)
      if (distance > limit) {
        const scale = limit / distance
        dx *= scale
        dy *= scale
      }
      const sx = start && end.width ? start.width / end.width : 1,
        sy = start && end.height ? start.height / end.height : 1
      if (
        start &&
        distance < 0.5 &&
        Math.abs(sx - 1) < 0.01 &&
        Math.abs(sy - 1) < 0.01 &&
        !settings.fadeCards
      )
        continue
      const duration =
        settings.travelTiming === 'sqrt'
          ? 24 * Math.sqrt(Math.min(distance, limit))
          : settings.columnVisual
            ? 320
            : settings.clipToRoot
              ? 260
              : sqrtTravelTiming
                ? Math.min(320, Math.max(180, 25 * Math.sqrt(distance)))
                : 220
      const delay =
        !settings.columnVisual && (settings.diagonalReveal || settings.orderedArrival)
          ? Math.min(60, arrivalIndex++ * 12)
          : 0
      animations.push(
        tile.animate(
          [
            {
              transform: `translate(${dx}px,${dy}px) scale(${sx},${sy})`,
              transformOrigin: '0 0',
              ...(start && !settings.fadeCards ? {} : { opacity: opacity * 0.6 }),
            },
            {
              transform: 'none',
              transformOrigin: '0 0',
              ...(start && !settings.fadeCards ? {} : { opacity }),
            },
          ],
          { duration, delay, easing: 'cubic-bezier(0.2,0,0,1)', fill: 'both' },
        ),
      )
    }
    const initialWidth = window.innerWidth,
      initialRootWidth = root.clientWidth
    const resized = () => {
      // iPhone工具栏改变视窗高度时，头像布局通常不变，不应取消动画。
      if (window.innerWidth !== initialWidth || root.clientWidth !== initialRootWidth) stop()
    }
    cleanup = () => {
      columnMotion?.cleanup()
      animations.forEach(animation => animation.cancel())
      window.removeEventListener('resize', resized)
    }
    window.addEventListener('resize', resized)
    await Promise.allSettled(animations.map(animation => animation.finished))
    if (token === revision) {
      cleanup()
      cleanup = () => {}
    }
  }
  return { run, stop }
}
