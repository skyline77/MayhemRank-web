import { locale } from '@/i18n/locale'
export type ChampionChange = { scope: 'general' | 'mayhem'; ability: string; text: string }
export type ChampionPatch = { patch: string; gamePatch: string; changes: ChampionChange[] }
export type PatchSource = { patch: string; gamePatch: string; url: string }
export type PatchKind = 'champion' | 'rune'
export type PatchCatalogue = {
  schemaVersion: 1
  sources: PatchSource[]
  champions: Record<string, ChampionPatch[]>
  runes: Record<string, ChampionPatch[]>
}

function patchNumber(patch: string) {
  const match = /^(\d+)\.(\d+)$/.exec(patch)
  return match ? Number(match[1]) * 1000 + Number(match[2]) : -1
}
export function recentPatches(
  data: PatchCatalogue,
  kind: PatchKind,
  entityId: string | number,
  gamePatch: string,
) {
  const current = patchNumber(gamePatch)
  return ((kind === 'rune' ? data.runes : data.champions)[String(entityId)] || [])
    .filter(
      row =>
        patchNumber(row.gamePatch) >= 0 &&
        patchNumber(row.gamePatch) <= current &&
        row.changes.length,
    )
    .sort((a, b) => patchNumber(b.gamePatch) - patchNumber(a.gamePatch))
}
export function coveredPatchLabel(data: PatchCatalogue, gamePatch: string) {
  const sources = data.sources
    .filter(source => patchNumber(source.gamePatch) <= patchNumber(gamePatch))
    .sort((a, b) => patchNumber(a.gamePatch) - patchNumber(b.gamePatch))
  return sources.length
    ? [sources[0]!.patch, sources.at(-1)!.patch]
        .filter((value, index, all) => index === 0 || value !== all[0])
        .join('–')
    : ''
}
const pending = new Map<string, Promise<PatchCatalogue>>()
export function loadPatchNotes(language = locale.value) {
  const source = language === 'zh-TW' ? 'zh-TW' : language === 'en-US' ? 'en-US' : 'zh-CN'
  if (!pending.has(source))
    pending.set(
      source,
      fetch('/champion-patches/recent' + (source === 'zh-CN' ? '' : '.' + source) + '.json', {
        cache: 'no-cache',
      })
        .then(async response => {
          if (!response.ok) throw new Error('暂时无法读取近期改动')
          const data = (await response.json()) as PatchCatalogue
          if (
            data.schemaVersion !== 1 ||
            !Array.isArray(data.sources) ||
            !data.champions ||
            !data.runes
          )
            throw new Error('近期改动数据格式不正确')
          return data
        })
        .catch(error => {
          pending.delete(source)
          throw error
        }),
    )
  return pending.get(source)!
}
