<script setup lang="ts">
import { locale } from '@/i18n/locale'
import { t, message } from '@/i18n/i18n'
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import type { EChartsType } from 'echarts/core'
import type { RuneSlot } from '@/boards/augments/augmentBoard'
import { runeChartOption, runeChartPoints, runeRateRange } from './runeChart'
import { useMotionDeferred } from '@/shared/useMotionDeferred'
const props = defineProps<{ slots: readonly RuneSlot[]; baseline: number; name: string }>()
const host = ref<HTMLElement | null>(null),
  loading = ref(true),
  failed = ref(false),
  active = ref<number | null>(null)
const points = computed(() => runeChartPoints(props.slots))
const rateRange = computed(() => runeRateRange(props.baseline))
const pct = (value: number) => (value * 100).toFixed(1) + '%'
let chart: EChartsType | undefined,
  observer: ResizeObserver | undefined,
  disposed = false,
  frame = 0
let compact: boolean | undefined, themeObserver: MutationObserver | undefined
function render() {
  if (!chart || !host.value) return
  const styles = getComputedStyle(host.value)
  const color = (name: string) => styles.getPropertyValue(name).trim()
  compact = host.value.clientWidth < 440
  chart.setOption(
    runeChartOption(
      points.value,
      props.baseline,
      {
        count: color('--green'),
        rate: color('--accent-text'),
        text: color('--muted'),
        grid: color('--border-strong'),
        surface: color('--detail-surface'),
        font: styles.fontFamily,
      },
      compact,
    ),
    { notMerge: false },
  )
}
function select(index: number) {
  active.value = index
  chart?.dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex: index })
}
function navigate(event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || !points.value.length)
    return
  event.preventDefault()
  const last = points.value.length - 1
  const index =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? last
        : active.value === null
          ? 0
          : Math.max(0, Math.min(last, active.value + (event.key === 'ArrowRight' ? 1 : -1)))
  select(index)
}
// 图表初始化（ECharts）较重：桌面详情展开动画期间不启动，落位后排在卡片之后再启动
const deferred = useMotionDeferred(3)
watch(deferred, value => {
  if (!value) void start()
})
async function start() {
  if (deferred.value || chart || disposed) return
  loading.value = true
  failed.value = false
  try {
    const { createRuneChart } = await import('./runeChartRuntime')
    if (disposed || !host.value) return
    chart = createRuneChart(host.value)
    chart.on('click', (event: { dataIndex?: number }) => {
      if (event.dataIndex !== undefined) select(event.dataIndex)
    })
    observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        chart?.resize()
        if (host.value && host.value.clientWidth < 440 !== compact) render()
      })
    })
    observer.observe(host.value)
    render()
  } catch {
    failed.value = true
    chart?.dispose()
    chart = undefined
  } finally {
    loading.value = false
  }
}
watch(
  () => [props.slots, props.baseline, locale.value],
  () => {
    active.value = null
    render()
  },
)
onMounted(() => {
  void start()
  themeObserver = new MutationObserver(render)
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  })
})
onBeforeUnmount(() => {
  disposed = true
  themeObserver?.disconnect()
  cancelAnimationFrame(frame)
  observer?.disconnect()
  chart?.dispose()
})
</script>
<template>
  <p v-if="loading" role="status">{{ t('正在加载图表……') }}</p>
  <p v-if="failed" role="alert">
    {{ t('图表暂时无法加载。') }}<button class="board-retry" @click="start">{{ t('重试') }}</button>
  </p>
  <div
    class="rune-chart-scroll"
    tabindex="0"
    :aria-label="t('逐选双轴折线图，可用左右方向键查看选次数据')"
    @keydown="navigate"
  >
    <div
      ref="host"
      class="rune-pick-chart"
      role="img"
      :aria-label="
        message(
          '{p0}各选次的选择次数与胜率。绿色虚线读左轴，黄色实线读右轴{p1}至{p2}。灰色参考线为总体胜率。低占比胜率留空，超范围以箭头标记；悬停、点按或用左右方向键查看数据，完整数据见统计口径与数据范围。',
          { p0: name, p1: pct(rateRange.min), p2: pct(rateRange.max) },
        )
      "
      :aria-busy="loading"
    />
  </div>
</template>
