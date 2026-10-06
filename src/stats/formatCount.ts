// Presentation only: preserve weighted counters for calculations and ranking.
import { locale } from '@/i18n/locale'

// 创建 Intl.NumberFormat 的开销较大，详情一次要格式化数百个数字，因此按语言与选项复用。
const formatters = new Map<string, Intl.NumberFormat>()
function formatter(kind: 'count' | 'compact') {
  const key = kind + '|' + locale.value
  let value = formatters.get(key)
  if (!value) {
    value = new Intl.NumberFormat(
      locale.value,
      kind === 'count'
        ? { maximumFractionDigits: 0 }
        : { notation: 'compact', maximumFractionDigits: 1 },
    )
    formatters.set(key, value)
  }
  return value
}

export function formatCount(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value)
    ? '—'
    : formatter('count').format(Math.round(value))
}

export function formatCompactCount(value: number): string {
  return formatter('compact').format(value)
}
