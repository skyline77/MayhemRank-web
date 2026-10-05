import { winRateColor } from './winRateColor'
export interface WinRateEntry {
  id: string
  column: string
  winRate: number
  interval: number[]
  games: number
  lowSample: boolean
}
export interface WinRateRow<T> {
  lower: number
  upper: number
  cells: T[][]
}
// Color a range by its midpoint using the same scale as individual rates.
export function winRateBandInk(lower: number, upper: number): string {
  return winRateColor((lower + upper) / 200)
}
// Both boards use exact two-point boundaries and the same stable ordering.
export function winRateRows<T extends WinRateEntry>(
  entries: T[],
  columns: readonly string[],
  columnFor: (entry: T) => string = entry => entry.column,
): WinRateRow<T>[] {
  const groups = new Map<number, T[]>()
  for (const entry of entries) {
    if (
      entry.lowSample ||
      !Number.isFinite(entry.winRate) ||
      entry.winRate < 0 ||
      entry.winRate > 1 ||
      !columns.includes(columnFor(entry))
    )
      continue
    let lower = 0
    while (lower < 98 && entry.winRate >= (lower + 2) / 100) lower += 2
    if (!groups.has(lower)) groups.set(lower, [])
    groups.get(lower)!.push(entry)
  }
  return [...groups]
    .sort(([a], [b]) => b - a)
    .map(([lower, items]) => ({
      lower,
      upper: lower + 2,
      cells: columns.map(column =>
        items
          .filter(e => columnFor(e) === column)
          .sort((a, b) => b.winRate - a.winRate || b.games - a.games || a.id.localeCompare(b.id)),
      ),
    }))
}
export function winRateStrips<T>(rows: WinRateRow<T>[], capacities: readonly number[]) {
  if (capacities.some(n => !Number.isInteger(n) || n < 1))
    throw new Error('Invalid column capacity')
  return rows.flatMap(row => {
    if (row.cells.length !== capacities.length) throw new Error('Column capacity mismatch')
    const count = Math.max(
      1,
      ...row.cells.map((cell, i) => Math.ceil(cell.length / capacities[i]!)),
    )
    return Array.from({ length: count }, (_, index) => ({
      key: row.lower + ':' + index,
      lower: row.lower,
      upper: row.upper,
      index,
      last: index === count - 1,
      cells: row.cells.map((cell, i) =>
        cell.slice(index * capacities[i]!, (index + 1) * capacities[i]!),
      ),
    }))
  })
}
