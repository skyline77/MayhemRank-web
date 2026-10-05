import { shallowReactive } from 'vue'
import { locale, type Locale } from './locale'
export type GameKind = 'champions' | 'items' | 'augments' | 'spells'
export interface GameText {
  name: string
  title?: string
  description?: string | null
}
export interface GameCatalogue {
  schema: number
  patch: string
  locales: Record<Locale, Record<GameKind, Record<string, GameText>>>
  sources: Record<string, string>
}
const catalogues = shallowReactive(new Map<string, GameCatalogue>())
const requests = new Map<string, Promise<GameCatalogue>>()
export function loadGameLocale(patch: string): Promise<GameCatalogue> {
  if (!requests.has(patch))
    requests.set(
      patch,
      fetch('/localization/' + encodeURIComponent(patch) + '.json', {
        signal: AbortSignal.timeout(15000),
      })
        .then(async response => {
          if (!response.ok) throw new Error('语言资源加载失败')
          const data = (await response.json()) as GameCatalogue
          if (
            data.schema !== 1 ||
            data.patch !== patch ||
            !['zh-CN', 'zh-TW', 'ja-JP', 'en-US'].every(key => data.locales[key as Locale])
          )
            throw new Error('语言资源版本不匹配')
          catalogues.set(patch, data)
          return data
        })
        .catch(error => {
          requests.delete(patch)
          throw error
        }),
    )
  return requests.get(patch)!
}
export function gameText(kind: GameKind, id: string | number, patch: string): GameText | undefined {
  return catalogues.get(patch)?.locales[locale.value]?.[kind]?.[String(id)]
}
const noBoots: Record<Locale, string> = {
  'zh-CN': '无鞋',
  'zh-TW': '未購買鞋子',
  'ja-JP': 'ブーツなし',
  'en-US': 'No boots',
}
export function gameName(
  kind: GameKind,
  id: string | number,
  patch: string,
  fallback = '',
): string {
  if (kind === 'items' && String(id) === '-1') return noBoots[locale.value]
  return (
    gameText(kind, id, patch)?.name ||
    (locale.value === 'zh-CN' ? fallback : `[${locale.value}: ${kind} #${id}]`)
  )
}
export function gameTitle(id: string | number, patch: string, fallback = ''): string {
  return (
    (locale.value === 'zh-CN' ? gameText('champions', id, patch)?.title : undefined) ||
    gameName('champions', id, patch, fallback)
  )
}
export function gameAliases(kind: GameKind, id: string | number, patch?: string): string[] {
  if (kind === 'items' && String(id) === '-1') return Object.values(noBoots)
  const data = patch ? [catalogues.get(patch)] : [...catalogues.values()]
  return [
    ...new Set(
      data
        .flatMap(c =>
          c
            ? Object.values(c.locales).flatMap(l => [
                l[kind][String(id)]?.name || '',
                kind === 'champions' && locale.value === 'zh-CN'
                  ? l[kind][String(id)]?.title || ''
                  : '',
              ])
            : [],
        )
        .filter(Boolean),
    ),
  ]
}
export function roleName(
  entry: { label: string; nameItems?: { id: string; name: string }[] },
  patch: string,
): string {
  return entry.nameItems?.length
    ? entry.nameItems.map(item => gameName('items', item.id, patch, item.name)).join(' + ')
    : entry.label
}
