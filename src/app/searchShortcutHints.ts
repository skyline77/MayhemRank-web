import { t } from '@/i18n/i18n'
import { nextFindTarget } from './searchShortcut'

export function updateSearchShortcutHints(root: Document = document, viewport = window) {
  const target = viewport.innerWidth > 700 ? nextFindTarget(root, viewport) : null
  for (const input of Array.from(
    root.querySelectorAll<HTMLInputElement>('input[data-site-search]'),
  )) {
    const placeholder =
      target && input === target.input
        ? target.switching
          ? t('Ctrl+F 切换搜索框')
          : t('Ctrl+F 搜索')
        : input.dataset.searchPlaceholder || ''
    if (input.placeholder !== placeholder) input.placeholder = placeholder
  }
}

export function observeSearchShortcutHints(root: Document = document, viewport = window) {
  let frame = 0
  const update = () => {
    frame = 0
    // 详情展开／收起动画期间每帧都有样式与滚动变化；此时读取布局会强制重算约 1300 个元素的样式
    // （实测每帧 7–10ms，造成掉帧）。动画进行中只等待，结束后再更新一次。
    if (root.documentElement?.classList?.contains('is-detail-moving')) {
      frame = viewport.requestAnimationFrame(update)
      return
    }
    updateSearchShortcutHints(root, viewport)
  }
  const schedule = () => {
    if (!frame) frame = viewport.requestAnimationFrame(update)
  }
  const observer = new MutationObserver(schedule)
  observer.observe(root.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: [
      'data-site-search',
      'data-search-placeholder',
      'disabled',
      'hidden',
      'style',
      'class',
    ],
  })
  root.addEventListener('focusin', schedule)
  root.addEventListener('focusout', schedule)
  root.addEventListener('scroll', schedule, true)
  viewport.addEventListener('resize', schedule)
  schedule()
  return () => {
    observer.disconnect()
    viewport.cancelAnimationFrame(frame)
    root.removeEventListener('focusin', schedule)
    root.removeEventListener('focusout', schedule)
    root.removeEventListener('scroll', schedule, true)
    viewport.removeEventListener('resize', schedule)
  }
}
