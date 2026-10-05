// 读取“上一个可比较版本”的榜单，用于卡片上的胜率趋势标记。
// 历史数据缺失或读取失败时保持为空，不影响当前榜单。
import { onUnmounted, ref, shallowRef } from 'vue'
import { loadVersions } from '@/data/versions'
import { previousRunePatch } from './augments/runeComparison'

export function usePreviousPatch<T>(loadBoard: (patch: string) => Promise<T>) {
  /** 上一版本的榜单数据 */
  const board = shallowRef<T | null>(null)
  /** board 对应的“当前”版本；与当前榜单版本不一致时不应使用 board */
  const comparedWith = ref('')
  let serial = 0
  onUnmounted(() => serial++)

  async function load(patch: string) {
    const current = ++serial
    board.value = null
    comparedWith.value = ''
    try {
      const manifest = await loadVersions()
      const previous = previousRunePatch(
        patch,
        manifest.patches.map(row => row.patch),
      )
      if (!previous) return
      const value = await loadBoard(previous)
      if (current !== serial) return
      board.value = value
      comparedWith.value = patch
    } catch {
      /* 没有可比较的历史快照时不显示趋势标记。 */
    }
  }

  return { board, comparedWith, load }
}
