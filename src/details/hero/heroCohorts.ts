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

// 每个“版本 × 英雄”的符文筛选与装备筛选各合并为一个 gzip 数据包：
// { "<符文或装备 ID>": 与原单个筛选文件相同的内容 }。首次筛选时下载，之后切换条件不再请求。
const bundles = new Map<string, Promise<Record<string, HeroDetailPayload>>>()
const missingCondition = '当前版本暂无这个筛选条件的数据'

function loadBundle(path: string) {
  if (!bundles.has(path))
    bundles.set(
      path,
      fetch(path, { signal: AbortSignal.timeout(15000) })
        .then(async response => {
          if (!response.ok)
            throw new Error(response.status === 404 ? missingCondition : '筛选统计暂时无法读取')
          if (typeof DecompressionStream === 'undefined')
            throw new Error('当前浏览器无法读取筛选统计，请更新浏览器')
          const stream = new Blob([await response.arrayBuffer()])
            .stream()
            .pipeThrough(new DecompressionStream('gzip'))
          return JSON.parse(await new Response(stream).text()) as Record<string, HeroDetailPayload>
        })
        .catch(error => {
          bundles.delete(path)
          throw error
        }),
    )
  return bundles.get(path)!
}
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
  const cohorts = `${root}/hero-cohorts/${entry.championId}`
  // 符文与装备筛选从数据包中取出对应条目；全部出场与未分类仍是单独文件
  const bundle = aid || iid ? `${cohorts}/${aid ? 'augments' : 'items'}.json.gz` : null
  const path = other
    ? `${root}/hero-unclassified/${entry.championId}.json`
    : bundle
      ? `${bundle}#${aid || iid}`
      : `${cohorts}/all.json`
  async function read() {
    if (bundle) {
      const value = (await loadBundle(bundle))[(aid || iid)!]
      if (!value) throw new Error(missingCondition)
      return value
    }
    const response = await fetch(path, { signal: AbortSignal.timeout(15000) })
    if (!response.ok)
      throw new Error(response.status === 404 ? missingCondition : '筛选统计暂时无法读取')
    return (await response.json()) as HeroDetailPayload
  }
  if (!cache.has(path))
    cache.set(
      path,
      read()
        .then(value => {
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
          // 失败后清除缓存，重试时重新下载（包括数据包本身）
          cache.delete(path)
          // 只是缺少该条件时保留数据包，避免每次点击都重新下载
          if (bundle && error.message !== missingCondition) bundles.delete(bundle)
          throw error
        }),
    )
  return cache.get(path)!
}
