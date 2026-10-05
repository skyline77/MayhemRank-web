import type { HeroSummary } from '@/details/hero/heroCohorts'
export const RUNE_HERO_MIN_GAMES = 50
export interface RuneHero extends HeroSummary {
  id: string
  name: string
  icon: string
  baseline: HeroSummary
  delta: number
  pickRate: number
  rarity?: string
  sameRaritySelections?: number
  sameRarityPickRate?: number
}
export interface RuneHeroes {
  meta: {
    queue: number
    patch: string
    snapshotId: string
    scope: string
    method: string
    region: string
    source: string
    from: string
    cutoff: string
    updatedAt: string
    sameRarityPickRateScope?: string
  }
  runeId: string
  entries: RuneHero[]
}
const requests = new Map<string, Promise<RuneHeroes>>()
export async function loadRuneHeroes(
  runeId: string,
  patch: string,
  generation?: string,
): Promise<RuneHeroes> {
  if (!generation) throw new Error('当前快照尚未提供英雄统计，请更新数据后重试')
  if (!/^\d+$/.test(runeId) || !/^\d+\.\d+$/.test(patch) || !/^[\w-]+$/.test(generation))
    throw new Error('无效的统计范围')
  const path = `/snapshots/${generation}/${patch}/rune-heroes/${runeId}.json`
  if (!requests.has(path))
    requests.set(
      path,
      fetch(path, { signal: AbortSignal.timeout(15000) })
        .then(async response => {
          if (!response.ok)
            throw new Error(
              response.status === 404 ? '当前快照尚无该符文的英雄统计' : '英雄统计暂时无法读取',
            )
          const data = (await response.json()) as RuneHeroes
          if (
            data.meta.queue !== 2400 ||
            data.meta.patch !== patch ||
            data.meta.snapshotId !== generation ||
            data.meta.scope !== 'all-valid-appearances' ||
            !['hero-cohort-beta-1-1', 'beta50-fixed-hero-baseline-v1'].includes(data.meta.method) ||
            data.runeId !== runeId
          )
            throw new Error('英雄统计与当前符文或版本不一致')
          if (
            !Array.isArray(data.entries) ||
            data.entries.some(
              e =>
                e.games <= 0 ||
                !e.baseline ||
                e.games > e.baseline.games ||
                !Number.isFinite(e.winRate) ||
                !Number.isFinite(e.delta) ||
                Math.abs(e.winRate - e.baseline.winRate - e.delta) > 1e-10,
            )
          )
            throw new Error('英雄统计不完整')
          if (
            data.meta.sameRarityPickRateScope !== undefined &&
            (data.meta.sameRarityPickRateScope !== 'deduplicated-same-rarity-selections' ||
              data.entries.some(
                e =>
                  !['kPrismatic', 'kGold', 'kSilver'].includes(e.rarity || '') ||
                  !Number.isInteger(e.sameRaritySelections) ||
                  e.sameRaritySelections! < e.games ||
                  !Number.isFinite(e.sameRarityPickRate) ||
                  Math.abs(e.games / e.sameRaritySelections! - e.sameRarityPickRate!) > 1e-10,
              ))
          )
            throw new Error('同品质符文选用次数不完整')
          return data
        })
        .catch(error => {
          requests.delete(path)
          throw error
        }),
    )
  return requests.get(path)!
}
