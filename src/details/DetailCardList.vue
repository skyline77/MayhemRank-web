<script setup lang="ts">
import OverlayScrollbar from './OverlayScrollbar.vue'
import { scheduleDetailMeasurement, cancelDetailMeasurement } from './detailMeasurements'
import { createBoardReflow } from '@/boards/boardReflow'
import { matchingScrollOffset } from '@/shared/lockedOrder'
import {
  computed,
  inject,
  nextTick,
  onMounted,
  onUnmounted,
  onUpdated,
  ref,
  watch,
  watchEffect,
} from 'vue'
import { detailPaginationKey, pageWindow } from './detailPagination'
defineOptions({ inheritAttrs: false })
const props = defineProps<{
  managedExpansion?: boolean
  overlayScrollbar?: boolean
  expanded?: boolean
  loading?: boolean
  resetKey?: string
  itemCount?: number
  batchSize?: number
  matchKey?: string
  matchRevision?: unknown
}>()
const scroller = ref<HTMLElement | null>(null),
  hasMore = ref(false),
  hasPrevious = ref(false),
  hasAbove = ref(false),
  hasBelow = ref(false)
const visibleCount = ref(
  props.expanded ? props.itemCount || props.batchSize || Infinity : props.batchSize || Infinity,
)
const pagination = inject(detailPaginationKey, null),
  listId = Symbol('card-list')
const paginated = computed(() => !!pagination?.enabled.value)
if (pagination)
  pagination.lists.push({ id: listId, count: props.itemCount || 0, loading: !!props.loading })
watchEffect(() => {
  const entry = pagination?.lists.find(list => list.id === listId)
  if (entry) {
    entry.count = props.itemCount || 0
    entry.loading = !!props.loading
  }
})
const pageRange = computed(() => {
  if (!paginated.value || !pagination) return { start: 0, end: Infinity }
  const offset = pagination.lists
    .slice(
      0,
      pagination.lists.findIndex(list => list.id === listId),
    )
    .reduce((sum, list) => sum + list.count, 0)
  const total = pagination.lists.reduce((sum, list) => sum + list.count, 0)
  const range = pageWindow(total, pagination.page.value, pagination.size.value)
  const count = props.itemCount || 0
  return {
    start: Math.max(0, Math.min(count, range.start - offset)),
    end: Math.max(0, Math.min(count, range.end - offset)),
  }
})
function pageItems<T>(
  items: readonly T[],
  legacyEnd: number | undefined = undefined,
): readonly T[] {
  return paginated.value
    ? items.slice(pageRange.value.start, pageRange.value.end)
    : items.slice(0, legacyEnd)
}
function syncPageRow() {
  scroller.value
    ?.closest('.build-detail-row')
    ?.classList.toggle(
      'detail-page-hidden',
      paginated.value &&
        !props.loading &&
        !!props.itemCount &&
        pageRange.value.start === pageRange.value.end,
    )
}
watch([paginated, pageRange, () => props.loading], syncPageRow, { flush: 'post' })
watch(
  () => props.resetKey,
  () => {
    if (paginated.value && pagination) pagination.page.value = 1
  },
)
let observer: ResizeObserver | undefined
let expandedRow: HTMLElement | null = null
const expansionReflow = createBoardReflow(
  '.build-stat-card[data-detail-card-id]',
  'data-detail-card-id',
  true,
)
let expansionAnimation: Animation | undefined,
  expansionRevision = 0
