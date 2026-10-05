import { locale } from '@/i18n/locale'
import { gameAliases } from '@/i18n/gameLocalization'
import { normalizeSearch } from '@/search/search'
import { localizedChampionSearchFields } from '@/data/championSearch'
import type { BuildEntry } from './buildBoard'

import { suggestionScore } from '@/search/searchSuggestions'
export { suggestionScore, moveSuggestion } from '@/search/searchSuggestions'
export function heroSuggestions(entries: readonly BuildEntry[], query: string): BuildEntry[] {
  if (!normalizeSearch(query)) return []
  const heroes = new Map<number, BuildEntry>(),
    roles = new Map<number, [string, number][]>()
  for (const entry of entries) {
    if (
      entry.lowSample ||
      !Number.isFinite(entry.winRate) ||
      entry.winRate < 0 ||
      entry.winRate > 1
    )
      continue
    const previous = heroes.get(entry.championId)
    if (
      !previous ||
      entry.pickRate > previous.pickRate ||
      (entry.pickRate === previous.pickRate &&
        (entry.games > previous.games ||
          (entry.games === previous.games && entry.id < previous.id)))
    )
      heroes.set(entry.championId, entry)
    const aliases = roles.get(entry.championId) || []
    aliases.push([entry.role, 6], [entry.column, 6])
    roles.set(entry.championId, aliases)
  }
  return [...heroes.values()]
    .map(entry => ({
      entry,
      score: suggestionScore(
        [
          [entry.name, 0],
          ...gameAliases('champions', entry.championId).map(
            value => [value, 0] as [string, number],
          ),
          ...localizedChampionSearchFields(String(entry.championId)),
          ...(locale.value === 'zh-CN' ? roles.get(entry.championId) || [] : []),
        ],
        query,
      ),
    }))
    .filter(result => Number.isFinite(result.score))
    .sort((a, b) => a.score - b.score || a.entry.championId - b.entry.championId)
    .map(result => result.entry)
}
