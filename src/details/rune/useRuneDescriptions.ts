// 符文说明的三种来源：Wiki 英文原文、Wiki 中文译文、游戏内简要说明。
// 原文在挂载时读取；译文首次需要时再读；简要说明随版本与符文变化重新读取。
import { computed, onMounted, ref, watch } from 'vue'
import { loadDescription, type DescriptionEntry } from '@/data/tooltipData'
import {
  loadRuneDescriptions,
  matchingRuneTranslation,
  type RuneDescriptionCatalogue,
} from './runeDescriptions'
import type { DescriptionMode } from './runeDescriptionPreference'

const wikiPage = 'https://wiki.leagueoflegends.com/en-us/ARAM:_Mayhem/Augments'

export function useRuneDescriptions(runeId: () => string, patch: () => string) {
  // Wiki 英文原文
  const descriptions = ref<RuneDescriptionCatalogue | null>(null)
  const descriptionError = ref('')
  const wikiLoading = ref(false)
  async function readDescriptions() {
    descriptionError.value = ''
    wikiLoading.value = true
    try {
      descriptions.value = await loadRuneDescriptions()
    } catch {
      descriptionError.value = '英文说明暂时无法读取。'
    } finally {
      wikiLoading.value = false
    }
  }

  // Wiki 中文译文
  const translations = ref<RuneDescriptionCatalogue | null>(null)
  const translationLoading = ref(false)
  const translationError = ref('')
  async function readTranslations() {
    if (translations.value || translationLoading.value) return
    translationLoading.value = true
    translationError.value = ''
    try {
      translations.value = await loadRuneDescriptions('zh_CN')
    } catch {
      translationError.value = 'Wiki 中文译文暂时无法读取。'
    } finally {
      translationLoading.value = false
    }
  }

  // 游戏内简要说明；只采用最近一次请求的结果
  const simple = ref<DescriptionEntry | null>(null)
  const simpleLoading = ref(false)
  const simpleError = ref('')
  let simpleRequest = 0
  async function readSimple() {
    const request = ++simpleRequest
    simple.value = null
    simpleError.value = ''
    simpleLoading.value = true
    try {
      const result = await loadDescription(patch(), 'augments', runeId())
      if (request === simpleRequest) simple.value = result
    } catch {
      if (request === simpleRequest) simpleError.value = '中文说明暂时无法读取。'
    } finally {
      if (request === simpleRequest) simpleLoading.value = false
    }
  }
  watch(() => [patch(), runeId()], readSimple, { immediate: true })

  function retry(mode: DescriptionMode) {
    if (mode === 'simple') {
      void readSimple()
      return
    }
    if (mode === 'wiki' || descriptionError.value) void readDescriptions()
    if (mode === 'translation') void readTranslations()
  }

  const description = computed(() => descriptions.value?.entries[runeId()])
  const translation = computed(() =>
    matchingRuneTranslation(description.value, translations.value?.entries[runeId()]),
  )
  const sourceUrl = computed(
    () =>
      (descriptions.value?.source.url || wikiPage) +
      (description.value ? '#' + encodeURIComponent(description.value.anchor) : ''),
  )
  onMounted(readDescriptions)

  return {
    descriptions,
    translations,
    description,
    descriptionError,
    wikiLoading,
    translation,
    translationLoading,
    translationError,
    readTranslations,
    simple,
    simpleLoading,
    simpleError,
    sourceUrl,
    retry,
  }
}
