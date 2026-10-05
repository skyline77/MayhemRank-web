import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { cancelDetailTransition, preserveDetailPosition } from '@/details/detailScroll'

// Both boards regroup visual strips at the same CSS breakpoint. Keep the
// selected detail anchored while its strip changes, without reloading data.
export function useCompactBoard(
  panel: () => HTMLElement | null,
  onLayoutChange: () => void,
  breakpoint = 700,
) {
  const viewport = window.matchMedia(`(max-width:${breakpoint}px)`)
  const compact = ref(viewport.matches)
  async function update() {
    cancelDetailTransition()
    await preserveDetailPosition(panel, async () => {
      compact.value = viewport.matches
      onLayoutChange()
      await nextTick()
    })
  }
  onMounted(() => viewport.addEventListener('change', update))
  onUnmounted(() => viewport.removeEventListener('change', update))
  return compact
}
