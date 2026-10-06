import { locale } from '@/i18n/locale'
import { ref, watch } from 'vue'
import { loadPatchNotes, recentPatches, type PatchKind } from './patchNotes'

// 近期改动只决定详情底部区块是否显示，等浏览器空闲再读取，
// 避免与首屏卡片、图标争用连接。读取过一次后有缓存，空闲等待很短。
function whenIdle() {
  return new Promise<void>(resolve =>
    'requestIdleCallback' in window
      ? requestIdleCallback(() => resolve(), { timeout: 2000 })
      : setTimeout(resolve, 200),
  )
}

export function usePatchAvailability(
  kind: PatchKind,
  entityId: () => string | number,
  patch: () => string,
) {
  const available = ref<boolean | null>(null)
  watch(
    () => [entityId(), patch(), locale.value] as const,
    async ([id, version], _, onCleanup) => {
      let stale = false
      onCleanup(() => {
        stale = true
      })
      available.value = null
      await whenIdle()
      if (stale) return
      try {
        const data = await loadPatchNotes()
        if (!stale) available.value = recentPatches(data, kind, id, version).length > 0
      } catch {
        /* Unknown is not empty: allow opening the panel to retry a failed request. */
      }
    },
    { immediate: true },
  )
  return available
}
