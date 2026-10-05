// 游戏内名称（英雄、符文、装备）按版本加载对应语言资源；失败时提供重试。
import { ref, watch } from 'vue'
import { selectedPatch } from '@/data/versions'
import { loadGameLocale } from './gameLocalization'

export function useGameLocale() {
  const error = ref('')
  let request = 0
  async function refresh() {
    const current = ++request,
      patch = selectedPatch.value
    error.value = ''
    if (!patch) return
    try {
      await loadGameLocale(patch)
    } catch {
      if (current === request) error.value = '语言资源加载失败'
    }
  }
  watch(selectedPatch, refresh, { immediate: true })
  return { error, refresh }
}
