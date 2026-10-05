import type { HeroSummary } from './heroCohorts'
import type { DetailSearchIndex } from '@/details/detailSearch'
import { catalogueSearchFields } from '@/details/detailSearch'
import { matchesSearch } from '@/search/search'
export interface HeroRunePair {
  id: string
  name: string
  games: number
  wins: number
  winRate: number
  pickRate: number
  delta: number
  lowSample: boolean
  interval: number[]
  runes: { id: string; name: string; icon: string; rarity: string }[]
}
export interface HeroRunePairs {
  meta: {
    queue: number
    patch: string
    snapshotId: string
    scope: string
    method: string
    minimumGames: number
    confidenceLevel: number | null
    combinationDefinition: string
  }
  championId: number
  baseline: HeroSummary
  augmentGames: number
  entries: HeroRunePair[]
}
const cache = new Map<string, Promise<HeroRunePairs>>()
export function loadHeroRunePairs(
  champion: number,
  patch: string,
  generation: string,
): Promise<HeroRunePairs> {
  const params = new URLSearchParams({
      champion: String(champion),
      patch,
      generation,
      minimumGames: '51',
    }),
    key = params.toString()
  if (!cache.has(key))
    cache.set(
      key,
      fetch('/api/hero-rune-pairs?' + params, { signal: AbortSignal.timeout(15000) })
        .then(async response => {
          if (!response.ok) throw new Error('海克斯组合暂时无法读取')
          const data = (await response.json()) as HeroRunePairs
          if (
            data.championId !== champion ||
            data.meta.queue !== 2400 ||
            data.meta.patch !== patch ||
            data.meta.snapshotId !== generation ||
            data.meta.scope !== 'all-valid-appearances' ||
            data.meta.method !== 'beta50-fixed-hero-baseline-v1' ||
            ![null, 0.9].includes(data.meta.confidenceLevel) ||
            data.meta.combinationDefinition !==
              'same-hero-same-appearance-unordered-distinct-runes' ||
            !Array.isArray(data.entries) ||
            data.entries.some(
              row =>
                row.runes.length !== 2 ||
                row.runes[0]!.id === row.runes[1]!.id ||
                row.games > data.augmentGames ||
                row.games < data.meta.minimumGames,
            )
          )
            throw new Error('海克斯组合统计范围不一致')
          return data
        })
        .catch(error => {
          cache.delete(key)
          throw error
        }),
    )
  return cache.get(key)!
}
export function matchesRunePair(
  cell: HeroRunePair,
  query: string,
  index: DetailSearchIndex | null,
): boolean {
  return matchesSearch(
    cell.runes.flatMap(rune =>
      catalogueSearchFields('augments', rune, index).map(([value]) => value),
    ),
    query,
  )
}
