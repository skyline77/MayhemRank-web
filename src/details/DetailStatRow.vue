<script setup lang="ts" generic="T extends SortableDetailCell">
import { t, message } from '@/i18n/i18n'
import { computed, inject, nextTick, onUnmounted, ref, watch } from 'vue'
import { readHistorySection, registerHistorySection } from '@/app/pageHistory'
import { sortDetailCells, type DetailSort, type SortableDetailCell } from './detailSort'
import { closeTip } from '@/tooltip/tooltip'
import StatCardFrame from './StatCardFrame.vue'
import LockIcon from './LockIcon.vue'
import SortDirection from './SortDirection.vue'
import { useLockedOrder } from '@/shared/useLockedOrder'
const props = defineProps<{
  iconToggle?: boolean
  byIcon?: boolean
  tabMode?: boolean
  floatingSort?: boolean
  expandable?: boolean
  expanded?: boolean
  label: string
  name: string
  cells: readonly T[]
  availableCells?: readonly T[]
  locked?: boolean
  secondaryMetric?: 'pickRate' | 'delta'
  secondaryLabel?: string
  defaultSort?: DetailSort
  syncWinRateDelta?: boolean
  lowSampleLast?: boolean | number
  preserveLowSampleOrder?: boolean
  additionalMetrics?: readonly { key: 'pickRate' | 'games'; label: string }[]
}>()
const emit = defineEmits<{ 'toggle-expand': []; 'toggle-icons': [] }>()
const row = ref<HTMLElement | null>(null)
const expandButton = ref<HTMLButtonElement | null>(null)
let arrowAnimations: Animation[] = []
watch(
  () => props.expanded,
  (_expanded, previous) => {
    arrowAnimations.forEach(animation => animation.cancel())
    arrowAnimations = []
    const button = expandButton.value
    if (!button || window.matchMedia('(prefers-reduced-motion:reduce)').matches) return
    const height = button.clientHeight,
      size = 14,
      upper = 6,
      lower = height - 20
    for (const [selector, up] of [
      ['.rarity-arrow-top', true],
      ['.rarity-arrow-bottom', false],
    ] as const) {
      const arrow = button.querySelector<SVGElement>(selector)
      if (!arrow) continue
      const start = up ? (previous ? lower : upper) : previous ? upper : lower
      const end = up ? (props.expanded ? lower : upper) : props.expanded ? upper : lower
      if (!props.expanded) {
        arrowAnimations.push(
          arrow.animate(
            [{ transform: `translateY(${start - end}px)` }, { transform: 'translateY(0)' }],
            { duration: 360, easing: 'linear' },
          ),
        )
        continue
      }
      const exit = up ? -size : height,
        enter = up ? height : -size
      const split = Math.abs(exit - start) / (Math.abs(exit - start) + Math.abs(end - enter))
      arrowAnimations.push(
        arrow.animate(
          [
            { transform: `translateY(${start - end}px)`, offset: 0 },
            { transform: `translateY(${exit - end}px)`, offset: split },
            { transform: `translateY(${enter - end}px)`, offset: Math.min(0.999, split + 0.001) },
            { transform: 'translateY(0)', offset: 1 },
          ],
          { duration: 360, easing: 'linear' },
        ),
      )
    }
  },
  { flush: 'post' },
)
onUnmounted(() => arrowAnimations.forEach(animation => animation.cancel()))
const historyPanel = inject<string>('detail-history-key', '')
const historyKey = 'sort:' + historyPanel + ':' + props.name
const savedSort = historyPanel ? readHistorySection<DetailSort>(historyKey) : undefined
const secondary = computed(() => props.secondaryMetric || 'pickRate')
const secondaryLabel = computed(() => props.secondaryLabel || '使用率')
const allowedSorts = [
  'winRate',
  'winRateAsc',
  secondary.value,
  ...(secondary.value === 'delta' ? ['deltaAsc'] : []),
  ...(props.additionalMetrics || []).map(metric => metric.key),
]
const sortBy = ref<DetailSort>(
  savedSort && allowedSorts.includes(savedSort) ? savedSort : props.defaultSort || 'pickRate',
)
if (historyPanel) onUnmounted(registerHistorySection(historyKey, () => sortBy.value))
// 展开分类时“使用率”按钮换成“按图标”开关，收起时换回。新插入的按钮淡入，
// 与同一栏其他排序按钮 260ms 的颜色过渡同步，避免文字与颜色一帧跳变。
const swappedIn = ref(false)
watch(
  () => !!props.iconToggle,
  () => {
    swappedIn.value = true
  },
)
const currentCells = computed(() =>
  sortDetailCells(
    props.cells,
    props.iconToggle ? 'winRate' : sortBy.value,
    props.lowSampleLast,
    props.preserveLowSampleOrder,
  ),
)
const sortedCells = useLockedOrder(
  () => currentCells.value,
  () => !!props.locked,
  cell => ({
    ...cell,
    games: 0,
    wins: 0,
    pickRate: 0,
    winRate: 0,
    delta: 0,
    lowSample: false,
    missing: true,
  }),
  () => props.availableCells || currentCells.value,
)
let sortFeedback: Animation | undefined
onUnmounted(() => sortFeedback?.cancel())
function acknowledgeSort(event: Event) {
  const arrow = (event.currentTarget as HTMLElement)?.querySelector('.sort-direction')
  if (!arrow || window.matchMedia('(prefers-reduced-motion:reduce)').matches) return
  sortFeedback?.cancel()
  sortFeedback = arrow.animate(
    [{ translate: '0 0' }, { translate: '0 2px' }, { translate: '0 -1px' }, { translate: '0 0' }],
    { duration: 220, easing: 'ease-out' },
  )
}
async function chooseSort(value: DetailSort, event: Event) {
  if (props.locked || props.tabMode) return
  if (value === 'winRate' && sortBy.value === 'winRate') value = 'winRateAsc'
  if (value === 'delta' && sortBy.value === 'delta') value = 'deltaAsc'
  if (sortBy.value === value) {
    acknowledgeSort(event)
    return
  }
  closeTip()
  sortBy.value = value
  await nextTick()
  row.value
    ?.querySelector<HTMLElement>('.build-detail-cards')
    ?.scrollTo({ left: 0, behavior: 'instant' })
}
</script>
<template>
  <section
    ref="row"
    class="build-detail-row"
    :class="{ 'is-expandable': expandable, 'is-expanded': expandable && expanded }"
    :aria-label="t(name)"
    :style="{
      '--stat-card-metric-count': 2 + Number(!!syncWinRateDelta) + (additionalMetrics?.length || 0),
    }"
  >
    <Teleport to="body" :disabled="!floatingSort">
      <StatCardFrame
        class="build-detail-rail"
        :class="{ 'is-locked': locked, 'floating-detail-sort': floatingSort }"
        :role="floatingSort ? 'group' : undefined"
        :aria-label="floatingSort ? message('{p0}排序', { p0: t(name) }) : undefined"
        ><h3>
          <button
            v-if="expandable"
            ref="expandButton"
            type="button"
            class="rarity-expand"
            :tabindex="tabMode ? -1 : undefined"
            :aria-hidden="tabMode ? true : undefined"
            :aria-expanded="!!expanded"
            :aria-label="(expanded ? t('收起') : t('展开')) + ' ' + t(name)"
            @click="emit('toggle-expand')"
          >
            <svg
              class="rarity-arrow rarity-arrow-top"
              aria-hidden="true"
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M8 13V3M4 7l4-4 4 4" /></svg
            >{{ t(label)
            }}<svg
              class="rarity-arrow rarity-arrow-bottom"
              aria-hidden="true"
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M8 3v10M4 9l4 4 4-4" />
            </svg></button
          ><span v-else>{{ t(label) }}</span>
        </h3>
        <button
          type="button"
          class="build-detail-sort"
          :tabindex="tabMode ? -1 : undefined"
          :aria-hidden="tabMode ? true : undefined"
          :disabled="locked"
          :aria-pressed="sortBy === 'winRate' || sortBy === 'winRateAsc'"
          :aria-label="sortBy === 'winRate' ? t('按胜率从低到高排序') : t('按胜率从高到低排序')"
          @click="chooseSort('winRate', $event)"
        >
          <span class="detail-sort-label">{{ floatingSort ? t('按胜率') : t('胜率') }}</span
          ><SortDirection :ascending="!tabMode && sortBy === 'winRateAsc'" />
        </button>
        <button
          v-if="syncWinRateDelta"
          type="button"
          class="build-detail-sort"
          :tabindex="tabMode ? -1 : undefined"
          :aria-hidden="tabMode ? true : undefined"
          :disabled="locked"
          :aria-pressed="sortBy === 'winRate' || sortBy === 'winRateAsc'"
          :aria-label="sortBy === 'winRate' ? t('按Δ胜率从低到高排序') : t('按Δ胜率从高到低排序')"
          @click="chooseSort('winRate', $event)"
        >
          <span class="detail-sort-label">{{ t('Δ胜率') }}</span
          ><SortDirection :ascending="!tabMode && sortBy === 'winRateAsc'" />
        </button>
        <button
          v-if="iconToggle"
          type="button"
          class="build-detail-sort icon-group-switch sort-swap-in"
          role="switch"
          :aria-checked="!!byIcon"
          @click.stop="emit('toggle-icons')"
        >
          <span class="detail-sort-label">{{ t('按图标') }}</span
          ><span class="icon-switch-box" aria-hidden="true"></span>
        </button>
        <button
          v-else
          type="button"
          class="build-detail-sort"
          :class="{ 'sort-swap-in': swappedIn }"
          :tabindex="tabMode ? -1 : undefined"
          :aria-hidden="tabMode ? true : undefined"
          :disabled="locked"
          :aria-pressed="sortBy === secondary || sortBy === secondary + 'Asc'"
          :aria-label="
            message('按{p0}{p1}', {
              p0: t(secondaryLabel),
              p1:
                secondary === 'delta' && sortBy === 'delta' ? t('从低到高排序') : t('从高到低排序'),
            })
          "
          @click="chooseSort(secondary, $event)"
        >
          <span class="detail-sort-label"
            >{{ floatingSort ? t('按') : '' }}{{ t(secondaryLabel) }}</span
          ><SortDirection :ascending="secondary === 'delta' && sortBy === 'deltaAsc'" />
        </button>
        <button
          v-for="metric in additionalMetrics"
          :key="metric.key"
          type="button"
          class="build-detail-sort"
          :tabindex="tabMode ? -1 : undefined"
          :aria-hidden="tabMode ? true : undefined"
          :disabled="locked"
          :aria-pressed="sortBy === metric.key"
          :aria-label="message('按{p0}从高到低排序', { p0: t(metric.label) })"
          @click="chooseSort(metric.key, $event)"
        >
          <span class="detail-sort-label">{{ t(metric.label) }}</span
          ><SortDirection />
        </button>
        <button
          v-if="tabMode"
          type="button"
          class="category-tab-action"
          :aria-expanded="!!expanded"
          :aria-label="(expanded ? t('收起') : t('展开')) + ' ' + t(name)"
          @click="emit('toggle-expand')"
        />
        <span v-if="locked" class="detail-sort-lock" role="img" :aria-label="t('顺序已锁定')"
          ><LockIcon
        /></span>
      </StatCardFrame>
    </Teleport>
    <slot :sorted-cells="sortedCells" :sort-by="sortBy" />
  </section>
