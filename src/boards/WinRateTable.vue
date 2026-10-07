<script setup lang="ts">
import { t } from '@/i18n/i18n'
import { ref, onMounted, onUpdated, onUnmounted } from 'vue'
import { boardCardSize, compactHeroSlots } from './boardCardSize'
import { useBandTransitions } from './useBandTransitions'
const props = defineProps<{
  label: string
  columns: readonly string[]
  rowCount: number
  scrollLabel: string
  layoutRevision?: unknown
}>()
const header = ref<HTMLDivElement | null>(null),
  headerScroll = ref<HTMLDivElement | null>(null)
function syncHeader(event: Event) {
  if (headerScroll.value)
    headerScroll.value.scrollLeft = (event.currentTarget as HTMLElement).scrollLeft
}
// 无论由什么触发，整表进入都使用同一个 240ms 淡入。
const tableRoot = ref<HTMLDivElement | null>(null)
let sizeObserver: ResizeObserver | undefined
let revealFrameId = 0,
  revealAnimation: Animation | undefined
function revealTable() {
  const root = tableRoot.value
  if (!root || matchMedia('(prefers-reduced-motion: reduce)').matches) return
  // 在首次完整布局之后开始，使用缓存数据切换页面时也一样。
  root.style.opacity = '0'
  revealFrameId = requestAnimationFrame(() => {
    revealFrameId = requestAnimationFrame(() => {
      root.style.removeProperty('opacity')
      revealAnimation = root.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 240,
        easing: 'ease-out',
      })
    })
  })
}

let measuredGeometry = '',
  measuredRevision: unknown
let disposed = false
function measurePortraitSize(force = false) {
  const root = tableRoot.value
  if (!root || disposed) return
  const grid = root.querySelector('.board-column-head')
  const geometry = [
    root.getBoundingClientRect().width,
    grid ? getComputedStyle(grid).gridTemplateColumns : '',
    props.rowCount,
    matchMedia('(max-width:700px)').matches,
  ].join('|')
  if (!force && geometry === measuredGeometry && props.layoutRevision === measuredRevision) return
  measuredGeometry = geometry
  measuredRevision = props.layoutRevision
  const compact = matchMedia(
    root.closest('.hero-board') ? '(max-width:1024px)' : '(max-width:700px)',
  ).matches
  const axis =
    root.querySelector('.board-column-head .board-axis')?.getBoundingClientRect().width ||
    (compact ? 32 : 72)
  if (root.closest('.rune-board')) {
    const size = Math.floor(
      boardCardSize('rune', root.getBoundingClientRect().width, axis, compact),
    )
    root.style.setProperty('--uniform-rune-size', size + 'px')
    return
  }
  if (!root.closest('.hero-board')) return
  const focused = root.classList.contains('has-focused-column')
  const slots = compactHeroSlots(window.innerWidth)
  const capacities = compact ? [slots, slots, slots] : [3, 3, 2, 3, 3, 2]
  const cells = Array.from(root.querySelectorAll<HTMLElement>('.board-cell')).map(cell => {
    const style = getComputedStyle(cell)
    const available =
      cell.getBoundingClientRect().width -
      parseFloat(style.borderLeftWidth) -
      parseFloat(style.borderRightWidth) -
      parseFloat(style.paddingLeft) -
      parseFloat(style.paddingRight)
    const gap = parseFloat(style.columnGap) || 0
    const index = capacities.findIndex((_, i) => cell.classList.contains('board-role-' + i))
    const capacity = capacities[index] || 2
    return { cell, capacity, available, gap }
  })
  const size = boardCardSize('hero', root.getBoundingClientRect().width, axis, compact)
  root.style.setProperty('--uniform-hero-size', size + 'px')
  root.style.setProperty(
    '--hero-route-icon-size',
    (size === 54 ? 22 : size === 48 ? 20 : 18) + 'px',
  )
  root.style.setProperty('--portrait-rate-font-size', (size === 54 ? 11 : 10) + 'px')
  for (const { cell, capacity, available, gap } of cells) {
    cell.style.setProperty(
      '--hero-cell-columns',
      String(focused ? Math.max(1, Math.floor((available + gap + 0.01) / (size + gap))) : capacity),
    )
    cell.classList.remove('fits-single-portrait')
  }
}
// 每次表格更新后重新测量（相同几何会被跳过）
onUpdated(measurePortraitSize)
// 刚挂载时头像先按默认尺寸布局，测量后才写入实际尺寸档；这一次不播放尺寸过渡，
// 否则头像在 120ms 内缩放，整张表的行高跟着连续变化，切换榜单时看起来像抖动。
// 挂载两帧后恢复过渡，窗口缩放、筛选列等后续尺寸变化仍有动画。
const settling = ref(true)
onMounted(() => {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      settling.value = false
    }),
  )
  let observedWidth = -1
  sizeObserver = new ResizeObserver(entries => {
    const width = entries[0]?.contentRect.width
    // 展开详情每帧都会改变高度，但不会改变列宽，只在宽度变化时重新测量。
    if (width === undefined || Math.abs(width - observedWidth) < 0.5) return
    observedWidth = width
    measurePortraitSize()
  })
  if (tableRoot.value) sizeObserver.observe(tableRoot.value)
  measurePortraitSize()
  revealTable()
  void document.fonts.ready.then(() => {
    if (!disposed) measurePortraitSize(true)
  })
  document.fonts.addEventListener('loadingdone', fontChanged)
})
function fontChanged() {
  measurePortraitSize(true)
}
onUnmounted(() => {
  disposed = true
  document.fonts.removeEventListener('loadingdone', fontChanged)
  sizeObserver?.disconnect()
  cancelAnimationFrame(revealFrameId)
  revealAnimation?.cancel()
})
// ---- 区间标签过渡（须在上面的 onUpdated 测量之后注册） ----
const { fadeNextBands, revealBands, beginBandLayout, finishBandLayout } = useBandTransitions(
  tableRoot,
  header,
  measurePortraitSize,
)
defineExpose({ header, fadeNextBands, revealBands, beginBandLayout, finishBandLayout })
</script>
<template>
  <div
    ref="tableRoot"
    class="board-table"
    :class="{ 'is-settling': settling }"
    role="table"
    :aria-label="label"
    :aria-rowcount="rowCount"
    :aria-colcount="columns.length + 1"
  >
    <div ref="header" class="board-sticky-header">
      <slot name="toolbar" />
      <div ref="headerScroll" class="board-header-scroll" role="rowgroup">
        <div class="board-grid">
          <div class="board-row board-column-head" role="row">
            <div class="board-axis" role="columnheader">{{ t('胜率') }}</div>
            <div
              v-for="(column, index) in columns"
              :key="column"
              role="columnheader"
              class="board-column"
              :class="'board-role-' + index"
            >
              <slot name="column" :column="column" :index="index">{{ t(column) }}</slot>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="board-scroll" tabindex="0" :aria-label="scrollLabel" @scroll="syncHeader">
      <div class="board-grid board-range-layout" role="rowgroup"><slot /></div>
      <slot name="empty" />
    </div>
  </div>
</template>
