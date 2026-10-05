import { loadBuildDetail, type DetailPayload, type RoleDetail } from '@/details/buildDetails'
import { loadSpellBuilds, type SpellRole } from './spellBuilds'
import type { BuildEntry } from '@/boards/heroes/buildBoard'
import type { HeroFilter } from './heroFilter'
export interface HeroSummary {
  games: number
  wins: number
  winRate: number
  rawWinRate: number
  interval: number[]
  lowSample: boolean
}
export interface HeroDetailPayload {
  meta: DetailPayload['meta']
  championId: number
  augmentId: string | null
  itemId?: string | null
  summary: HeroSummary
  detail: RoleDetail & { itemGames?: number }
  spells: SpellRole
}
const cache = new Map<string, Promise<HeroDetailPayload>>()
export async function loadHeroDetail(
  entry: BuildEntry,
  patch: string,
  filter: HeroFilter,
): Promise<HeroDetailPayload> {
  if (filter.role && filter.role !== 'other') {
    const [data, spells] = await Promise.all([
      loadBuildDetail(entry.championId, patch, entry.snapshotId),
      loadSpellBuilds(patch, entry.snapshotId),
    ])
    const detail = data.roles[filter.role],
      row = spells.champions[entry.championId]?.roles.find(r => r.role === filter.role)
    if (!detail || !row || detail.games !== entry.games || row.games !== entry.games)
      throw new Error('详情样本与当前流派不一致')
    return {
      meta: data.meta,
      championId: entry.championId,
      augmentId: null,
      summary: entry,
      detail,
      spells: row,
    }
  }
  if (!entry.snapshotId) throw new Error('当前快照尚未提供筛选统计，请更新数据后重试')
  const aid = filter.rune?.id,
    iid = filter.item?.id
  if (iid && !/^(?:\d+|-1)$/.test(iid)) throw new Error('无效的装备编号')
  if (aid && iid) throw new Error('不能同时筛选符文和装备')
  if (aid && !/^\d+$/.test(aid)) throw new Error('无效的符文编号')
  const other = filter.role === 'other'
  const root = `/snapshots/${entry.snapshotId}/${patch}`
  const path = other
    ? `${root}/hero-unclassified/${entry.championId}.json`
    : `${root}/hero-cohorts/${entry.championId}/${iid ? 'items/' + iid : aid ? 'augments/' + aid : 'all'}.json`
  if (!cache.has(path))
    cache.set(
      path,
      fetch(path, { signal: AbortSignal.timeout(15000) })
        .then(async response => {
          if (!response.ok)
            throw new Error(
              response.status === 404 ? '当前版本暂无这个筛选条件的数据' : '筛选统计暂时无法读取',
            )
          const value = (await response.json()) as HeroDetailPayload
          if (
            value.meta.queue !== 2400 ||
            value.meta.patch !== patch ||
            value.meta.snapshotId !== entry.snapshotId ||
            value.championId !== entry.championId ||
            value.augmentId !== (aid || null) ||
            (value.itemId ?? null) !== (iid || null)
          )
            throw new Error('筛选统计与当前英雄或版本不一致')
          if (
            !value.summary ||
            (other ? value.summary.games < 0 : value.summary.games <= 0) ||
            value.detail.games !== value.summary.games ||
            value.spells.games !== value.summary.games
          )
            throw new Error('筛选统计样本不完整')
          if (other && (value.meta as { scope?: string }).scope !== 'unclassified-appearances')
            throw new Error('未分类统计范围不一致')
          return value
        })
        .catch(error => {
          cache.delete(path)
          throw error
        }),
    )
  return cache.get(path)!
}
