// 导航栏招牌：平面字标（中文简繁共用“海斗榜”，其他语言为 MAYHEM / RANK）。
// 字标由 python/tools/design/make_wordmark.py 生成。
// no-inline：本地 Python 服务的 CSP 不允许 data: 图片，小 SVG 也要输出为独立文件。
import { computed } from 'vue'
import { locale } from '@/i18n/locale'

const wordmark = new URL('../assets/haidou-wordmark-flat.svg?no-inline', import.meta.url).href
const wordmarkInternational = new URL(
  '../assets/mayhemrank-wordmark-flat.svg?no-inline',
  import.meta.url,
).href

export const brandImage = computed(() =>
  locale.value === 'zh-CN' || locale.value === 'zh-TW' ? wordmark : wordmarkInternational,
)
