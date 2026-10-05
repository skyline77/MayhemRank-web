import { ref, nextTick } from 'vue'
export const locales = ['zh-CN', 'zh-TW', 'ja-JP', 'en-US'] as const
export type Locale = (typeof locales)[number]
export const localeNames: Record<Locale, string> = {
  'zh-CN': '简',
  'zh-TW': '繁',
  'ja-JP': '日',
  'en-US': 'En',
}
export const brands: Record<Locale, string> = {
  'zh-CN': '海斗榜',
  'zh-TW': '海鬥榜',
  'ja-JP': 'MayhemRank',
  'en-US': 'MayhemRank',
}
export const upstreamLocales: Record<Locale, { ddragon: string; cdragon: string }> = {
  'zh-CN': { ddragon: 'zh_CN', cdragon: 'zh_cn' },
  'zh-TW': { ddragon: 'zh_TW', cdragon: 'zh_tw' },
  'ja-JP': { ddragon: 'ja_JP', cdragon: 'ja_jp' },
  'en-US': { ddragon: 'en_US', cdragon: 'default' },
}
export function resolveLocale(saved: string | null, languages: readonly string[]): Locale {
  if (locales.includes(saved as Locale)) return saved as Locale
  for (const value of languages) {
    const tag = value.toLowerCase().replaceAll('_', '-')
    if (tag.startsWith('zh')) return /(?:tw|hk|mo|hant)/.test(tag) ? 'zh-TW' : 'zh-CN'
    if (tag.startsWith('ja')) return 'ja-JP'
    if (tag.startsWith('en')) return 'en-US'
  }
  return 'en-US'
}
function initial() {
  let saved: string | null = null
  try {
    saved = localStorage.getItem('mayhem.locale')
  } catch {
    /* 存储不可用时仍支持本次切换。 */
  }
  return resolveLocale(saved, typeof navigator === 'undefined' ? [] : navigator.languages)
}
export const locale = ref<Locale>(initial())
export async function setLocale(value: Locale) {
  if (!locales.includes(value)) return
  const x = window.scrollX,
    y = window.scrollY
  locale.value = value
  document.documentElement.lang = value
  try {
    localStorage.setItem('mayhem.locale', value)
  } catch {
    /* 不影响当前页面。 */
  }
  await nextTick()
  window.dispatchEvent(new Event('resize'))
  window.scrollTo({ left: x, top: y, behavior: 'instant' })
}
