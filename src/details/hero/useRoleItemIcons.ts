// 流派按钮上的代表装备图标：流派名由装备名以“＋”拼接，按名称匹配英雄详情中的装备图标。
import { ref, watch } from 'vue'
import { loadBuildDetail, type DetailCell } from '@/details/buildDetails'
import type { BuildEntry } from '@/boards/heroes/buildBoard'

export function useRoleItemIcons(patch: () => string, roles: () => readonly BuildEntry[]) {
  /** 流派 → 该流派常见装备 */
  const roleItems = ref<Record<string, DetailCell[]>>({})
  /** 加载失败的图标，不再显示 */
  const failedIcons = ref<Set<string>>(new Set())

  watch(
    () => [patch(), roles()[0]?.championId, roles()[0]?.snapshotId],
    async (_scope, _previous, onCleanup) => {
      let active = true
      onCleanup(() => {
        active = false
      })
      roleItems.value = {}
      failedIcons.value = new Set()
      const first = roles()[0]
      // 快照已提供 nameItems 时无需另读详情
      if (!first || roles().every(role => role.nameItems)) return
      try {
        const detail = await loadBuildDetail(first.championId, patch(), first.snapshotId)
        if (active)
          roleItems.value = Object.fromEntries(
            Object.entries(detail.roles).map(([role, row]) => [role, row.groups.items || []]),
          )
      } catch {
        /* 装备元数据不可用时仍保留可读的流派名。 */
      }
    },
    { immediate: true },
  )

  function iconsFor(option: BuildEntry) {
    if (option.nameItems) return option.nameItems.filter(item => !failedIcons.value.has(item.icon))
    const items = roleItems.value[option.role] || []
    const exact = items.find(item => item.name === option.label)
    const matches = exact
      ? [exact]
      : items
          .filter(item => option.label.includes(item.name))
          .sort((a, b) => option.label.indexOf(a.name) - option.label.indexOf(b.name))
    return matches.filter(item => item.icon && !failedIcons.value.has(item.icon))
  }

  /** 每个装备名一个位置；没有图标的位置 icon 为 undefined */
  function iconSlots(option: BuildEntry) {
    const icons = iconsFor(option)
    const names = option.nameItems?.map(item => item.name) || option.label.split('＋')
    return names.map((name, index) => ({
      name,
      icon: icons.find(item => item.name === name)?.icon,
      key: index,
    }))
  }

  return { failedIcons, iconSlots }
}