watch(
  () => props.expanded,
  async () => {
    const element = scroller.value
    if (props.managedExpansion) {
      if (props.expanded) visibleCount.value = props.itemCount || Infinity
      await nextTick()
      element?.scrollTo({ left: 0 })
      schedule()
      return
    }
    const mobile = window.matchMedia('(max-width:700px)').matches
    const viewport = mobile
      ? element?.closest<HTMLElement>('.build-detail-row')
      : element?.parentElement
    if (!element || !viewport) return
    const revision = ++expansionRevision
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const height = reduced ? 0 : viewport.getBoundingClientRect().height
    expansionAnimation?.cancel()
    expansionAnimation = undefined
    const movement = expansionReflow.run(
      mobile ? viewport : element,
      async () => {
        if (props.expanded && props.batchSize)
          visibleCount.value = props.itemCount || props.batchSize
        element.scrollLeft = 0
        if (mobile) viewport.scrollTop = 0
        await nextTick()
        if (revision !== expansionRevision || reduced) return
        const target = (mobile ? viewport : element).getBoundingClientRect().height
        if (Math.abs(target - height) > 0.5)
          expansionAnimation = viewport.animate(
            [{ height: height + 'px' }, { height: target + 'px' }],
            { duration: 260, easing: 'cubic-bezier(.2,0,0,1)', fill: 'both' },
          )
      },
      { clipToRoot: true, maxTravelSlots: 10 },
    )
    await movement
    if (revision !== expansionRevision) return
    const animation = expansionAnimation as Animation | undefined
    if (animation)
      try {
        await animation.finished
      } catch {
        // 动画被取消时 finished 会拒绝；无论完成或取消都继续收尾
      }
    if (revision === expansionRevision) {
      animation?.cancel()
      expansionAnimation = undefined
      schedule()
    }
  },
)
// Statistics update directly in Vue. No old-content clones, DOM signatures,
// number interpolation or decorative effects on unrelated component updates.
function measure() {
  if (props.loading || paginated.value) return
  const element = scroller.value,
    row = expandedRow
  if (!element?.isConnected || element.clientWidth === 0) return
  const vertical =
    !!element.closest('.mobile-tab-row') && window.matchMedia('(max-width:700px)').matches
  const cardAbove = vertical && element.scrollTop > 1
  const cardBelow = vertical && element.scrollHeight - element.clientHeight - element.scrollTop > 1
  const more = !!props.expanded && !!row && row.scrollHeight - row.clientHeight - row.scrollTop > 1
  const above = !!props.expanded && !!row && row.scrollTop > 1
  const upper = row?.scrollTop || 0,
    bottom = upper + (row?.clientHeight || 0) - 28
  const previous = !props.expanded && element.scrollLeft > 1
  const remaining = element.scrollWidth - element.clientWidth - element.scrollLeft
  const moreHorizontal = !props.expanded && remaining > 1
  // Fill a widened viewport and prefetch another batch before its current end.
  const grow =
    !paginated.value &&
    !props.expanded &&
    !!props.batchSize &&
    visibleCount.value < (props.itemCount || 0) &&
    remaining < 150
  return () => {
    row?.classList.toggle('has-more-below', more)
    row?.classList.toggle('has-more-above', above)
    if (above) row?.style.setProperty('--scroll-shadow-upper-top', upper + 'px')
    if (more) row?.style.setProperty('--scroll-shadow-top', bottom + 'px')
    hasAbove.value = cardAbove
    hasBelow.value = cardBelow
    hasPrevious.value = previous
    hasMore.value = moreHorizontal || grow
    if (grow) visibleCount.value = Math.min(props.itemCount!, visibleCount.value + props.batchSize!)
  }
}
function schedule() {
  if (!props.loading) scheduleDetailMeasurement(measure)
}
function scroll() {
  schedule()
}
onMounted(() => {
  syncPageRow()
  observer = new ResizeObserver(schedule)
  if (scroller.value) observer.observe(scroller.value)
  expandedRow = scroller.value?.closest<HTMLElement>('.build-detail-row') || null
  if (expandedRow) {
    observer.observe(expandedRow)
    expandedRow.addEventListener('scroll', schedule, { passive: true })
  }
  schedule()
})
// Reuse the viewport and reset its position explicitly instead of remounting it.
watch(
  [() => props.loading, () => props.resetKey],
  ([loading, key], [wasLoading, oldKey]) => {
    if (!loading && (wasLoading || key !== oldKey)) {
      visibleCount.value = props.expanded
        ? props.itemCount || props.batchSize || Infinity
        : props.batchSize || Infinity
      if (scroller.value) scroller.value.scrollLeft = 0
      schedule()
    }
  },
  { flush: 'post' },
)
// Highlight immediately, but wait for typing to settle before moving the viewport.
// Watch cleanup cancels pending movement on another keystroke, unlock, clear or unmount.
watch(
  [() => props.matchKey, () => props.matchRevision, () => props.loading],
  (_value, _previous, onCleanup) => {
    if (!props.matchKey || props.loading) return
    const timer = setTimeout(() => {
      const element = scroller.value
      if (!element || !props.matchKey || props.loading) return
      const box = element.getBoundingClientRect()
      const matches = Array.from(
        element.querySelectorAll<HTMLElement>('[data-search-match="true"]'),
      ).map(card => card.getBoundingClientRect())
      const left = matchingScrollOffset(
        { left: box.left, right: box.left + element.clientWidth },
        matches,
        element.scrollLeft,
      )
      if (left !== null)
        element.scrollTo({
          left,
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 'instant'
            : 'smooth',
        })
    }, 500)
    onCleanup(() => clearTimeout(timer))
  },
  { flush: 'post' },
)
// Read the new content after Vue patches it, before painting a stale shadow state.
// Scroll/resize events still coalesce into one measurement per animation frame.
onUpdated(() => {
  schedule()
  syncPageRow()
})
onUnmounted(() => {
  if (pagination) {
    const index = pagination.lists.findIndex(list => list.id === listId)
    if (index >= 0) pagination.lists.splice(index, 1)
  }
})
onUnmounted(() => {
  expandedRow?.removeEventListener('scroll', schedule)
  expandedRow?.classList.remove('has-more-below', 'has-more-above')
  expansionRevision++
  expansionReflow.stop()
  expansionAnimation?.cancel()
  observer?.disconnect()
  cancelDetailMeasurement(measure)
})
</script>
<template>
  <div
    class="detail-card-viewport"
    :class="{
      'has-overlay-scrollbar': overlayScrollbar && !expanded,
      'is-paginated': paginated,
      'has-more': hasMore,
      'has-previous': hasPrevious,
      'is-expanded': expanded,
      'has-above': hasAbove,
      'has-below': hasBelow,
    }"
  >
    <div ref="scroller" v-bind="$attrs" class="build-detail-cards" @scroll.passive="scroll">
      <slot :visible-count="visibleCount" :page-items="pageItems" :paginated="paginated" />
    </div>
    <OverlayScrollbar v-if="overlayScrollbar && !expanded" :target="scroller" />
  </div>
