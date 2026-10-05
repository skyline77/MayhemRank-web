<script setup lang="ts">
import { t } from '@/i18n/i18n'
import { ref, onMounted, onBeforeUpdate, onUpdated, onUnmounted } from 'vue'
import { boardCardSize, compactHeroSlots } from './boardCardSize'
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
// Every table update shares the same band transition, regardless of its trigger.
const tableRoot = ref<HTMLDivElement | null>(null)
let sizeObserver: ResizeObserver | undefined
let revealFrameId = 0,
  revealAnimation: Animation | undefined
function revealTable() {
  const root = tableRoot.value
  if (!root || matchMedia('(prefers-reduced-motion: reduce)').matches) return
  // Start after the first complete layout, including cached-data navigation.
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
onMounted(() => {
  let observedWidth = -1
  sizeObserver = new ResizeObserver(entries => {
    const width = entries[0]?.contentRect.width
    // Opening a detail changes height every frame, but never the column geometry.
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
let batchingBands = false
let previousBands = new Map<
  string,
  { top: number; left: number; width: number; height: number; copy: HTMLElement }
>()
let bandCopies: HTMLElement[] = []
let bandAnimations: Animation[] = []
let fadeNextUpdate = false
let revealFrame = 0
function fadeNextBands() {
  cancelAnimationFrame(revealFrame)
  fadeNextUpdate = true
  stopBands()
  // Keep labels visible while detail height and sticky geometry settle.
}
function revealBands() {
  if (!fadeNextUpdate) return
  cancelAnimationFrame(revealFrame)
  if (document.documentElement.classList.contains('is-detail-moving')) {
    revealFrame = requestAnimationFrame(revealBands)
    return
  }
  // Wait for detail removal, scroll compensation and sticky-header restoration.
  revealFrame = requestAnimationFrame(() => {
    revealFrame = requestAnimationFrame(() => {
      if (document.documentElement.classList.contains('is-detail-moving')) {
        revealBands()
        return
      }
      fadeNextUpdate = false
      // The detail transition already moved the rows. Do not replay a second
      // fade or position animation after the final grid update.
      previousBands.clear()
    })
  })
}
function stopBands() {
  bandAnimations.forEach(animation => animation.cancel())
  bandAnimations = []
  bandCopies.forEach(copy => copy.remove())
  bandCopies = []
}
function bandLabels() {
  return Array.from(
    tableRoot.value?.querySelectorAll<HTMLElement>('.board-range-label:not(.band-fade-copy)') || [],
  )
}
function captureBands() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    stopBands()
    return
  }
  previousBands = new Map(
    bandLabels().flatMap(band => {
      const label = band.querySelector<HTMLElement>('b')
      if (!label) return []
      const rect = label.getBoundingClientRect(),
        copy = document.createElement('div')
      copy.className = 'board-range-label band-fade-copy'
      copy.setAttribute('aria-hidden', 'true')
      copy.style.setProperty('--range-ink', getComputedStyle(band).getPropertyValue('--range-ink'))
      copy.append(label.cloneNode(true))
      return [
        [
          band.dataset.range!,
          {
            top: rect.top + window.scrollY,
            left: rect.left + window.scrollX,
            width: rect.width,
            height: rect.height,
            copy,
          },
        ] as const,
      ]
    }),
  )
  stopBands()
}
function beginBandLayout() {
  captureBands()
  batchingBands = true
}
function finishBandLayout() {
  batchingBands = false
  measurePortraitSize()
  animateBands()
}
onBeforeUpdate(() => {
  if (!batchingBands) captureBands()
})
onUpdated(() => {
  measurePortraitSize()
  if (batchingBands) return
  animateBands()
})
function animateBands() {
  if (document.documentElement.classList.contains('is-detail-moving')) {
    fadeNextBands()
    revealBands()
    return
  }
  if (fadeNextUpdate) {
    revealBands()
    return
  }
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const root = tableRoot.value
  if (!root) return
  const bounds = root.getBoundingClientRect(),
    current = new Map(bandLabels().map(band => [band.dataset.range!, band]))
  for (const [key, previous] of previousBands) {
    const label = current.get(key)?.querySelector<HTMLElement>('b')
    if (label && Math.abs(label.getBoundingClientRect().top + window.scrollY - previous.top) < 0.5)
      continue
    if (
      previous.top + previous.height < window.scrollY ||
      previous.top > window.scrollY + innerHeight
    )
      continue
    const copy = previous.copy
    Object.assign(copy.style, {
      position: 'absolute',
      left: previous.left - window.scrollX - bounds.left + 'px',
      top: previous.top - window.scrollY - bounds.top + 'px',
      width: previous.width + 'px',
      height: previous.height + 'px',
      display: 'grid',
      placeItems: 'center',
      border: '0',
      padding: '0',
      background: 'transparent',
      pointerEvents: 'none',
      zIndex: '2',
      clipPath:
        'inset(' +
        Math.max(
          0,
          (header.value?.getBoundingClientRect().bottom ?? 0) - (previous.top - window.scrollY),
        ) +
        'px 0 0 0)',
    })
    root.append(copy)
    bandCopies.push(copy)
    const animation = copy.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 120,
      easing: 'ease-out',
      fill: 'both',
    })
    bandAnimations.push(animation)
    void animation.finished.then(
      () => copy.remove(),
      () => {},
    )
  }
  for (const [key, band] of current) {
    const label = band.querySelector<HTMLElement>('b')
    if (!label) continue
    const previous = previousBands.get(key),
      rect = label.getBoundingClientRect()
    if (previous && Math.abs(previous.top - rect.top - window.scrollY) < 0.5) continue
    if (rect.bottom < 0 || rect.top > innerHeight) continue
    bandAnimations.push(
      label.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 180,
        delay: previous ? 80 : 0,
        easing: 'ease-out',
        fill: 'both',
      }),
    )
  }
}
onUnmounted(() => {
  cancelAnimationFrame(revealFrame)
  stopBands()
})
defineExpose({ header, fadeNextBands, revealBands, beginBandLayout, finishBandLayout })
</script>
<template>
  <div
    ref="tableRoot"
    class="board-table"
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
