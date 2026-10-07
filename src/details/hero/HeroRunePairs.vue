<script setup lang="ts">
import { gameName } from '@/i18n/gameLocalization'
import { t } from '@/i18n/i18n'

import { computed, inject, onUnmounted, ref, watch } from 'vue'
import DetailStatRow from '@/details/DetailStatRow.vue'
import DetailCardList from '@/details/DetailCardList.vue'
import BuildStatCard from '@/details/BuildStatCard.vue'
import { augmentIcon, needsGoldTint } from '@/data/augmentIcons'
import {
  loadHeroRunePairs,
  matchesRunePair,
  type HeroRunePair,
  type HeroRunePairs,
} from './heroRunePairs'
import { showTip, hideTip, toggleTip, type TipData } from '@/tooltip/tooltip'
import type { DetailCell } from '@/details/buildDetails'
import type { DetailSearchIndex } from '@/details/detailSearch'
const filterRune = inject<(rune: HeroRunePair['runes'][number]) => void>('filter-hero-rune')
const windowWidth = window.innerWidth
const props = defineProps<{
  runeCells?: DetailCell[]
  showDelta?: boolean
  floatingSort?: boolean
  championId: number
  patch: string
  snapshotId?: string
  locked: boolean
  query: string
  searchIndex: DetailSearchIndex | null
  /** 由父组件分步显示控制：为 true 时即使数据已到也先显示占位 */
  deferred?: boolean
}>()
const data = ref<HeroRunePairs | null>(null),
  loading = ref(true),
  error = ref('')
let requestId = 0
async function load() {
  const request = ++requestId
  loading.value = true
  error.value = ''
  data.value = null
  try {
    if (!props.snapshotId) throw new Error('当前版本尚无海克斯组合快照')
    const value = await loadHeroRunePairs(props.championId, props.patch, props.snapshotId)
    if (request === requestId) data.value = value
  } catch (e) {
    if (request === requestId)
      error.value = e instanceof Error ? e.message : '海克斯组合暂时无法读取'
  } finally {
    if (request === requestId) loading.value = false
  }
}
watch(
  () => [props.championId, props.patch, props.snapshotId],
  () => void load(),
  { immediate: true },
)
onUnmounted(() => {
  ++requestId
})
const scope = computed(() => [props.championId, props.patch, props.snapshotId].join(':'))
function matches(cell: HeroRunePair) {
  return matchesRunePair(cell, props.query, props.searchIndex)
}
function visible(cells: readonly HeroRunePair[]) {
  return props.locked || !props.query.trim() ? cells : cells.filter(matches)
}
function runeTip(rune: HeroRunePair['runes'][number]): TipData {
  const stats = props.runeCells?.find(cell => cell.id === rune.id)
  return {
    onFilter: filterRune ? () => filterRune(rune) : undefined,
    id: rune.id,
    name: rune.name,
    kind: 'augments',
    icon: augmentIcon(rune.id, props.patch, rune.icon),
    patch: props.patch,
    rarity: rune.rarity,
    winRate: stats?.winRate ?? 0,
    pickRate: stats?.pickRate ?? 0,
    games: stats?.games ?? 0,
    rawWinRate: stats?.rawWinRate ?? 0,
    interval: stats?.interval ?? [],
    lowSample: stats?.lowSample,
    baseline: data.value?.baseline.winRate ?? 0.5,
    context: t('该英雄全部出场'),
    baselineLabel: t('该英雄全部出场'),
    wikiTranslation: true,
    preferredSide: 'below',
    missingStatistics: stats ? undefined : t('当前范围无记录'),
  }
}
function revealRune(event: Event, rune: HeroRunePair['runes'][number]) {
  if (event.type === 'mouseenter' && window.matchMedia('(hover:none)').matches) return
  showTip(event, runeTip(rune))
}
</script>
<template>
  <div class="hero-rune-pairs">
    <DetailStatRow
      :floating-sort="floatingSort"
      :class="{ 'mobile-tab-row': floatingSort }"
      :sync-win-rate-delta="showDelta"
      :key="scope"
      :label="t('海克斯\n组合')"
      :name="t('海克斯组合')"
      class="rune-pairs"
      default-sort="winRate"
      :cells="data?.entries || []"
      :locked="locked"
      :low-sample-last="51"
      v-slot="{ sortedCells, sortBy }"
    >
      <DetailCardList
        :loading="loading || deferred"
        :class="{ 'is-empty': !loading && !deferred && !visible(sortedCells).length }"
        :reset-key="scope + (locked ? '' : query) + sortBy"
        :match-key="locked && query.trim() ? query : undefined"
        :match-revision="sortedCells"
        :batch-size="Math.ceil(windowWidth / 120) + 1"
        :item-count="visible(sortedCells).length"
        v-slot="{ visibleCount, pageItems }"
        tabindex="0"
        :aria-label="t('海克斯组合，可左右滚动查看全部')"
      >
        <template v-if="loading || deferred"
          ><div v-for="i in 8" :key="i" class="build-stat-placeholder"></div
        ></template>
        <template v-else>
          <BuildStatCard
            :show-delta="showDelta"
            v-for="cell in pageItems(
              visible(sortedCells),
              locked && query.trim() ? undefined : visibleCount,
            )"
            :key="cell.id"
            :cell="cell"
            group="rune-pairs"
            :patch="patch"
            :baseline="data?.baseline.winRate"
            :data-search-match="locked && matches(cell) ? 'true' : undefined"
            :class="{ 'search-mismatch': locked && !matches(cell) }"
            :comparison="t('与该英雄全部出场胜率比较')"
          >
            <template #identity
              ><span class="rune-pair-identity">
                <button
                  v-for="rune in cell.runes"
                  :key="rune.id"
                  type="button"
                  class="rune-pair-member"
                  :aria-label="gameName('augments', rune.id, patch, rune.name)"
                  @mouseenter="revealRune($event, rune)"
                  @mouseleave="hideTip()"
                  @focus="revealRune($event, rune)"
                  @blur="hideTip()"
                  @click.stop="toggleTip($event, runeTip(rune))"
                >
                  <img
                    :src="augmentIcon(rune.id, patch, rune.icon)"
                    :class="{ 'augment-gold-fallback': needsGoldTint(rune.id, patch, rune.rarity) }"
                    alt=""
                    width="28"
                    height="28"
                    loading="lazy"
                  />
                  <span class="build-stat-name">{{
                    gameName('augments', rune.id, patch, rune.name)
                  }}</span>
                </button>
              </span></template
            >
          </BuildStatCard>
          <p v-if="error" class="build-detail-empty" role="alert">
            {{ t(error) }} <button class="board-retry" @click="load">{{ t('重试') }}</button>
          </p>
          <p v-else-if="!visible(sortedCells).length" class="build-detail-empty" role="status">
            {{ query.trim() ? t('没有符合搜索条件的海克斯组合') : t('暂无超过 50 场的海克斯组合') }}
          </p>
        </template>
      </DetailCardList>
    </DetailStatRow>
  </div>
