// Viewport breakpoints avoid feedback from cell counts and 700px page padding.
export function compactHeroSlots(viewportWidth: number) {
  return viewportWidth >= 760 ? 4 : viewportWidth >= 560 ? 3 : 2
}
export function heroSizeTier(available: number) {
  return available >= 54 ? 54 : available >= 48 ? 48 : 42
}
// Derive the unfiltered card width so focused columns never enlarge cards.
export function boardCardSize(
  kind: 'hero' | 'rune',
  tableWidth: number,
  axis: number,
  compact: boolean,
) {
  const content = tableWidth - 2 - axis
  // Use one width scale across both layouts. Fewer slots must not enlarge portraits.
  if (kind === 'hero') return heroSizeTier((tableWidth - 2 - 76 - 6 * 25 - 10 * 6) / 16)

  if (compact) return Math.max(44, Math.min(72, (content / 3 - 9 - 4) / 2))
  return Math.max(56, Math.min(72, (content / 3 - 25 - 3 * 6) / 4))
}
