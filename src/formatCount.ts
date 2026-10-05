// Presentation only: preserve weighted counters for calculations and ranking.
import { locale } from './locale'
export function formatCount(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value)
    ? '—'
    : new Intl.NumberFormat(locale.value, { maximumFractionDigits: 0 }).format(Math.round(value))
}

export function formatCompactCount(value: number): string {
  return new Intl.NumberFormat(locale.value, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}
