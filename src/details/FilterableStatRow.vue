<script setup lang="ts">
import { sortRuneFamiliesByWinRate } from './rune/runeVisualSort'
import { gameName } from '@/i18n/gameLocalization'
import { t, message } from '@/i18n/i18n'
import { computed, ref, watch, nextTick, onUnmounted } from 'vue'
import { captureCategoryContents, dissolveCategoryContents } from './categoryDissolve'
const windowWidth = window.innerWidth
import { matchesDetailSearch, type DetailSearchIndex } from './detailSearch'
import DetailStatRow from './DetailStatRow.vue'
import DetailCardList from './DetailCardList.vue'
import BuildStatCard from './BuildStatCard.vue'
import { runeDetailUrl } from '@/app/detailLink'
import { augmentIcon } from '@/data/augmentIcons'
import type { DetailCell } from './buildDetails'
import type { TipData } from '@/tooltip/tooltip'
const props = defineProps<{
  tabMode?: boolean
  managedExpansion?: boolean
  overlayScrollbar?: boolean
  visualFamilySort?: boolean
  visualFamilyReference?: readonly DetailCell[]
  floatingSort?: boolean
  expandable?: boolean
  expanded?: boolean
  showDelta?: boolean
  group: { id: string; name: string; label: string; css: string }
  cells: DetailCell[]
  loading: boolean
  query: string
  locked?: boolean
  searchIndex?: DetailSearchIndex | null
  patch: string
  baseline: number
  context: string
  selectedRune?: string
  selectedItem?: string
}>()
const byIcon = ref(false),
  rowComponent = ref<{ $el: HTMLElement } | null>(null)
let clearIconMotion = () => {},
  iconRevision = 0
