// 英雄榜“按最强流派”模式下，头像角上显示流派代表装备的小图标。
import { ref, watch, type Ref } from 'vue'
import { loadTooltipCatalogue } from '@/data/tooltipData'
import type { BuildEntry } from './buildBoard'

export function useRoleIcons(patch: Ref<string>) {
  /** 装备名称 → 图标地址（流派名由装备名以“＋”拼接） */
  const iconByName = ref<Record<string, string>>({})
  /** 加载失败的图标，不再显示 */
  const failedIcons = ref(new Set<string>())

  watch(
    patch,
    async (value, _previous, onCleanup) => {
      let active = true
      onCleanup(() => {
        active = false
      })
      iconByName.value = {}
      failedIcons.value = new Set()
      if (!value.trim()) return
      try {
        const catalogue = await loadTooltipCatalogue(value)
        if (!active) return
        const names: Record<string, string> = {}
        // 基础装备 ID 排在其他模式的同名变体之前，保留基础装备的图标。
        for (const [id, item] of Object.entries(catalogue.items).sort(
          ([a], [b]) => Number(a) - Number(b),
        )) {
          if (!names[item.name]) names[item.name] = `/snapshot-assets/${value}/items-${id}.png`
        }
        iconByName.value = names
      } catch {
        /* 元数据读取失败时仍保留头像和无障碍流派名。 */
      }
    },
    { immediate: true },
  )

  function roleIcons(entry: BuildEntry) {
    if (entry.nameItems) return entry.nameItems.filter(item => !failedIcons.value.has(item.icon))
    return entry.label
      .split('＋')
      .map(name => ({ name, icon: iconByName.value[name] }))
      .filter(item => item.icon && !failedIcons.value.has(item.icon))
  }

  return { roleIcons, failedIcons }
}
