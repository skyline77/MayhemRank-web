<script setup lang="ts">
import { t, message } from '@/i18n/i18n'
import { gameName } from '@/i18n/gameLocalization'
import { formatCount, formatCompactCount } from '@/stats/formatCount'

import { computed } from 'vue'
import DetailLink from './DetailLink.vue'
import StatCardFrame from './StatCardFrame.vue'
import WinRateDelta from './WinRateDelta.vue'
import { winRateDelta } from './buildDetails'
import { augmentIcon, needsGoldTint } from '@/data/augmentIcons'
import type { DetailCell } from './buildDetails'
import { winRateColor } from '@/stats/winRateColor'
import { usageRateColor } from '@/stats/usageRateColor'
import { showTip, hideTip, toggleTip, type TipData } from '@/tooltip/tooltip'
type StatCardCell = Pick<
  DetailCell,
  'id' | 'name' | 'games' | 'pickRate' | 'winRate' | 'lowSample'
> & { icon?: string; missing?: boolean }
const props = defineProps<{
  tapForTip?: boolean
  cell: StatCardCell
  group: string
  patch: string
  baseline?: number
  showDelta?: boolean
  comparison?: string
  tip?: TipData
  usageDisplay?: 'count'
  expandable?: boolean
  expanded?: boolean
  actionLabel?: string
  href?: string
  resultTitle?: string
  usageTitle?: string
  usageLabel?: string
  sampleUnit?: string
  missingUsage?: string
  missingNote?: string
}>()
const emit = defineEmits<{ activate: [event: Event] }>()
const pct = (value: number) => (value * 100).toFixed(1) + '%'
const compactCount = (value: number) => formatCompactCount(value)
const isRuneUsage = computed(
  () =>
    ['kPrismatic', 'kGold', 'kSilver', 'prismatic', 'gold', 'silver'].includes(props.group) &&
    props.usageDisplay !== 'count',
)
const wholeCardTip = computed(() => props.tip?.kind === 'augments')
function tapTooltipMode() {
  return (
    !!props.tapForTip &&
    (window.matchMedia('(max-width:700px)').matches || window.matchMedia('(hover:none)').matches)
  )
}
function captureTap(event: MouseEvent) {
  if (!tapTooltipMode() || !props.tip) return
  event.preventDefault()
  event.stopImmediatePropagation()
  toggleTip(event, props.tip)
}
function reveal(event: Event) {
  if (props.tip && !tapTooltipMode()) showTip(event, props.tip)
}
function activate(event: Event) {
  if (props.expandable) emit('activate', event)
}
function clickCard(event: MouseEvent) {
  if (!props.href) activate(event)
}
function pressCard(event: KeyboardEvent) {
  if (props.href || !props.expandable) return
  event.preventDefault()
  activate(event)
}
function clickIdentity(event: MouseEvent) {
  if (props.href) return
  event.stopPropagation()
  if (props.expandable) {
    activate(event)
    return
  }
  if (!props.tip) return
  if ((event as PointerEvent).pointerType === 'mouse') showTip(event, props.tip)
  else toggleTip(event, props.tip)
}
function toggleIdentity(event: KeyboardEvent) {
  if (props.href) return
  event.preventDefault()
  if (props.tip) toggleTip(event, props.tip)
}
</script>
<template>
  <StatCardFrame
    :as="href ? (expandable ? DetailLink : 'a') : 'figure'"
    :caption-as="href ? 'span' : 'figcaption'"
    :caption-class="cell.lowSample ? 'build-stat-caption is-low-sample' : 'build-stat-caption'"
    :href="href"
    :data-detail-card-id="group + ':' + cell.id"
    class="build-stat-card"
    :class="{ uncertain: cell.lowSample, 'is-actionable': expandable && !!actionLabel }"
    :tabindex="expandable && !href ? 0 : undefined"
    :role="expandable && !href ? 'button' : undefined"
    :aria-expanded="expandable && !actionLabel ? !!expanded : undefined"
    :aria-current="actionLabel && expanded ? 'true' : undefined"
    :aria-label="
      actionLabel ||
      (cell.missing
        ? message('{p0}，当前范围统计不可用', {
            p0: gameName(
              group === 'heroes' ? 'champions' : group === 'items' ? 'items' : 'augments',
              cell.id,
              patch,
              cell.name,
            ),
          })
        : group === 'items'
          ? undefined
          : href && !expandable
            ? message('{p0}，查看符文详情', {
                p0: gameName(
                  group === 'heroes' ? 'champions' : group === 'items' ? 'items' : 'augments',
                  cell.id,
                  patch,
                  cell.name,
                ),
              })
            : tip
              ? message('{p0}，查看装备或符文说明', {
                  p0: gameName(
                    group === 'heroes' ? 'champions' : group === 'items' ? 'items' : 'augments',
                    cell.id,
                    patch,
                    cell.name,
                  ),
                })
              : message('{p0}，胜率 {p1}{p2}', {
                  p0: gameName(
                    group === 'heroes' ? 'champions' : group === 'items' ? 'items' : 'augments',
                    cell.id,
                    patch,
                    cell.name,
                  ),
                  p1: pct(cell.winRate),
                  p2: usageLabel
                    ? '，' + usageLabel
                    : usageDisplay === 'count'
                      ? message('，{p0}次', { p0: formatCount(cell.games) })
                      : message('，使用率 {p0}，{p1} {p2}', {
                          p0: pct(cell.pickRate),
                          p1: formatCount(cell.games),
                          p2: sampleUnit || t('人次'),
                        }),
                }))
    "
    @mouseenter="wholeCardTip && reveal($event)"
    @mouseleave="wholeCardTip && hideTip()"
    @focusin="wholeCardTip && reveal($event)"
    @focusout="wholeCardTip && hideTip()"
    @click.capture="captureTap"
    @activate="activate"
    @click="clickCard"
    @keydown.self.enter="pressCard"
    @keydown.self.space="pressCard"
  >
    <span
      class="build-stat-identity"
      :class="{
        'has-custom-identity': $slots.identity,
        'is-augment-identity': group !== 'items' && group !== 'heroes' && !$slots.identity,
      }"
      :tabindex="tip && !expandable && !href ? 0 : undefined"
      :role="tip && !expandable && !href ? 'button' : undefined"
      :aria-label="
        tip
          ? message('{p0}，查看装备或符文说明', {
              p0: gameName(
                group === 'heroes' ? 'champions' : group === 'items' ? 'items' : 'augments',
                cell.id,
                patch,
                cell.name,
              ),
            })
          : undefined
      "
      @mouseenter="!wholeCardTip && reveal($event)"
      @mouseleave="!wholeCardTip && hideTip()"
      @focus="!wholeCardTip && reveal($event)"
      @blur="!wholeCardTip && hideTip()"
      @click="clickIdentity"
      @keydown.self.enter="toggleIdentity"
      @keydown.self.space="toggleIdentity"
    >
      <slot name="identity">
        <span v-if="group === 'items'" class="build-item-icon">
          <img
            :src="cell.icon"
            alt=""
            loading="lazy"
            width="34"
            height="34"
            :draggable="href ? false : undefined"
          />
        </span>
        <img
          v-else
          class="augment-artwork"
          :class="{ 'augment-gold-fallback': needsGoldTint(cell.id, patch, group) }"
          :src="augmentIcon(cell.id, patch, cell.icon || '')"
          alt=""
          loading="lazy"
          width="42"
          height="42"
          :draggable="href ? false : undefined"
        />
        <span class="build-stat-name">{{
          gameName(
            group === 'heroes' ? 'champions' : group === 'items' ? 'items' : 'augments',
            cell.id,
            patch,
            cell.name,
          )
        }}</span>
      </slot>
    </span>
    <span
      v-if="cell.missing"
      class="build-stat-result"
      :title="t(missingNote) || t('当前范围无记录')"
      :aria-label="t('胜率暂无数据')"
      >—</span
    >
    <span
      v-else
      class="build-stat-result"
      :title="resultTitle"
      :aria-label="message('胜率 {p0}', { p0: pct(cell.winRate) })"
    >
      <strong
        class="win"
        :style="{ color: winRateColor(cell.winRate, baseline) }"
        :aria-label="pct(cell.winRate) + (comparison ? '，' + comparison : '')"
        >{{ pct(cell.winRate) }}</strong
      >
      <slot name="result-extra" />
      <span v-if="cell.lowSample" class="build-low-sample" :aria-label="t('样本较少')">*</span>
    </span>
    <span
      v-if="showDelta && cell.missing"
      class="build-stat-usage build-stat-delta"
      :aria-label="t('Δ胜率暂无数据')"
      >—</span
    >
    <span
      v-else-if="showDelta"
      class="build-stat-usage build-stat-delta"
      :title="comparison"
      :aria-label="
        message('Δ胜率 {p0}，百分点', { p0: winRateDelta(cell.winRate, baseline ?? 0.5) })
      "
      ><WinRateDelta :win-rate="cell.winRate" :baseline="baseline ?? 0.5"
    /></span>
    <span
      v-if="cell.missing"
      class="build-stat-usage"
      :title="t(missingNote) || t('当前范围无记录')"
      >{{ missingUsage || '0.0%' }}</span
    >
    <span
      v-else
      class="build-stat-usage"
      :style="isRuneUsage && !$slots.usage ? { color: usageRateColor(cell.pickRate) } : undefined"
      :title="usageTitle"
      :aria-label="
        usageLabel ||
        (usageDisplay === 'count'
          ? message('使用次数 {p0}次', { p0: formatCount(cell.games) })
          : message('使用率 {p0}，样本 {p1} {p2}', {
              p0: pct(cell.pickRate),
              p1: formatCount(cell.games),
              p2: sampleUnit || t('人次'),
            }))
      "
      ><slot name="usage">{{
        usageDisplay === 'count' ? compactCount(cell.games) : pct(cell.pickRate)
      }}</slot></span
    >
    <slot name="additional-stats" />
  </StatCardFrame>
</template>

<style scoped>
/* Recolor the existing border: selection must not change the card's geometry. */
.build-stat-card.is-actionable,
.build-stat-card.is-actionable .build-item-icon {
  cursor: pointer;
}
.build-stat-card[aria-current='true'] {
  border-color: var(--accent);
}
</style>
