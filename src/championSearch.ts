import { locale } from './locale'
// Full pinyin and first-letter aliases precomputed with pypinyin 0.55.0 from Chinese names/titles
// and frozen-board display names; includes Kayle legacy title and LeBlanc name reading.
// Search-only identity metadata; Chinese names/titles and pinyin only.
// English names, titles and internal aliases are excluded.
// Source: CommunityDragon 16.19 champion-summary.json (zh_cn and default).
// plugins_rcp-be-lol-game-data_global_zh_cn_v1_champion-summary.json: sha256 44f882ab55373673f2c8420511bd8cc9e5bad3c3b0740c7d3ec0e8d33fcd75b2
// plugins_rcp-be-lol-game-data_global_default_v1_champion-summary.json: sha256 5c82d944fbdb8b227bfaa2f495fb7af078726d786356e0c4a0a07cf405508c89
// Priority: name Chinese/full pinyin/initials (0–2), title equivalents (3–5).
import fields from './generated/championSearchFields.json'
export const championSearchFields = fields as unknown as Record<
  string,
  readonly (readonly [string, number])[]
>

const championSearch: Record<string, string[]> = Object.fromEntries(
  Object.entries(championSearchFields).map(([id, fields]) => [id, fields.map(([value]) => value)]),
)
export default championSearch

export function localizedChampionSearchFields(id: string) {
  return (championSearchFields[id] || []).filter(
    ([, priority]) => locale.value === 'zh-CN' || priority < 3,
  )
}
