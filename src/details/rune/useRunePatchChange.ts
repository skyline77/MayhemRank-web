// 符文详情标题旁的“较上版本”：读取上一个可比较版本中同一符文的胜率。
import { computed, ref, watch } from 'vue'
import { loadVersions } from '@/data/versions'
import { loadRuneBoard, type RuneEntry } from '@/boards/augments/augmentBoard'
import { previousRunePatch, runePatchChange } from '@/boards/augments/runeComparison'

export function useRunePatchChange(entry: () => RuneEntry, patch: () => string) {
  const previous = ref<RuneEntry | null>(null)
  const comparisonPatch = ref('')
  watch(
    () => [patch(), entry().id],
    async (_, __, onCleanup) => {
      let stale = false
      onCleanup(() => {
        stale = true
      })
      previous.value = null
      comparisonPatch.value = ''
      try {
        const manifest = await loadVersions()
        const previousPatch = previousRunePatch(
          patch(),
          manifest.patches.map(p => p.patch),
        )
        if (!previousPatch) return
        const board = await loadRuneBoard(previousPatch)
        if (!stale) {
          comparisonPatch.value = previousPatch
          previous.value = board.entries.find(e => e.id === entry().id) || null
        }
      } catch {
        /* 上一版本快照不可用时不显示对比。 */
      }
    },
    { immediate: true },
  )
  const change = computed(() =>
    previous.value ? runePatchChange(entry().winRate, previous.value.winRate) : null,
  )
  return { comparisonPatch, change }
}
