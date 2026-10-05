<script setup lang="ts">
import { locale, brands } from './i18n/locale'
import { loadGameLocale } from './i18n/gameLocalization'
import { t } from './i18n/i18n'
import { selectedPatch, selectedVersion, defaultVersion, loadVersions } from './data/versions'
import { dataPatch } from './data/versionSelection'
import {
  readHistorySection,
  registerHistorySection,
  saveView,
  preparePageHistory,
  installPageHistory,
} from './app/pageHistory'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { boardLink } from './app/detailLink'
import InfoTooltip from './tooltip/InfoTooltip.vue'
import { handleFindShortcut, handleDetailEscape } from './app/searchShortcut'
import { observeSearchShortcutHints } from './app/searchShortcutHints'
import { closeTip } from './tooltip/tooltip'
import { cancelDetailTransition } from './details/detailScroll'
import { observeDetailVisibility } from './details/detailVisibility'
import BuildBoard from './boards/heroes/BuildBoard.vue'
import AugmentBoard from './boards/augments/AugmentBoard.vue'
import ComboBoards from './boards/combos/ComboBoards.vue'
import BoardNavigation from './navigation/BoardNavigation.vue'
const savedPatch = readHistorySection<{ patch: string }>('app')
if (savedPatch?.patch) {
  selectedVersion.value = savedPatch.patch
  selectedPatch.value = dataPatch(savedPatch.patch)
}
onUnmounted(registerHistorySection('app', () => ({ patch: selectedVersion.value })))
const siteRoot = ref<HTMLElement | null>(null)
let stopDetailVisibility: (() => void) | undefined
onMounted(() => {
  if (siteRoot.value) stopDetailVisibility = observeDetailVisibility(siteRoot.value)
})
onUnmounted(() => stopDetailVisibility?.())
const detailQuery = new URLSearchParams(location.search)
const destination = ref(boardLink(location.search))
const routeKey = ref(0)
const comboPage = computed(() => destination.value.page === 'combos')
const runePage = computed(() => destination.value.page === 'augments')
if (
  (destination.value.champion || destination.value.rune) &&
  detailQuery.get('page') !== destination.value.page
) {
  detailQuery.set('page', destination.value.page)
  history.replaceState(history.state, '', location.pathname + '?' + detailQuery + location.hash)
}
const pageHref = (page: string) => {
  const params = new URLSearchParams()
  if (page !== 'heroes') params.set('page', page)
  if (
    selectedVersion.value &&
    (page !== 'heroes' || selectedVersion.value !== defaultVersion.value)
  )
    params.set('patch', selectedVersion.value)
  return '/' + (params.size ? '?' + params : '')
}
document.documentElement.dataset.theme = localStorage.getItem('team-theme') || 'dark'
onMounted(() => {
  void loadVersions().catch(() => {})
})
watch(
  [destination, locale],
  () => {
    document.title =
      brands[locale.value] +
      ' - ' +
      t(comboPage.value ? '组合榜' : runePage.value ? '海克斯榜' : '英雄榜')
  },
  { immediate: true },
)
watch(locale, closeTip)
const languageError = ref('')
let languageRequest = 0
async function refreshLanguage() {
  const request = ++languageRequest,
    patch = selectedPatch.value
  languageError.value = ''
  if (!patch) return
  try {
    await loadGameLocale(patch)
  } catch {
    if (request === languageRequest) languageError.value = '语言资源加载失败'
  }
}
watch(selectedPatch, refreshLanguage, { immediate: true })
let stopHistoryRestore: (() => void) | undefined
let routeSerial = 0
async function changePage(href?: string) {
  const serial = ++routeSerial
  closeTip()
  cancelDetailTransition()
  stopHistoryRestore?.()
  if (href) {
    saveView()
    history.pushState({}, '', href)
  }
  preparePageHistory(!href)
  const patch = new URLSearchParams(location.search).get('patch') || defaultVersion.value
  if (patch) {
    selectedVersion.value = patch
    selectedPatch.value = dataPatch(patch)
  }
  destination.value = boardLink(location.search)
  routeKey.value++
  await nextTick()
  if (serial !== routeSerial) return
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  stopHistoryRestore = installPageHistory()
  window.dispatchEvent(new Event('resize'))
}
const popPage = () => void changePage()
onMounted(() => {
  stopHistoryRestore = installPageHistory()
  window.addEventListener('popstate', popPage)
})
onUnmounted(() => {
  window.removeEventListener('popstate', popPage)
  stopHistoryRestore?.()
})
let stopSearchHints: (() => void) | undefined
onMounted(() => {
  stopSearchHints = observeSearchShortcutHints()
})
onUnmounted(() => stopSearchHints?.())
const onFind = (event: KeyboardEvent) => handleFindShortcut(event, cancelDetailTransition)
const onEscape = (event: KeyboardEvent) => handleDetailEscape(event, closeTip)
onMounted(() => {
  window.addEventListener('keydown', onFind)
  window.addEventListener('keydown', onEscape, true)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onFind)
  window.removeEventListener('keydown', onEscape, true)
})
</script>
<template>
  <main ref="siteRoot" :data-board="destination.page">
    <p v-if="languageError" role="alert">
      {{ t(languageError) }} <button @click="refreshLanguage">{{ t('重试') }}</button>
    </p>
    <BoardNavigation @navigate="changePage"
      ><a :href="pageHref('heroes')" :aria-current="!runePage && !comboPage ? 'page' : undefined"
        ><span>{{ t('英雄榜') }}</span></a
      ><a :href="pageHref('augments')" :aria-current="runePage ? 'page' : undefined"
        ><span>{{ t('海克斯榜') }}</span></a
      ><a :href="pageHref('combos')" :aria-current="comboPage ? 'page' : undefined"
        ><span>{{ t('组合榜') }}</span></a
      ></BoardNavigation
    >
    <div class="shared-board-background" aria-hidden="true">
      <div class="shared-board-art">
        <div class="board-vignette-blend">
          <span class="board-vignette board-vignette-heroes"></span
          ><span class="board-vignette board-vignette-augments"></span
          ><span class="board-vignette board-vignette-combos"></span>
        </div>
      </div>
    </div>
    <ComboBoards v-if="comboPage" :key="routeKey" />
    <AugmentBoard v-else-if="runePage" :key="routeKey" />
    <BuildBoard v-else :key="routeKey" />
    <InfoTooltip />
  </main>
</template>
