// 手机英雄详情的流派下拉菜单（<details>）：打开 200ms 下滑淡入，关闭 160ms 反向淡出。
// 退出动画结束后才真正关闭 details；支持快速反向切换、点击外部关闭与减少动态效果。
import { onMounted, onUnmounted, ref } from 'vue'

export function useMobileRoleMenu() {
  const menu = ref<HTMLDetailsElement | null>(null)
  let animation: Animation | null = null,
    targetOpen = false

  function setOpen(open: boolean) {
    const element = menu.value,
      panel = element?.querySelector<HTMLElement>('.mobile-role-options')
    if (!element || !panel || (targetOpen === open && element.open === open)) return
    targetOpen = open
    // 从当前画面状态接续，反向切换时不跳变
    const previous = element.open ? getComputedStyle(panel) : null
    const start = {
      opacity: previous?.opacity || '0',
      transform:
        previous?.transform === 'none'
          ? 'translateY(0px)'
          : previous?.transform || 'translateY(-8px)',
    }
    animation?.cancel()
    animation = null
    if (matchMedia('(prefers-reduced-motion:reduce)').matches) {
      element.open = open
      return
    }
    element.open = true
    const current = panel.animate(
      [
        start,
        { opacity: open ? '1' : '0', transform: open ? 'translateY(0px)' : 'translateY(-8px)' },
      ],
      { duration: open ? 200 : 160, easing: 'cubic-bezier(.2,0,0,1)', fill: 'both' },
    )
    animation = current
    current.onfinish = () => {
      if (animation !== current) return
      element.open = open
      current.cancel()
      animation = null
    }
  }
  const close = () => setOpen(false)
  const toggle = () => setOpen(!targetOpen)
  /** Escape：关闭并把焦点还给菜单按钮 */
  function escape() {
    close()
    menu.value?.querySelector('summary')?.focus()
  }
  function outside(event: PointerEvent) {
    if (!menu.value?.contains(event.target as Node)) close()
  }
  onMounted(() => document.addEventListener('pointerdown', outside))
  onUnmounted(() => {
    animation?.cancel()
    document.removeEventListener('pointerdown', outside)
  })

  return { menu, close, toggle, escape }
}
