<script setup lang="ts">
import { locale } from '@/i18n/locale'
import { gameName } from '@/i18n/gameLocalization'
import { t } from '@/i18n/i18n'
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import type { EChartsType } from 'echarts/core'
import type { RuneHeroes } from './runeHeroes'
import {
  chartHeroes,
  heroArrowDescription,
  heroChartBounds,
  overlappingHeroes,
  DEFAULT_RUNE_HERO_MIN_GAMES,
} from './runeHeroChart'
import { winRateColor } from '@/stats/winRateColor'
import { useMotionDeferred } from '@/shared/useMotionDeferred'
import type { HeroChartTheme, HeroChartZoom } from './runeHeroChartRuntime'
const props = defineProps<{ data: RuneHeroes }>()
const minimum = ref(DEFAULT_RUNE_HERO_MIN_GAMES),
  selected = ref(''),
  nearby = ref<string[]>([]),
  visible = ref(false),
  loading = ref(false),
  failed = ref(false)
const frameHost = ref<HTMLElement | null>(null),
  host = ref<HTMLElement | null>(null)
const points = computed(() =>
  chartHeroes(props.data.entries, minimum.value).map(hero => ({
    ...hero,
    name: gameName('champions', hero.id, props.data.meta.patch, hero.name),
  })),
)
const compatible = computed(
  () => props.data.meta.sameRarityPickRateScope === 'deduplicated-same-rarity-selections',
)
const selectedHero = computed(() => points.value.find(e => e.id === selected.value))
const neighbors = computed(() => points.value.filter(e => nearby.value.includes(e.id)))
let chart: EChartsType | undefined, runtime: typeof import('./runeHeroChartRuntime') | undefined
let intersection: IntersectionObserver | undefined,
  resize: ResizeObserver | undefined,
  themeObserver: MutationObserver | undefined,
  disposed = false,
  frame = 0
