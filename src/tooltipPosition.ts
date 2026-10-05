type Box = { top: number; bottom: number; left: number; right: number; width: number }
export type TooltipSide = 'above' | 'below'
type HorizontalBounds = { left: number; right: number }
export function tooltipPosition(
  a: Box,
  width: number,
  height: number,
  vw: number,
  vh: number,
  bounds?: HorizontalBounds,
  preferredSide: TooltipSide = 'above',
) {
  const margin = 8,
    gap = 10
  const minLeft = Math.max(margin, bounds?.left ?? margin)
  const maxRight = Math.min(vw - margin, bounds?.right ?? vw - margin)
  // Align to the card, flipping to its right edge at the main content boundary.
  const alignedLeft = a.left + width <= maxRight ? a.left : a.right - width
  const left = Math.max(minLeft, Math.min(alignedLeft, maxRight - width))
  let maxHeight = Math.max(0, vh - margin * 2)
  height = Math.min(height, maxHeight)
  const above = Math.max(0, a.top - gap - margin),
    below = Math.max(0, vh - margin - a.bottom - gap)
  // Prefer the requested side when it fits; otherwise use the other side.
  // If neither fits, use the larger space and scroll the long description.
  const useBelow =
    preferredSide === 'below'
      ? below >= height || (above < height && below >= above)
      : above < height && (below >= height || below > above)
  if (above < height && below < height) maxHeight = useBelow ? below : above
  const top = useBelow ? a.bottom + gap : a.top - gap - Math.min(height, maxHeight)
  return {
    left: left + 'px',
    top: top + 'px',
    maxHeight: maxHeight + 'px',
    visibility: 'visible' as const,
  }
}
