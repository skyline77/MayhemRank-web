import { winRateRows, winRateStrips } from '@/boards/winRateTable'
import { matchesSearch } from '@/search/search'
export interface BuildEntry {
  nameItems?: { id: string; name: string; icon: string }[]
  roleFallback?: boolean
  id: string
  championId: number
  name: string
  role: string
  label: string
  column: string
  games: number
  wins: number
  winRate: number
  rawWinRate: number
  pickRate: number
  heroGames?: number
  eligibleGames?: number
  unformedGames?: number
  classifiedGames?: number
  interval: number[]
  lowSample: boolean
  icon: string
  searchTerms?: string[]
  snapshotId?: string
}
const badgeLabels: Record<string, string> = {
  特效AD: '特效',
  暴击AD: '暴击',
  远程暴击: '暴击',
  近战暴击: '暴击',
  AP战士: '战士',
  AP刺客: '刺客',
  面具AP: 'AP',
}
export const badgeLabel = (label: string) => badgeLabels[label] || label
export function championBuilds(entries: BuildEntry[], championId: number | null) {
  return entries
    .filter(entry => entry.championId === championId)
    .sort((a, b) => b.games - a.games || a.role.localeCompare(b.role))
}
// Roles partition classified appearances. Pool raw counters (including small
// roles) and apply the board's Beta(1,1) prior once, after aggregation.
export function championWinRates(entries: BuildEntry[]) {
  const totals = new Map<number, { games: number; wins: number; winRate: number }>()
  for (const entry of entries) {
    const total = totals.get(entry.championId) || { games: 0, wins: 0, winRate: 0 }
    total.games += entry.games
    total.wins += entry.wins
    totals.set(entry.championId, total)
  }
  for (const [id, total] of totals) {
    if (total.games <= 0) {
      totals.delete(id)
      continue
    }
    total.winRate = (total.wins + 1) / (total.games + 2)
  }
  return totals
}
export const columns = ['坦克', '战士', '刺客', 'AD输出', 'AP输出', '辅助'] as const
export const compactColumnGroups = [
  { label: '坦辅', roles: ['坦克', '辅助'], icons: [0, 5] },
  { label: '战刺', roles: ['战士', '刺客'], icons: [1, 2] },
  { label: '输出', roles: ['AD输出', 'AP输出'], icons: [3, 4] },
] as const
export const compactColumns = compactColumnGroups.map(group => group.label)
const compactColumn = (entry: BuildEntry) =>
  compactColumnGroups.find(group => group.roles.some(role => role === entry.column))?.label ||
  entry.column
export function buildRows(entries: BuildEntry[], query = '', columnFilter = '', compact = false) {
  return winRateRows(
    entries.filter(
      entry =>
        (!columnFilter || (compact ? compactColumn(entry) : entry.column) === columnFilter) &&
        matchesSearch([entry.name, entry.role, entry.column, ...(entry.searchTerms || [])], query),
    ),
    compact ? compactColumns : columns,
    compact ? compactColumn : undefined,
  )
}
export const columnCapacities = [3, 3, 2, 3, 3, 2] as const
export function buildStrips(rows: ReturnType<typeof buildRows>, compact = false) {
  return winRateStrips(rows, compact ? [2, 2, 2] : columnCapacities)
}

export interface BoardMeta {
  patch: string
  queue: number
  region: string
  source: string
  from: string
  cutoff: string
  updatedAt?: string
  snapshotId?: string
  classification?: string
  games: number
  appearances: number
  heroes: number
  entries: number
  minimumGames: number
  sourceSha256: string
  exclusions: Record<string, number>
}
export interface BoardPayload {
  meta: BoardMeta
  entries: BuildEntry[]
  heroEntries?: BuildEntry[]
}
const boardRequests = new Map<string, Promise<BoardPayload>>()
export async function loadBuildBoard(patch?: string): Promise<BoardPayload> {
  const { loadVersions, selectedPatch } = await import('@/data/versions')
  const manifest = await loadVersions()
  patch = patch || selectedPatch.value
  if (!manifest.patches.some(row => row.patch === patch)) throw new Error('该版本暂无统计')
  const key = manifest.generation + ':' + patch
  if (!boardRequests.has(key)) {
    const url = manifest.generation
      ? '/snapshots/' +
        manifest.generation +
        '/' +
        patch +
        '/board.json?hero-ranking=all-v2&role-display=coverage-v1'
      : '/api/build-roles?patch=' + encodeURIComponent(patch)
    boardRequests.set(
      key,
      fetchBoardPayload(url, patch, manifest.generation).catch(error => {
        boardRequests.delete(key)
        throw error
      }),
    )
  }
  return boardRequests.get(key)!
}

// A cached pre-upgrade board can contain roles without the hero summary.
// Retry that schema once from the server instead of silently disabling the switch.
export async function fetchBoardPayload(
  url: string,
  patch: string,
  generation: string | null,
): Promise<BoardPayload> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      ...(attempt ? { cache: 'no-store' as const } : {}),
    })
    if (!response.ok) throw new Error('榜单统计暂时无法读取，请重试。')
    const data = (await response.json()) as BoardPayload
    if (data.meta.patch !== patch || (generation && data.meta.snapshotId !== generation))
      throw new Error('榜单版本不一致')
    if (!generation || (Array.isArray(data.heroEntries) && data.heroEntries.length > 0)) return data
  }
  throw new Error('英雄整体统计暂未加载，请点击重新加载。')
}
