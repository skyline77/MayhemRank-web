import config from './runeVisualFamilies.json'
import type { SortableDetailCell } from './detailSort'
const families = new Map(
  config.families.flatMap(family => family.ids.map(id => [id, family.id] as const)),
)
const familyOf = (id: string) => families.get(String(id)) || 'unknown:' + id
export function sortRuneVisualFamilies<T extends SortableDetailCell>(
  cells: readonly T[],
  allAppearances: readonly SortableDetailCell[],
): T[] {
  // 系列顺序及成员顺序都由同英雄、同版本、同品质的全部出场使用率决定。
  // 每个系列只排列一次，返回原卡片对象。
  const ranked = [...allAppearances].sort(
    (a, b) =>
      b.pickRate - a.pickRate ||
      b.games - a.games ||
      String(a.id).localeCompare(String(b.id), undefined, { numeric: true }),
  )
  const groupRanks = new Map<string, number>(),
    itemRanks = new Map<string, number>()
  ranked.forEach((cell, index) => {
    const family = familyOf(cell.id)
    if (!groupRanks.has(family)) groupRanks.set(family, groupRanks.size)
    itemRanks.set(String(cell.id), index)
  })
  return [...cells].sort((a, b) => {
    const af = familyOf(a.id),
      bf = familyOf(b.id)
    return (
      (groupRanks.get(af) ?? Number.MAX_SAFE_INTEGER) -
        (groupRanks.get(bf) ?? Number.MAX_SAFE_INTEGER) ||
      (af === bf ? 0 : af.localeCompare(bf, undefined, { numeric: true })) ||
      (itemRanks.get(String(a.id)) ?? Number.MAX_SAFE_INTEGER) -
        (itemRanks.get(String(b.id)) ?? Number.MAX_SAFE_INTEGER) ||
      String(a.id).localeCompare(String(b.id), undefined, { numeric: true })
    )
  })
}