let zoom: HeroChartZoom = { x: [0, 100], y: [0, 100] }
let cachedTheme: HeroChartTheme | undefined
function render(selectionOnly = false) {
  if (!chart || !host.value || !runtime) return
  if (!cachedTheme) {
    const probe = document.createElement('span')
    probe.hidden = true
    host.value.append(probe)
    const color = (value: string) => {
      probe.style.color = value
      return getComputedStyle(probe).color
    }
    const styles = getComputedStyle(host.value)
    const theme = {
      text: color('var(--muted)'),
      grid: color('var(--border-strong)'),
      surface: color('var(--detail-surface)'),
      accent: color('var(--accent-text)'),
      font: styles.fontFamily,
      width: host.value.clientWidth,
      colors: points.value.map(e => color(winRateColor(e.delta, 0))),
    }
    probe.remove()
    cachedTheme = theme
  }
  const option = runtime.heroChartOption(points.value, selected.value, cachedTheme, zoom)
  chart.setOption(selectionOnly ? { series: option.series } : option, { notMerge: false })
}
function select(id: string, cluster = false) {
  selected.value = id
  if (cluster && chart) {
    const index = points.value.findIndex(e => e.id === id)
    const pixels = points.value.map(
      e => chart!.convertToPixel({ gridIndex: 0 }, [e.sameRarityPickRate, e.winRate]) as number[],
    )
    nearby.value = overlappingHeroes(pixels, index).map(i => points.value[i]!.id)
  } else if (!nearby.value.includes(id)) nearby.value = []
  render(true)
  if (cluster)
    chart?.dispatchAction({
      type: 'showTip',
      seriesIndex: 0,
      dataIndex: points.value.findIndex(e => e.id === id),
    })
}
function zoomBy(factor: number) {
  const hero = selectedHero.value,
    bounds = heroChartBounds(points.value)
  const next = (range: [number, number], focus?: number): [number, number] => {
    const span = Math.min(100, Math.max(5, (range[1] - range[0]) * factor)),
      center = focus ?? (range[0] + range[1]) / 2
    const start = Math.max(0, Math.min(100 - span, center - span / 2))
    return [start, start + span]
  }
  zoom = {
    x: next(zoom.x, hero ? (hero.sameRarityPickRate / bounds.xMax) * 100 : undefined),
    y: next(
      zoom.y,
      hero ? ((hero.winRate - bounds.yMin) / (bounds.yMax - bounds.yMin)) * 100 : undefined,
    ),
  }
  applyZoom()
}
function applyZoom() {
  chart?.dispatchAction({
    type: 'dataZoom',
    batch: [
      { dataZoomId: 'hero-x', start: zoom.x[0], end: zoom.x[1] },
      { dataZoomId: 'hero-y', start: zoom.y[0], end: zoom.y[1] },
    ],
  })
}
function reset() {
  zoom = { x: [0, 100], y: [0, 100] }
  applyZoom()
}
// 图表初始化（ECharts）较重：桌面详情展开动画期间不启动，落位后排在卡片之后再启动
const deferred = useMotionDeferred(3)
watch(deferred, value => {
  if (!value) void start()
})
async function start() {
  if (
    deferred.value ||
    disposed ||
    chart ||
    loading.value ||
    !visible.value ||
    !compatible.value ||
    !points.value.length ||
    !host.value
  )
    return
  loading.value = true
  failed.value = false
  try {
    runtime = await import('./runeHeroChartRuntime')
    if (disposed || !host.value) return
    chart = runtime.createHeroChart(host.value)
    chart.on('click', (event: { dataIndex?: number }) => {
      const e = points.value[event.dataIndex ?? -1]
      if (e) select(e.id, true)
    })
    chart.on('datazoom', () => {
      const options = chart!.getOption().dataZoom as { start: number; end: number }[]
      zoom = { x: [options[0]!.start, options[0]!.end], y: [options[1]!.start, options[1]!.end] }
    })
    resize = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        chart?.resize()
        cachedTheme = undefined
        render()
      })
    })
    resize.observe(host.value)
    render()
  } catch {
    failed.value = true
    chart?.dispose()
    chart = undefined
  } finally {
    loading.value = false
  }
}
watch(locale, () => render(), { flush: 'post' })
watch(
  [minimum, () => props.data],
  () => {
    selected.value = ''
    nearby.value = []
    zoom = { x: [0, 100], y: [0, 100] }
    cachedTheme = undefined
    render()
    void start()
  },
  { flush: 'post' },
)
onMounted(() => {
  intersection = new IntersectionObserver(
    entries => {
      if (entries.some(e => e.isIntersecting)) {
        visible.value = true
        intersection?.disconnect()
        void start()
      }
    },
    { rootMargin: '200px' },
  )
  intersection.observe(frameHost.value!)
  themeObserver = new MutationObserver(() => {
    cachedTheme = undefined
    render()
  })
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  })
})
onBeforeUnmount(() => {
  disposed = true
  intersection?.disconnect()
  resize?.disconnect()
  themeObserver?.disconnect()
  cancelAnimationFrame(frame)
  chart?.dispose()
})
</script>
<template>
  <figure ref="frameHost" class="rune-hero-chart">
    <figcaption>{{ t('各英雄同品质选用率与胜率') }}</figcaption>
    <p class="rune-hero-chart-hint">
      {{
        t(
          '○ 起点：英雄总体胜率 → 头像：选用当前符文后的胜率。箭头颜色沿用上方 Δ胜率；表示历史关联。',
        )
      }}
    </p>
    <p v-if="!compatible" role="status">
      {{ t('当前快照尚无同品质符文选用次数，请更新统计快照后查看图表。') }}
    </p>
    <template v-else>
      <div class="rune-hero-chart-controls">
        <label
          >{{ t('选用场次 ≥')
          }}<select
            name="chart-minimum"
            v-model.number="minimum"
            :aria-label="t('图表最低选用场次')"
          >
            <option :value="50">50</option>
            <option :value="100">100</option>
            <option :value="200">200</option>
            <option :value="500">500</option>
          </select></label
        >
        <span>{{ points.length }}{{ t('位英雄') }}</span>
        <label
          >{{ t('英雄')
          }}<select
            name="chart-hero"
            :value="selected"
            :aria-label="t('在图表中选择英雄')"
            @change="select(($event.target as HTMLSelectElement).value)"
          >
            <option value="">{{ t('点按头像或选择') }}</option>
            <option v-for="hero in points" :key="hero.id" :value="hero.id">{{ hero.name }}</option>
          </select></label
        >
        <div class="rune-hero-chart-zoom">
          <button type="button" :disabled="!chart" @click="zoomBy(0.6)">{{ t('放大') }}</button
          ><button type="button" :disabled="!chart" @click="zoomBy(1 / 0.6)">{{ t('缩小') }}</button
          ><button type="button" :disabled="!chart" @click="reset">{{ t('重置') }}</button>
        </div>
      </div>
      <p v-if="!points.length" role="status">
        {{ t('暂无达到') }}{{ minimum }}{{ t('场的英雄记录。') }}
      </p>
      <p class="rune-hero-chart-selection" aria-live="polite">
        {{
          selectedHero
            ? heroArrowDescription(selectedHero)
            : t('选择英雄后显示选用次数、同品质总选用次数、两端胜率和差值。')
        }}
      </p>
      <div v-show="points.length" class="rune-hero-chart-canvas-wrap">
        <p v-if="!visible">{{ t('滚动至此处后加载图表。') }}</p>
        <p v-else-if="loading" role="status">{{ t('正在加载图表……') }}</p>
        <p v-if="failed" role="alert">
          {{ t('图表加载失败。') }}<button type="button" @click="start">{{ t('重试') }}</button>
        </p>
        <div
          ref="host"
          class="rune-hero-chart-canvas"
          role="img"
          :aria-label="
            t(
              '英雄头像箭头散点图。横轴是同品质符文选用率，纵轴是胜率。可通过上方英雄选择框查看精确数据，使用缩放按钮及轴旁滑块分开重叠头像。',
            )
          "
        />
      </div>
      <p class="rune-hero-chart-hint">
        {{ t('点按头像查看数据；重叠时选择下方候选英雄。拖动底部和右侧滑块可调整查看范围。') }}
      </p>
      <div
        v-if="neighbors.length > 1"
        class="rune-hero-chart-neighbors"
        role="group"
        :aria-label="t('重叠位置附近的英雄')"
      >
        <span>{{ t('附近') }}{{ neighbors.length }}{{ t('位：') }}</span
        ><button
          v-for="hero in neighbors"
          :key="hero.id"
          type="button"
          :aria-pressed="selected === hero.id"
          @click="select(hero.id)"
        >
          <img :src="hero.icon" alt="" width="24" height="24" loading="lazy" />{{ hero.name }}
        </button>
      </div>
    </template>
  </figure>
