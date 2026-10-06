// 分步显示统计行：数据就绪后，从下一帧开始每帧换出一行真实卡片，其余行保持加载占位。
// 即使数据在组件挂载前就已就绪（提前请求或缓存），挂载那一帧也只渲染占位。
// 占位与卡片同高，详情高度和最终画面都不变；只是把一帧内生成全部卡片的工作
// 分摊到多帧，减少展开动画中的长时间停顿。
import { onUnmounted, ref, watch } from 'vue'

export function useStagedRows(ready: () => boolean, total: number) {
  const shown = ref(ready() ? total : 0)
  let frame = 0
  function revealNext() {
    frame = requestAnimationFrame(() => {
      frame = 0
      shown.value++
      if (shown.value < total) revealNext()
    })
  }
  watch(ready, value => {
    cancelAnimationFrame(frame)
    frame = 0
    shown.value = 0
    if (value) revealNext()
  })
  onUnmounted(() => cancelAnimationFrame(frame))
  /** 第 index 行是否仍显示加载占位 */
  return (index: number) => index >= shown.value
}