</template>
<style scoped>
.hero-rune-pairs {
  min-width: 0;
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
}
.rune-pairs {
  --rarity: var(--prismatic);
  --rune-pair-width: calc(var(--detail-card-width) * 1.5 + var(--detail-card-gap) / 2);
}
.rune-pairs :deep(.build-detail-rail) {
  background: linear-gradient(
    135deg,
    var(--prismatic) 0%,
    var(--gold) 50%,
    var(--rune-pair-blue) 100%
  );
}
.rune-pairs :deep(.build-detail-sort) {
  background: color-mix(in srgb, var(--rail-shade) 16%, transparent);
}
.rune-pairs :deep(.build-detail-cards) {
  grid-auto-columns: var(--rune-pair-width);
}
.rune-pairs :deep(.build-stat-card),
.rune-pairs :deep(.build-stat-placeholder) {
  --stat-card-width: var(--rune-pair-width);
  width: var(--rune-pair-width);
}
/* 组合卡片没有居中的单个图标，统计行始终以实际卡片宽度为准。 */
.rune-pairs :deep(.build-stat-card .build-stat-result),
.rune-pairs :deep(.build-stat-card .build-stat-usage) {
  justify-content: center;
  text-align: center;
  padding-inline: 2px;
}
.rune-pair-identity {
  display: grid;
  grid-template-rows: repeat(2, 32px);
  width: 100%;
  padding: 0 4px;
}
.rune-pair-member {
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.rune-pair-member:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.rune-pair-member img {
  flex: none;
  object-fit: contain;
}
.rune-pair-member .build-stat-name {
  min-width: 0;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.search-mismatch {
  filter: grayscale(1);
  opacity: 0.32;
}
</style>
