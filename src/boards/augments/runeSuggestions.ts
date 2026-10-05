import { normalizeSearch } from '@/search/search'
import { suggestionScore } from '@/search/searchSuggestions'
import type { RuneEntry } from './augmentBoard'
import { catalogueSearchFields, type DetailSearchIndex } from '@/details/detailSearch'

export function runeSuggestions(
  entries: readonly RuneEntry[],
  query: string,
  index: DetailSearchIndex | null,
): RuneEntry[] {
  if (!normalizeSearch(query)) return []
  return entries
    .filter(
      entry =>
        !entry.lowSample &&
        Number.isFinite(entry.winRate) &&
        entry.winRate >= 0 &&
        entry.winRate <= 1 &&
        ['棱彩', '黄金', '白银'].includes(entry.column),
    )
    .map(entry => ({
      entry,
      score: suggestionScore(catalogueSearchFields('augments', entry, index), query),
    }))
    .filter(result => Number.isFinite(result.score))
    .sort((a, b) => a.score - b.score || a.entry.id.localeCompare(b.entry.id))
    .map(result => result.entry)
}
