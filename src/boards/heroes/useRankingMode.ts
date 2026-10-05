// 英雄榜统计方式：按英雄（heroes）或按最强流派（roles）。
// 浏览器历史中的记录优先，其次是本地保存的偏好。
import { ref } from 'vue'

const storageKey = 'team-site.hero-ranking-mode'

function readSavedMode() {
  try {
    return localStorage.getItem(storageKey) === 'roles' ? 'roles' : 'heroes'
  } catch {
    return 'heroes'
  }
}

export function useRankingMode(historyMode?: string) {
  const mode = ref<string>(
    historyMode === 'heroes' || historyMode === 'roles' ? historyMode : readSavedMode(),
  )
  function persist() {
    try {
      localStorage.setItem(storageKey, mode.value)
    } catch {
      /* 浏览器禁用存储时仍允许切换。 */
    }
  }
  return { mode, persist }
}
