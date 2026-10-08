<script setup lang="ts">
import { t, message } from '@/i18n/i18n'
import { gameName } from '@/i18n/gameLocalization'
import { formatCount } from '@/stats/formatCount'
import { useCompactBoard } from '@/boards/useCompactBoard'

import { matchesRuneDetailSearch, type DetailSearchIndex } from '@/details/detailSearch'
import { computed, ref, shallowRef, watch } from 'vue'
import DetailStatRow from '@/details/DetailStatRow.vue'
import { useMotionDeferred } from '@/shared/useMotionDeferred'
import DetailCardList from '@/details/DetailCardList.vue'
import BuildStatCard from '@/details/BuildStatCard.vue'
import RuneHeroChart from './RuneHeroChart.vue'
import { showRuneHeroChart } from './runeFeatures'
import { RUNE_HERO_MIN_GAMES, loadRuneHeroes, type RuneHeroes } from './runeHeroes'
import WinRateDelta from '@/details/WinRateDelta.vue'
import { winRateDelta } from '@/details/buildDetails'
import { buildDetailUrl } from '@/app/detailLink'
const panel = ref<HTMLElement | null>(null)
const compact = useCompactBoard(
  () => panel.value,
  () => {},
)
const props = defineProps<{
  gridMode?: boolean
  floatingSort?: boolean
  runeId: string
  patch: string
  snapshotId?: string
  query?: string
  searchIndex?: DetailSearchIndex | null
}>()
const emit = defineEmits<{ loaded: [meta: RuneHeroes['meta'] | null] }>()
const data = shallowRef<RuneHeroes | null>(null),
  loading = ref(false),
  error = ref('')
// 桌面展开动画期间只显示占位卡片，落位后再分帧渲染（顺序：英雄、海克斯、装备）
const deferred = useMotionDeferred(0)
const showPlaceholder = computed(() => loading.value || deferred.value)
const allEntries = computed(() =>
  (data.value?.entries || []).map(cell => ({
    ...cell,
    lowSample: cell.games <= RUNE_HERO_MIN_GAMES,
  })),
)
const entries = computed(() =>
  allEntries.value.filter(cell =>
    matchesRuneDetailSearch('heroes', cell, props.query || '', props.searchIndex || null),
  ),
)
let request = 0
async function load() {
  const token = ++request
  data.value = null
  error.value = ''
  loading.value = true
  emit('loaded', null)
  try {
    const result = await loadRuneHeroes(props.runeId, props.patch, props.snapshotId)
    if (token === request) {
      data.value = result
      emit('loaded', result.meta)
    }
  } catch (reason) {
    if (token === request)
      error.value = reason instanceof Error ? reason.message : '英雄统计暂时无法读取'
  } finally {
    if (token === request) loading.value = false
  }
}
watch(() => [props.runeId, props.patch, props.snapshotId], load, { immediate: true })
const pct = (n: number) => (n * 100).toFixed(1) + '%'
</script>
<template>
  <div
    ref="panel"
    class="rune-heroes build-detail-grid"
    :class="{ 'mobile-stat-grid': gridMode }"
    :aria-busy="loading"
  >
    <DetailStatRow
      :floating-sort="floatingSort"
      :class="{ 'mobile-tab-row': gridMode }"
      :name="t('英雄胜率与差值')"
      :label="t('英雄')"
      :cells="entries"
      default-sort="winRate"
      secondary-metric="delta"
      :secondary-label="t('Δ胜率')"
      :additional-metrics="
        compact
          ? [{ key: 'pickRate', label: '选用率' }]
          : [
              { key: 'pickRate', label: '选用率' },
              { key: 'games', label: '场次' },
            ]
      "
      :low-sample-last="RUNE_HERO_MIN_GAMES + 1"
      v-slot="{ sortedCells, sortBy }"
    >
      <DetailCardList
        :expanded="gridMode"
        :loading="showPlaceholder"
        :reset-key="JSON.stringify([runeId, patch, snapshotId, sortBy, query])"
        :item-count="sortedCells.length"
        :batch-size="20"
        tabindex="0"
        :aria-label="t('英雄统计，可左右滚动查看更多')"
        :class="{ 'is-empty': !showPlaceholder && !sortedCells.length }"
        v-slot="{ visibleCount, pageItems }"
      >
        <template v-if="showPlaceholder"
          ><div v-for="i in 10" :key="i" class="build-stat-placeholder"
        /></template>
        <template v-else>
          <BuildStatCard
            :class="{ 'low-sample-card': cell.lowSample }"
            v-for="cell in pageItems(sortedCells, gridMode ? undefined : visibleCount)"
            :key="cell.id"
            :cell="cell"
            group="heroes"
            :patch="patch"
            :baseline="0.5"
            :usage-label="
              message('Δ胜率 {p0}，样本 {p1} 场', {
                p0: winRateDelta(cell.winRate, cell.baseline.winRate),
                p1: formatCount(cell.games),
              })
            "
          >
            <template #identity
              ><a
                class="rune-hero-identity"
                :href="buildDetailUrl(Number(cell.id), '', patch, runeId)"
                target="_blank"
                rel="noopener noreferrer"
                :aria-label="
                  message('{p0}，在新页面查看选择当前符文的英雄详情', {
                    p0: gameName('champions', cell.id, patch, cell.name),
                  })
                "
                ><img :src="cell.icon" alt="" width="42" height="42" loading="lazy" /><span
                  class="build-stat-name"
                  >{{ gameName('champions', cell.id, patch, cell.name) }}</span
                ></a
              ></template
            >
            <template #usage
              ><WinRateDelta :win-rate="cell.winRate" :baseline="cell.baseline.winRate"
            /></template>
            <template #additional-stats>
              <span
                class="build-stat-usage"
                :aria-label="message('选用率 {p0}', { p0: pct(cell.pickRate) })"
                >{{ pct(cell.pickRate) }}</span
              >
              <span
                v-if="!compact"
                class="build-stat-usage"
                :aria-label="message('场次 {p0} 场', { p0: formatCount(cell.games) })"
                >{{ formatCount(cell.games) }}</span
              >
            </template>
          </BuildStatCard>
          <p v-if="error" class="build-detail-empty" role="status">
            {{ t(error) }}
            <button class="rune-description-retry" @click="load">{{ t('重试') }}</button>
          </p>
          <p v-else-if="!sortedCells.length" class="build-detail-empty" role="status">
            {{ query?.trim() ? t('没有符合搜索条件的英雄') : t('暂无选择该符文的英雄记录') }}
          </p>
        </template>
      </DetailCardList>
    </DetailStatRow>
  </div>
  <RuneHeroChart v-if="showRuneHeroChart && data" :key="runeId + patch + snapshotId" :data="data" />
</template>
<style scoped>
/* 桌面：标题到“英雄”行的距离与下方行间距一致（下方行间距含滚动条预留，约 34px） */
@media (min-width: 701px) {
  .rune-heroes > .build-detail-row:first-child {
    padding-top: 34px;
  }
}

.rune-heroes {
  --rarity: var(--silver);
  min-width: 0;
}

.rune-hero-identity {
  display: grid;
  grid-template-rows: 44px 26px;
  align-items: center;
  justify-items: center;
  width: 100%;
  min-width: 0;
}
.rune-hero-identity img {
  border-radius: 6px;
  object-fit: cover;
}
.rune-hero-identity:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
</style>
