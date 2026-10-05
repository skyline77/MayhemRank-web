// 英雄榜与海克斯榜共用的条带计算：胜率表按“条带”逐行排列卡片，
// 展开的详情作为额外一行插在所属条带之后。
import type { WinRateStrip } from './winRateTable'

type OpenPanels<T> = Record<string, T | undefined>

/** 卡片所在条带的 key；卡片不在当前表格中时返回 null。 */
export function stripKeyOf<T extends { id: string }>(
  strips: WinRateStrip<T>[],
  entry: T | null,
): string | null {
  if (!entry) return null
  return (
    strips.find(strip => strip.cells.some(cell => cell.some(item => item.id === entry.id)))?.key ||
    null
  )
}

/** 当前选中卡片的详情所挂载的条带 key。 */
export function openStripKey<T extends { id: string }>(
  openPanels: OpenPanels<T>,
  selected: T | null,
): string | null {
  return Object.keys(openPanels).find(key => openPanels[key]?.id === selected?.id) || null
}

/** 条带在表格网格中的行号；之前每个展开的详情各占一行。 */
export function stripGridRow<T>(strips: WinRateStrip<T>[], openPanels: OpenPanels<T>, key: string) {
  const index = strips.findIndex(strip => strip.key === key)
  return index + 1 + strips.slice(0, index).filter(strip => openPanels[strip.key]).length
}

/** 把同一胜率区间的条带合成一段，供左侧区间标签居中；展开的详情会把区间截断。 */
export function bandSections<T>(strips: WinRateStrip<T>[], openPanels: OpenPanels<T>) {
  const sections: {
    key: string
    lower: number
    upper: number
    strips: WinRateStrip<T>[]
    detail: boolean
  }[] = []
  let section: (typeof sections)[number] | undefined
  for (const strip of strips) {
    if (!section)
      section = {
        key: strip.key,
        lower: strip.lower,
        upper: strip.upper,
        strips: [],
        detail: false,
      }
    section.strips.push(strip)
    if (strip.last || openPanels[strip.key]) {
      section.detail = !!openPanels[strip.key]
      sections.push(section)
      section = undefined
    }
  }
  return sections
}