</template>
<style scoped>
.rune-hero-chart {
  margin: 20px 0 0;
  min-width: 0;
  width: 100%;
  border-top: 1px solid var(--border);
  padding-top: 16px;
}
figcaption {
  font-size: 14px;
  font-weight: 600;
}
.rune-hero-chart-hint {
  color: var(--muted);
  font-size: 12px;
  margin: 8px 0;
  line-height: 1.6;
}
.rune-hero-chart-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  font-size: 12px;
}
.rune-hero-chart-controls label,
.rune-hero-chart-zoom {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
select,
button {
  min-height: 36px;
  background: var(--chip);
  color: var(--text);
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  padding: 4px 8px;
  font: inherit;
}
select {
  max-width: 190px;
}
button {
  cursor: pointer;
}
button:disabled {
  opacity: 0.5;
  cursor: default;
}
button:focus-visible,
select:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.rune-hero-chart-canvas {
  height: 440px;
  width: 100%;
  min-width: 0;
}
.rune-hero-chart-neighbors {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 140px;
  overflow: auto;
  font-size: 12px;
}
.rune-hero-chart-neighbors button {
  display: flex;
  align-items: center;
  gap: 4px;
}
.rune-hero-chart-neighbors button[aria-pressed='true'] {
  border-color: var(--accent);
  color: var(--accent-text);
}
.rune-hero-chart-selection {
  min-height: 44px;
  font-size: 12px;
  line-height: 1.7;
  margin: 8px 0;
  overflow-wrap: anywhere;
}
@media (max-width: 700px) {
  .rune-hero-chart-canvas {
    height: 480px;
  }
  select,
  button {
    min-height: 40px;
  }
  .rune-hero-chart-controls {
    gap: 8px;
  }
  .rune-hero-chart-zoom {
    width: 100%;
  }
}
</style>
