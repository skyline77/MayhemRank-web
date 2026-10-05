// 英雄详情标题与流派选择器用到的两项概览：全部出场的胜率与场次，以及未归类流派的出场。
// 与当前筛选无关，只随英雄、版本和快照变化重新读取。
import { ref, watch } from 'vue'
import type { BuildEntry } from '@/boards/heroes/buildBoard'
import { loadHeroDetail } from './heroCohorts'

export function useHeroOverview(source: () => BuildEntry, patch: () => string) {
  const allWinRate = ref<number | undefined>(),
    allGames = ref<number | undefined>()
  const otherStats = ref<{ games: number; heroGames: number; winRate: number } | null>(null)
  const scope = () => [source().championId, patch(), source().snapshotId]

  watch(
    scope,
    async (_scope, _previous, onCleanup) => {
      let active = true
      onCleanup(() => {
        active = false
      })
      allWinRate.value = undefined
      allGames.value = undefined
      try {
        const all = await loadHeroDetail(source(), patch(), { role: null, rune: null })
        if (active) {
          allWinRate.value = all.summary.winRate
          allGames.value = all.summary.games
        }
      } catch {
        /* 读取失败时留空，不显示为 0。 */
      }
    },
    { immediate: true },
  )

  watch(
    scope,
    async (_scope, _previous, onCleanup) => {
      let active = true
      onCleanup(() => {
        active = false
      })
      otherStats.value = null
      const entry = source(),
        version = patch()
      try {
        const other = await loadHeroDetail(entry, version, { role: 'other', rune: null })
        const heroGames =
          entry.eligibleGames ??
          entry.heroGames ??
          (await loadHeroDetail(entry, version, { role: null, rune: null })).summary.games
        if (active)
          otherStats.value = {
            games: other.summary.games,
            heroGames,
            winRate: other.summary.winRate,
          }
      } catch {
        /* 无法读取时与“0 场出场”区分开，保持为空。 */
      }
    },
    { immediate: true },
  )

  return { allWinRate, allGames, otherStats }
}
