import { loadVersions, selectedPatch } from './versions'
import type { WinRateEntry } from './winRateTable'
export const runeColumns = ['棱彩', '黄金', '白银'] as const
export interface RuneSlot {
  slot: number
  games: number
  wins: number
  winRate: number | null
  interval: number[] | null
  lowSample: boolean
}
export interface RuneEntry extends WinRateEntry {
  name: string
  icon: string
  rarity: string
  wins: number
  pickRate: number
  rawWinRate: number
  slots?: RuneSlot[]
  snapshotId?: string
}
export interface RuneBoard {
  meta: {
    patch: string
    queue: number
    snapshotId?: string
    updatedAt?: string
    region: string
    source: string
    from: string
    cutoff: string
    games: number
    appearances: number
    denominator: number
    minimumGames: number
    scope: string
  }
  entries: RuneEntry[]
}
const requests = new Map<string, Promise<RuneBoard>>()
export async function loadRuneBoard(patch?: string): Promise<RuneBoard> {
  const manifest = await loadVersions()
  patch = patch || selectedPatch.value
  if (!manifest.patches.some(p => p.patch === patch)) throw new Error('该版本暂无统计')
  const key = manifest.generation + ':' + patch
  if (!requests.has(key)) {
    const params = new URLSearchParams({ patch })
    if (manifest.generation) params.set('generation', manifest.generation)
    requests.set(
      key,
      fetch('/api/augment-board?' + params, { signal: AbortSignal.timeout(15000) })
        .then(async response => {
          if (!response.ok) throw new Error('符文统计暂时无法读取')
          const data = (await response.json()) as RuneBoard
          if (
            data.meta.queue !== 2400 ||
            data.meta.patch !== patch ||
            data.meta.scope !== 'classified-appearances' ||
            (manifest.generation && data.meta.snapshotId !== manifest.generation)
          )
            throw new Error('符文统计版本不一致')
          for (const entry of data.entries) entry.snapshotId = data.meta.snapshotId
          return data
        })
        .catch(error => {
          requests.delete(key)
          throw error
        }),
    )
  }
  return requests.get(key)!
}