</template>

<style scoped>
.build-detail-rail .icon-group-switch {
  position: relative;
  z-index: 4;
  pointer-events: auto;
  gap: 5px;
  cursor: pointer;
  color: var(--rail-ink);
}
/* 勾选框放在右侧，与“胜率↓”的箭头位置一致；左侧留同宽空位，文字保持居中 */
.icon-group-switch::before {
  flex: 0 0 10px;
}
/* 勾选框：与上方排序文字同色同字号，只用分类栏墨色，不另加强调色 */
.icon-switch-box {
  position: relative;
  flex: none;
  width: 10px;
  height: 10px;
  border: 1.5px solid currentColor;
  border-radius: 2px;
  opacity: 0.7;
  transition:
    background-color 120ms ease,
    box-shadow 120ms ease,
    opacity 120ms ease;
}
/* 悬停：勾选框变实、加一圈淡光晕，未勾选时内部浅填充，提示可点击 */
.icon-group-switch:hover .icon-switch-box {
  opacity: 1;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--rail-ink) 18%, transparent);
}
.icon-group-switch[aria-checked='false']:hover .icon-switch-box {
  background: color-mix(in srgb, var(--rail-ink) 22%, transparent);
}
.icon-group-switch[aria-checked='true'] .icon-switch-box {
  background: currentColor;
  opacity: 1;
}
.icon-group-switch[aria-checked='true'] .icon-switch-box::after {
  content: '';
  position: absolute;
  left: 2px;
  top: 0;
  width: 3px;
  height: 5px;
  border: solid var(--rarity);
  border-width: 0 1.5px 1.5px 0;
  transform: rotate(45deg);
}
.sort-swap-in {
  animation: sort-swap-in 260ms ease;
}
@keyframes sort-swap-in {
  from {
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .sort-swap-in {
    animation: none;
  }
}
.icon-group-switch:focus-visible {
  outline: 2px solid var(--rail-ink);
  outline-offset: -2px;
}
@media (prefers-reduced-motion: reduce) {
  .icon-switch-box {
    transition: none;
  }
}

.category-tab-action {
  position: absolute;
  inset: 0;
  z-index: 3;
  border: 0;
  border-radius: inherit;
  padding: 0;
  background: transparent;
  cursor: pointer;
}
.category-tab-action:focus-visible {
  outline: 2px solid var(--rail-ink);
  outline-offset: -3px;
}
/* Equal-width spacers on both sides keep the text centered when the arrow appears. */
.detail-sort-label {
  flex: 0 0 auto;
  text-align: center;
}
.build-detail-rail {
  position: relative;
  align-self: start;
}
.rarity-expand {
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  height: 100%;
  padding: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.rarity-arrow {
  position: absolute;
  left: calc(50% - 7px);
  opacity: 0;
  pointer-events: none;
  transition: opacity 140ms ease;
}
.rarity-arrow-top {
  top: 6px;
}
.rarity-arrow-bottom {
  top: calc(100% - 20px);
}
.rarity-expand[aria-expanded='true'] .rarity-arrow-top {
  top: calc(100% - 20px);
}
.rarity-expand[aria-expanded='true'] .rarity-arrow-bottom {
  top: 6px;
}
@media (hover: hover) {
  .rarity-expand:hover .rarity-arrow {
    opacity: 0.75;
  }
}
@media (max-width: 700px), (hover: none) {
  .rarity-expand .rarity-arrow {
    opacity: 0.75;
  }
}
.rarity-expand:focus-visible .rarity-arrow {
  opacity: 0.75;
}
@media (prefers-reduced-motion: reduce) {
  .rarity-arrow {
    transition: none;
  }
}
.rarity-expand:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: -4px;
}
.rarity-expand:hover {
  background: color-mix(in srgb, currentColor 8%, transparent);
}
.build-detail-rail.is-locked .build-detail-sort {
  filter: brightness(0.5);
  cursor: default;
}
.detail-sort-lock {
  position: absolute;
  inset: auto 0 0;
  height: calc(var(--stat-card-metric-count, 2) * 28px);
  display: grid;
  place-items: center;
  font-size: 26px;
  color: var(--accent);
  pointer-events: none;
}

.floating-detail-sort {
  position: fixed;
  right: 68px;
  bottom: max(12px, env(safe-area-inset-bottom));
  z-index: 39;
  width: auto;
  max-width: calc(100vw - 80px);
  height: 48px;
  border: 1px solid var(--border-strong);
  border-radius: 24px;
  background: var(--surface);
  color: var(--muted);
}
.floating-detail-sort :deep(.stat-card-layout) {
  display: flex;
  height: 100%;
  padding: 0 6px;
  gap: 0;
}
.floating-detail-sort h3 {
  display: none;
}
.floating-detail-sort .build-detail-sort {
  border: 0;
  background: transparent;
  padding: 0 5px;
  min-height: 44px;
  font-size: 12px;
  white-space: nowrap;
  color: var(--muted);
}
.floating-detail-sort .build-detail-sort[aria-pressed='true'] {
  color: var(--accent-text);
}
.floating-detail-sort .build-detail-sort:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -3px;
}
:global(body:has(.board-search-dock.is-mobile.is-expanded) .floating-detail-sort) {
  display: none;
}
</style>
