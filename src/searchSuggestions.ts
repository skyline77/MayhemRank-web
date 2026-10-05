import { normalizeSearch } from './search'
export function suggestionScore(
  fields: readonly (readonly [string, number])[],
  query: string,
): number {
  const term = normalizeSearch(query)
  if (!term) return Infinity
  let best = Infinity
  for (const [value, priority] of fields) {
    const alias = normalizeSearch(value),
      index = alias.indexOf(term)
    if (index < 0) continue
    best = Math.min(best, (alias === term ? 0 : index === 0 ? 1 : 2) * 10 + priority)
  }
  return best
}
export function moveSuggestion(index: number, key: string, count: number): number {
  if (!count) return -1
  const direction =
    key === 'ArrowDown' || key === 'ArrowRight'
      ? 1
      : key === 'ArrowUp' || key === 'ArrowLeft'
        ? -1
        : 0
  return (index + direction + count) % count
}
