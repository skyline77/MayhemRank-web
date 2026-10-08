// 详情展开／滚动动画期间延后渲染：桌面上 html.is-detail-moving 存在时返回 true（显示占位），
// 动画结束后再等 order 帧才变为 false，让多个区块分帧渲染，不挤在同一帧。
// 只在首次挂载时生效：内容渲染过一次后，后续动画（如切换详情）不再隐藏。
// 手机走淡入动画且一次只显示一个分类，不延后。
import { onUnmounted, ref } from 'vue'

export function useMotionDeferred(order = 0) {
  const root = globalThis.document?.documentElement
  const moving = () => !!root?.classList?.contains('is-detail-moving')
  const desktop = typeof window !== 'undefined' && window.innerWidth > 700
  const deferred = ref(desktop && moving())
  if (!deferred.value) return deferred
  let frame = 0
  function wait() {
    frame = requestAnimationFrame(() => {
      if (moving()) return wait()
      let left = order
      const step = () => {
        if (left-- <= 0) {
          frame = 0
          deferred.value = false
          return
        }
        frame = requestAnimationFrame(step)
      }
      step()
    })
  }
  wait()
  onUnmounted(() => cancelAnimationFrame(frame))
  return deferred
}