watch(
  () => props.expanded,
  expanded => {
    if (!expanded) {
      byIcon.value = false
      iconRevision++
      clearIconMotion()
    }
  },
)
onUnmounted(() => {
  iconRevision++
  clearIconMotion()
})
async function toggleIcons() {
  clearIconMotion()
  const revision = ++iconRevision
  const viewport =
    rowComponent.value?.$el.querySelector<HTMLElement>('.detail-card-viewport') || null
  const reduced = matchMedia('(prefers-reduced-motion:reduce)').matches
  const old = reduced ? [] : captureCategoryContents(viewport)
  byIcon.value = !byIcon.value
  await nextTick()
  if (revision === iconRevision && !reduced)
    clearIconMotion = dissolveCategoryContents(viewport, old)
}
function matches(cell: DetailCell) {
  return (
    !props.query.trim() ||
    matchesDetailSearch(props.group.id, cell, props.query, props.searchIndex || null)
  )
}
const highlightSearch = computed(() => !!props.managedExpansion && !!props.expanded)
function visibleCells(cells: readonly DetailCell[]) {
  const visible =
    props.locked || highlightSearch.value || !props.query.trim() ? cells : cells.filter(matches)
  return props.visualFamilySort && byIcon.value ? sortRuneFamiliesByWinRate(visible) : visible
}
const missingUsage = computed(() => (props.group.id === 'items' ? '≤0.5%' : '0.0%'))
const missingNote = computed(() =>
  props.group.id === 'items'
    ? '当前范围未提供该装备统计（使用率不超过 0.5% 或无记录），胜率不可用。'
    : '当前范围没有该项记录，胜率不可用。',
)
const emit = defineEmits<{
  rune: [cell: DetailCell]
  item: [cell: DetailCell]
  'toggle-expand': []
}>()
// Runes below 50 appearances retain source order at the end.
const runeRankingMinimumGames = 50
const isItemGroup = computed(() => props.group.id === 'items' || props.group.id === 'boots')
const rankedCells = computed(() =>
  isItemGroup.value
    ? props.cells
    : props.cells.map(cell => ({ ...cell, lowSample: cell.games < runeRankingMinimumGames })),
)
function selected(cell: DetailCell) {
  return (isItemGroup.value ? props.selectedItem : props.selectedRune) === cell.id
}
function activate(cell: DetailCell) {
  if (props.group.id === 'boots') return
  if (isItemGroup.value) emit('item', cell)
  else emit('rune', cell)
}
function comparison(value: number) {
  const delta = (value - props.baseline) * 100
  return Math.abs(delta) < 1e-10
    ? t('与当前范围基准持平')
    : message(
        delta > 0 ? '高于当前范围基准 {points} 个百分点' : '低于当前范围基准 {points} 个百分点',
        { points: Math.abs(delta).toFixed(2) },
      )
}
function cardTip(cell: DetailCell & { missing?: boolean }): TipData {
  return {
    ...cell,
    onFilter: !isItemGroup.value ? () => activate(cell) : undefined,
    missingStatistics: cell.missing ? missingNote.value : undefined,
    preferredSide: 'below',
    wikiTranslation: !isItemGroup.value,
    kind: isItemGroup.value ? 'items' : 'augments',
    icon: isItemGroup.value ? cell.icon : augmentIcon(cell.id, props.patch, cell.icon),
    patch: props.patch,
    rarity: props.group.id,
    baseline: props.baseline,
    context: props.context,
    baselineLabel: props.context,
  }
}
</script>
<template>
  <DetailStatRow
    ref="rowComponent"
    :icon-toggle="!!visualFamilySort"
    :by-icon="byIcon"
    @toggle-icons="toggleIcons"
    :tab-mode="tabMode"
    :floating-sort="floatingSort"
    :expandable="expandable"
    :expanded="expanded"
    @toggle-expand="emit('toggle-expand')"
    :sync-win-rate-delta="showDelta"
    :locked="locked"
    :class="group.css"
    :name="group.name"
    :label="group.label"
    :cells="rankedCells"
    :default-sort="isItemGroup ? 'pickRate' : 'winRate'"
    :preserve-low-sample-order="!isItemGroup"
    :low-sample-last="isItemGroup ? false : runeRankingMinimumGames"
    v-slot="{ sortedCells, sortBy }"
  >
    <DetailCardList
      :managed-expansion="managedExpansion"
      :overlay-scrollbar="overlayScrollbar"
      :batch-size="Math.ceil(windowWidth / 80) + 1"
      :item-count="visibleCells(sortedCells).length"
      v-slot="{ visibleCount, pageItems }"
      :expanded="expanded"
      :loading="loading"
      :reset-key="group.id + (locked || highlightSearch ? '' : query) + sortBy"
      :match-key="locked && query.trim() ? query : undefined"
      :match-revision="sortedCells"
      :aria-hidden="loading ? true : undefined"
      :class="{ 'is-empty': !loading && !visibleCells(sortedCells).length }"
      :tabindex="loading ? undefined : 0"
      :aria-label="t(group.name) + (expanded ? t('，已展开全部') : t('，可左右滚动查看全部'))"
    >
      <template v-if="loading"
        ><div v-for="i in 10" :key="i" class="build-stat-placeholder"></div
      ></template>
      <template v-else>
        <BuildStatCard
          tap-for-tip
          :show-delta="showDelta"
          v-for="cell in pageItems(
            visibleCells(sortedCells),
            expanded || (locked && query.trim()) ? undefined : visibleCount,
          )"
          :key="cell.id"
          :data-search-match="locked && matches(cell) ? 'true' : undefined"
          :class="{
            'search-mismatch': locked && !highlightSearch && !matches(cell),
            'search-highlight': highlightSearch && !!query.trim() && matches(cell),
            'low-sample-card': !isItemGroup && cell.lowSample,
          }"
          :missing-usage="missingUsage"
          :cell="cell"
          :href="isItemGroup ? undefined : runeDetailUrl(cell.id, patch)"
          :expandable="group.id !== 'boots'"
          :expanded="selected(cell)"
          :action-label="
            group.id === 'boots'
              ? undefined
              : message('{p0}{p1}{p2}筛选', {
                  p0: gameName(isItemGroup ? 'items' : 'augments', cell.id, patch, cell.name),
                  p1: selected(cell) ? t('，取消') : t('，按此'),
                  p2: isItemGroup ? t('装备') : t('符文'),
                })
          "
          @activate="activate(cell)"
          :group="isItemGroup ? 'items' : group.id"
          :patch="patch"
          :baseline="baseline"
          :comparison="comparison(cell.winRate)"
          :tip="cell.noBoots ? undefined : cardTip(cell)"
        >
          <template v-if="cell.noBoots" #identity>
            <span class="no-boots-identity">
              <span class="no-boots-easter-egg" aria-hidden="true"
                >光脚的<br />不怕穿<br />鞋的。</span
              >
              <span class="build-stat-name">{{ t('无鞋') }}</span>
            </span>
          </template>
        </BuildStatCard>
        <p v-if="!visibleCells(sortedCells).length" class="build-detail-empty" role="status">
          {{
            query.trim()
              ? message('没有符合搜索条件的{p0}', {
                  p0:
                    group.id === 'boots' ? t('鞋子') : group.id === 'items' ? t('装备') : t('符文'),
                })
              : group.id === 'boots'
                ? t('暂无使用率超过 0.5% 的鞋子')
                : group.id === 'items'
                  ? t('暂无使用率超过 0.5% 的装备')
                  : t('暂无该品质的有效记录')
          }}
        </p>
      </template>
    </DetailCardList>
  </DetailStatRow>
</template>

<style scoped>
.build-stat-card.search-highlight {
  border-color: var(--accent) !important;
}

.search-mismatch {
  filter: grayscale(1);
  opacity: 0.32;
}
.no-boots-identity {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: 44px 26px;
  align-items: center;
  justify-items: center;
  width: 100%;
  min-width: 0;
}
.no-boots-identity .build-stat-name {
  width: 100%;
  max-width: 100%;
  text-align: center;
  box-sizing: border-box;
}
.no-boots-easter-egg {
  justify-self: center;
  width: max-content;
  color: var(--surface);
  font-size: 11px;
  line-height: 14px;
  text-align: left;
  white-space: pre-line;
  user-select: text;
}
</style>
