import { watch, type WatchSource } from 'vue'
import { brands, locale } from '@/i18n/locale'

/** 页面标题为“品牌 - 当前内容”；在 source 或界面语言变化时更新。 */
export function useDocumentTitle(source: WatchSource, content: () => string) {
  watch(
    [source, locale],
    () => {
      document.title = brands[locale.value] + ' - ' + content()
    },
    { immediate: true },
  )
}
