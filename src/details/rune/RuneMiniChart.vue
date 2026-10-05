<script setup lang="ts">
import { t, message } from '@/i18n/i18n'
import { computed, useId } from 'vue'
import type { RuneSlot } from '@/boards/augments/augmentBoard'
import {
  runeChartPoints,
  runeChartTotal,
  runeRateRange,
  showRuneRate,
  runePointDescription,
} from './runeChart'
const props = defineProps<{ slots: readonly RuneSlot[]; baseline: number; name: string }>()
const clipId = useId()
const range = computed(() => runeRateRange(props.baseline))
const points = computed(() => runeChartPoints(props.slots))
const total = computed(() => runeChartTotal(points.value))
const y = (rate: number) =>
  8 + ((range.value.max - rate) / (range.value.max - range.value.min)) * 64
const x = (slot: number) => 10 + (slot - 1) * 39
const ticks = computed(() => Array.from({ length: 5 }, (_, i) => range.value.min + i * 0.05))
const path = computed(() => {
  let connected = false
  return points.value
    .map(p => {
      if (!showRuneRate(p, total.value)) {
        connected = false
        return ''
      }
      const command = connected ? 'L' : 'M'
      connected = true
      return command + x(p.slot) + ',' + y(p.winRate)
    })
    .join(' ')
})
const plotted = computed(() => points.value.filter(p => showRuneRate(p, total.value)))
const label = computed(
  () =>
    message('{name}，全英雄逐选胜率。', { name: props.name }) +
    points.value.map(p => runePointDescription(p, total.value)).join('；'),
)
</script>
<template>
  <figure class="rune-mini-chart" :title="t('全英雄逐选胜率，与符文详情页统计一致')">
    <svg viewBox="0 0 168 82" role="img" :aria-label="label">
      <defs>
        <clipPath :id="clipId"><rect x="4" y="8" width="130" height="64" /></clipPath>
      </defs>
      <g v-for="(tick, index) in ticks" :key="tick">
        <line
          x1="4"
          x2="134"
          :y1="y(tick)"
          :y2="y(tick)"
          class="guide"
          :class="{ 'guide-major': index % 2 === 0 }"
        />
      </g>
      <path :d="path" :clip-path="`url(#${clipId})`" class="rate" />
      <template v-for="point in plotted" :key="point.slot">
        <circle
          v-if="point.winRate! >= range.min && point.winRate! <= range.max"
          :cx="x(point.slot)"
          :cy="y(point.winRate!)"
          r="3.2"
          class="point"
          :class="{ 'low-sample': point.lowSample }"
        />
        <path
          v-else
          :d="
            point.winRate! > range.max
              ? `M${x(point.slot) - 3},12 l3,-4 l3,4 Z`
              : `M${x(point.slot) - 3},68 l3,4 l3,-4 Z`
          "
          class="point"
        />
      </template>
    </svg>
    <span
      v-for="tick in ticks.filter((_, index) => index % 2 === 0)"
      :key="tick"
      class="tick-label"
      :style="{ top: (y(tick) / 82) * 100 + '%' }"
      aria-hidden="true"
      >{{ Math.round(tick * 100) }}%</span
    >
  </figure>
</template>
<style scoped>
.rune-mini-chart {
  position: relative;
  width: 120px;
  max-width: 100%;
  margin: 8px 0 0 auto;
}
svg {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}
.guide {
  stroke: var(--border-strong);
  stroke-width: 0.7;
}
.guide-major {
  stroke-width: 1.4;
}
.tick-label {
  position: absolute;
  right: 0;
  transform: translateY(-50%);
  color: var(--muted);
  font-size: 11px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.rate {
  fill: none;
  stroke: var(--accent-text);
  stroke-width: 2.6;
  stroke-linejoin: round;
}
.point {
  fill: var(--accent-text);
  stroke: var(--accent-text);
  stroke-width: 1.3;
}
.point.low-sample {
  fill: var(--card);
}
</style>
