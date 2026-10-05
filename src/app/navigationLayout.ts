// Standalone details have no board navigation and keep their original zero inset.
export function navigationInset(
  root: Pick<Document, 'querySelector'> | undefined = typeof document === 'undefined'
    ? undefined
    : document,
): number {
  const nav = root?.querySelector?.<HTMLElement>('.product-nav')
  if (!nav) return 0
  // On phones the nav is display:contents; only the destinations remain sticky.
  return (
    nav.offsetHeight ||
    (nav.querySelector<HTMLElement>('.product-nav-destinations')?.offsetHeight || 0) +
      (nav.querySelector<HTMLElement>('.product-nav-secondary')?.offsetHeight || 0)
  )
}
