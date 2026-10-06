// 导航栏招牌图片：按语言选择；试用 UI 方案时改用平面字标（繁体沿用简体字标）。
// no-inline：本地 Python 服务的 CSP 不允许 data: 图片，小 SVG 也要输出为独立文件。
import { computed } from 'vue'
import { locale } from '@/i18n/locale'
import { skin } from '@/app/skin'

const wordmark = new URL('../assets/haidou-wordmark.webp', import.meta.url).href
const wordmarkInternational = new URL('../assets/mayhemrank-wordmark.png', import.meta.url).href
const wordmarkTraditional = new URL('../assets/haidou-tw-wordmark.png', import.meta.url).href
const flatWordmark = new URL('../assets/haidou-wordmark-flat.svg?no-inline', import.meta.url).href
const flatWordmarkInternational = new URL(
  '../assets/mayhemrank-wordmark-flat.svg?no-inline',
  import.meta.url,
).href

export const brandImage = computed(() => {
  const chinese = locale.value === 'zh-CN' || locale.value === 'zh-TW'
  if (skin.value) return chinese ? flatWordmark : flatWordmarkInternational
  if (locale.value === 'zh-CN') return wordmark
  return locale.value === 'zh-TW' ? wordmarkTraditional : wordmarkInternational
})
