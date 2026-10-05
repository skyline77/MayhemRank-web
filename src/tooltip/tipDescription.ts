// 浮窗正文：符文在详情中可显示 Wiki 说明（简中界面用译文，其他语言用英文原文），
// 其余情况读取对应版本的游戏内说明。
import { loadDescription, type DescriptionEntry } from '@/data/tooltipData'
import { loadRuneDescriptions, matchingRuneTranslation } from '@/details/rune/runeDescriptions'
import type { TipData } from './tooltip'

export async function loadTipDescription(
  tip: TipData,
  locale: () => string,
): Promise<DescriptionEntry | null> {
  if (tip.kind !== 'augments' || !tip.wikiTranslation)
    return loadDescription(tip.patch, tip.kind, tip.id)
  const [wiki, translated] = await Promise.all([
    loadRuneDescriptions(),
    loadRuneDescriptions('zh_CN'),
  ])
  const entry =
    locale() === 'zh-CN'
      ? matchingRuneTranslation(wiki.entries[tip.id], translated.entries[tip.id])
      : wiki.entries[tip.id]
  return entry ? { name: entry.name, description: entry.description, unresolved: false } : null
}
