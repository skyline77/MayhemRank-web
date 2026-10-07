<script setup lang="ts">
import { t, message } from '@/i18n/i18n'
import { formatCount } from '@/stats/formatCount'

import { matchesRuneDetailSearch, type DetailSearchIndex } from '@/details/detailSearch'
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import DetailStatRow from '@/details/DetailStatRow.vue'
import DetailCardList from '@/details/DetailCardList.vue'
import BuildStatCard from '@/details/BuildStatCard.vue'
import {
  loadRuneSynergies,
  RUNE_SYNERGY_MIN_GAMES,
  type RuneSynergies,
  type RuneSynergy,
  type SynergyKind,
} from './runeSynergies'
import { winRateColor } from '@/stats/winRateColor'
import { winRateDelta } from '@/details/buildDetails'
import type { TipData } from '@/tooltip/tooltip'
const panel = ref<HTMLElement | null>(null)
const props = defineProps<{
  gridMode?: boolean
  floatingSort?: boolean
  runeId: string
  patch: string
  snapshotId?: string
  query?: string
  searchIndex?: DetailSearchIndex | null
  kind: SynergyKind
}>()
const emit = defineEmits<{ loaded: [meta: RuneSynergies['meta'] | null] }>()
const data = shallowRef<RuneSynergies | null>(null),
  loading = ref(false),
  error = ref('')
const allEntries = computed(() =>
  (data.value?.[props.kind].entries || []).map(e => ({
    ...e,
    lowSample: e.games < RUNE_SYNERGY_MIN_GAMES,
  })),
)
const label = computed(() => (props.kind === 'augments' ? '符文' : '装备'))
const entries = computed(() =>
  allEntries.value.filter(cell =>
    matchesRuneDetailSearch(props.kind, cell, props.query || '', props.searchIndex || null),
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
    const result = await loadRuneSynergies(props.runeId, props.patch, props.snapshotId)
    if (token === request) {
      data.value = result
      emit('loaded', result.meta)
    }
  } catch (reason) {
    if (token === request)
      error.value = reason instanceof Error ? reason.message : '联动统计暂时无法读取'
  } finally {
    if (token === request) loading.value = false
  }
}
watch(() => [props.runeId, props.patch, props.snapshotId], load, { immediate: true })
onBeforeUnmount(() => {
  ++request
})
const pct = (n: number) => (n * 100).toFixed(1) + '%'
function tip(cell: RuneSynergy): TipData {
  return {
    ...cell,
    kind: props.kind,
    patch: props.patch,
    baseline: cell.baselineWinRate,
    baselineLabel: t('英雄占比加权基准'),
    context: '按组合中的英雄占比校正；历史关联，不代表因果收益',
    pickLabel: '选用率',
    statisticsNote: message(
      '校正基准 {baseline}。覆盖 {heroes} 位英雄，按共同出场占比加权。{note}差值是历史关联，不代表因果收益。',
      {
        baseline: pct(cell.baselineWinRate),
        heroes: formatCount(cell.heroCount),
        note: cell.lowSample ? t('不足 50 场，样本较少。') : '',
      },
    ),
  }
}
</script>
<template>
  <div
    ref="panel"
    class="rune-synergies build-detail-grid"
    :class="{ 'mobile-stat-grid': gridMode }"
    :data-synergy-kind="kind"
    :aria-busy="loading"
  >
    <DetailStatRow
      :floating-sort="floatingSort"
      :class="{ 'mobile-tab-row': gridMode }"
      :name="message('{p0}联动胜率与差值', { p0: label })"
      :label="label"
      :cells="entries"
      default-sort="winRate"
      secondary-metric="delta"
      :secondary-label="t('综合Δ')"
      :additional-metrics="[{ key: 'games', label: '场次' }]"
      :low-sample-last="RUNE_SYNERGY_MIN_GAMES"
      v-slot="{ sortedCells, sortBy }"
    >
      <DetailCardList
        :expanded="gridMode"
        :loading="loading"
        :reset-key="JSON.stringify([runeId, patch, snapshotId, sortBy, query])"
        :item-count="sortedCells.length"
        :batch-size="20"
        tabindex="0"
        :aria-label="message('{p0}联动，可左右滚动查看更多', { p0: label })"
        :class="{ 'is-empty': !loading && !sortedCells.length }"
        v-slot="{ visibleCount, pageItems }"
      >
        <template v-if="loading"
          ><div v-for="i in 10" :key="i" class="build-stat-placeholder"
        /></template>
        <template v-else>
          <BuildStatCard
            tap-for-tip
            v-for="cell in pageItems(sortedCells, gridMode ? undefined : visibleCount)"
            :key="cell.id"
            :cell="cell"
            :group="kind === 'items' ? 'items' : cell.rarity!"
            :patch="patch"
            :baseline="0.5"
            :tip="tip(cell)"
            :usage-label="
              message('综合 Δ胜率 {p0}，共同出场 {p1} 次', {
                p0: winRateDelta(cell.winRate, cell.baselineWinRate),
                p1: formatCount(cell.games),
              })
            "
          >
            <template #usage
              ><span :style="{ color: winRateColor(cell.delta, 0) }">{{
                winRateDelta(cell.winRate, cell.baselineWinRate)
              }}</span></template
            >
            <template #additional-stats
              ><span
                class="build-stat-usage"
                :aria-label="message('共同出场 {p0} 次', { p0: formatCount(cell.games) })"
                >{{ formatCount(cell.games) }}</span
              ></template
            >
          </BuildStatCard>
          <p v-if="error" class="build-detail-empty" role="status">
            {{ t(error) }}
            <button class="rune-description-retry" @click="load">{{ t('重试') }}</button>
          </p>
          <p v-else-if="!sortedCells.length" class="build-detail-empty" role="status">
            {{
              query?.trim()
                ? message('没有符合搜索条件的{p0}', { p0: label })
                : message('暂无共同选用{p0}的记录', { p0: label })
            }}
          </p>
        </template>
      </DetailCardList>
    </DetailStatRow>
  </div>
</template>
<style scoped>
.rune-synergies {
  --rarity: var(--silver);
  min-width: 0;
}
</style>
