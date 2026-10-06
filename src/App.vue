<script setup lang="ts">
// 应用外壳：顶部导航、三个榜单之间的站内切换、全局浮窗与快捷键。
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { locale } from './i18n/locale'
import { t } from './i18n/i18n'
import { useGameLocale } from './i18n/useGameLocale'
import { loadVersions } from './data/versions'
import { restoreHistoryPatch, useSiteRouting } from './app/useSiteRouting'
import { useGlobalShortcuts } from './app/useGlobalShortcuts'
import { useDocumentTitle } from './app/useDocumentTitle'
import InfoTooltip from './tooltip/InfoTooltip.vue'
import { closeTip } from './tooltip/tooltip'
import { observeDetailVisibility } from './details/detailVisibility'
import BuildBoard from './boards/heroes/BuildBoard.vue'
import AugmentBoard from './boards/augments/AugmentBoard.vue'
import ComboBoards from './boards/combos/ComboBoards.vue'
import BoardNavigation from './navigation/BoardNavigation.vue'
import SkinSwitcher from './app/SkinSwitcher.vue'
import { applySkin, skin } from './app/skin'

restoreHistoryPatch()
const siteRoot = ref<HTMLElement | null>(null)
let stopDetailVisibility: (() => void) | undefined
onMounted(() => {
  if (siteRoot.value) stopDetailVisibility = observeDetailVisibility(siteRoot.value)
})
onUnmounted(() => stopDetailVisibility?.())

// ---- 站内路由 ----
const { destination, page, routeKey, pageHref, changePage, listen } = useSiteRouting()
const comboPage = computed(() => page.value === 'combos')
const runePage = computed(() => page.value === 'augments')

document.documentElement.dataset.theme = localStorage.getItem('team-theme') || 'dark'
applySkin(skin.value)
onMounted(() => {
  void loadVersions().catch(() => {})
})
useDocumentTitle(destination, () =>
  t(comboPage.value ? '组合榜' : runePage.value ? '海克斯榜' : '英雄榜'),
)
watch(locale, closeTip)
const { error: languageError, refresh: refreshLanguage } = useGameLocale()

// 挂载顺序与改前一致：先读取版本目录，再恢复浏览器历史、监听前进／后退，最后安装快捷键
listen()
useGlobalShortcuts()
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
    <SkinSwitcher />
  </main>
</template>
