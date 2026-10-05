// 全站键盘快捷键：Ctrl/Command+F 进入站内搜索，Escape 收起近期改动或关闭详情；
// 同时根据当前可用的搜索框更新快捷键提示。
import { onMounted, onUnmounted } from 'vue'
import { closeTip } from '@/tooltip/tooltip'
import { cancelDetailTransition } from '@/details/detailScroll'
import { handleFindShortcut, handleDetailEscape } from './searchShortcut'
import { observeSearchShortcutHints } from './searchShortcutHints'

export function useGlobalShortcuts() {
  let stopSearchHints: (() => void) | undefined
  onMounted(() => {
    stopSearchHints = observeSearchShortcutHints()
  })
  onUnmounted(() => stopSearchHints?.())

  const onFind = (event: KeyboardEvent) => handleFindShortcut(event, cancelDetailTransition)
  // 捕获阶段处理 Escape，优先于各组件自己的处理
  const onEscape = (event: KeyboardEvent) => handleDetailEscape(event, closeTip)
  onMounted(() => {
    window.addEventListener('keydown', onFind)
    window.addEventListener('keydown', onEscape, true)
  })
  onUnmounted(() => {
    window.removeEventListener('keydown', onFind)
    window.removeEventListener('keydown', onEscape, true)
  })
}