</template>
<style scoped>
.detail-card-viewport {
  position: relative;
  min-width: 0;
  overflow: clip;
  overflow-anchor: none;
}
.is-expanded .build-detail-cards {
  height: auto;
  padding-bottom: 14px;
  grid-auto-flow: row;
  grid-template-columns: repeat(auto-fill, var(--detail-card-width));
  grid-auto-rows: max-content;
  overflow-x: hidden;
}
.build-detail-cards {
  position: relative;
}
.detail-card-viewport :deep(.stat-card-frame) {
  position: relative;
}
.detail-card-viewport :deep(.stat-card-layout) {
  position: relative;
}
.detail-card-viewport::before,
.detail-card-viewport::after {
  content: '';
  position: absolute;
  z-index: 1;
  top: 0;
  right: 0;
  bottom: 14px;
  width: 100%;
  pointer-events: none;
  opacity: 0;
  transition: opacity 120ms ease;
}
.detail-card-viewport::before {
  box-shadow: rgba(0, 0, 0, 0.5) 50px 0 20px -28px inset;
}
.detail-card-viewport::after {
  box-shadow: rgba(0, 0, 0, 0.5) -50px 0 20px -28px inset;
}
.detail-card-viewport.has-previous::before {
  opacity: 1;
}
.detail-card-viewport.has-more::after {
  opacity: 1;
}
@media (max-width: 700px) {
  :global(.mobile-tab-row .detail-card-viewport::before),
  :global(.mobile-tab-row .detail-card-viewport::after) {
    height: 20px;
    bottom: auto;
    box-shadow: none;
    opacity: 0.18;
    background: linear-gradient(to bottom, var(--detail-edge-shadow), transparent);
  }
  :global(.mobile-tab-row .detail-card-viewport::after) {
    top: auto;
    bottom: 0;
    background: linear-gradient(to top, var(--detail-edge-shadow), transparent);
  }
  :global(.mobile-tab-row .detail-card-viewport.has-above::before),
  :global(.mobile-tab-row .detail-card-viewport.has-below::after) {
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .detail-card-viewport::before,
  .detail-card-viewport::after {
    transition: none;
  }
}
</style>

<style scoped>
.has-overlay-scrollbar .build-detail-cards {
  scrollbar-width: none;
}
.has-overlay-scrollbar .build-detail-cards::-webkit-scrollbar {
  display: none;
}
</style>
