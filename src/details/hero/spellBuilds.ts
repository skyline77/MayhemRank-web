export interface SpellPair {
  id: string
  name: string
  spellIds: number[]
  icons: (string | null)[]
  games: number
  wins: number
  winRate: number
  winRateCi90: [number, number]
  pickRate: number
  lowSample: boolean
}
export interface SpellRole {
  role: string
  games: number
  validGames: number
  missingGames: number
  pairs: SpellPair[]
}
export interface SpellPayload {
  meta: {
    queue: number
    patch: string
    snapshotId?: string
    region: string
    from: string
    cutoff: string
  }
  champions: Record<string, { name: string; roles: SpellRole[] }>
}
const cache = new Map<string, Promise<SpellPayload>>()
export async function loadSpellBuilds(patch: string, snapshotId?: string): Promise<SpellPayload> {
  const key = (snapshotId || 'legacy') + ':' + patch
  if (!cache.has(key))
    cache.set(
      key,
      fetch(
        (snapshotId ? '/snapshots/' + snapshotId + '/' + patch : '') +
          '/spell-builds-usage.json?v=2',
        { signal: AbortSignal.timeout(15000) },
      )
        .then(async r => {
          if (!r.ok) throw new Error('召唤师技能统计暂不可用')
          const data = (await r.json()) as SpellPayload
          if (
            data.meta.queue !== 2400 ||
            data.meta.patch !== patch ||
            (snapshotId && data.meta.snapshotId !== snapshotId) ||
            !data.champions
          )
            throw new Error('召唤师技能版本与流派不符')
          return data
        })
        .catch(e => {
          cache.delete(key)
          throw e
        }),
    )
  return cache.get(key)!
}

export function visibleSpellPairs(pairs: SpellPair[]): SpellPair[] {
  return [...pairs]
    .sort((a, b) => b.pickRate - a.pickRate)
    .filter((pair, index) => pair.pickRate > 0.005 || index < 3)
}

// Display order is independent of the unordered statistical pair identity.
const spellOrder = [4, 32, 6, 21, 1, 7, 13]
export function orderedSpellIcons(pair: SpellPair) {
  const rank = (id: number) => {
    const index = spellOrder.indexOf(id)
    return index < 0 ? spellOrder.length : index
  }
  return pair.spellIds
    .map((id, index) => ({ id, icon: pair.icons[index] ?? null }))
    .sort((a, b) => rank(a.id) - rank(b.id))
}
export interface SpellScope {
  row: SpellRole
  meta: SpellPayload['meta']
}
