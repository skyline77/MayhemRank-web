<script setup lang="ts">
import { t, message } from './i18n'
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { closeTip } from './tooltip'
import DetailPageScope from './DetailPageScope.vue'
import StatCardFrame from './StatCardFrame.vue'
const props = defineProps<{
  enabled: boolean
  paintWithIndicator?: boolean
  panelId: string
  tabs: readonly { id: string; label: string; css?: string; paginated?: boolean }[]
  label?: string
}>()
const compact = computed(() => props.enabled),
  mobileTabs = props.tabs,
  panelId = props.panelId
const mobileTab = ref(mobileTabs[0]!.id)
const renderedTab = ref(mobileTab.value)
let mountFrame = 0
// 首次挂载等待滑动到位；手势切换在结束后让出一帧再挂载。
watch(
  mobileTab,
  id => {
    cancelAnimationFrame(mountFrame)
    mountFrame = requestAnimationFrame(() => {
      mountFrame = requestAnimationFrame(() => {
        if (!requestedTab && mobileTab.value === id) renderedTab.value = id
      })
    })
  },
  { flush: 'sync' },
)
onUnmounted(() => cancelAnimationFrame(mountFrame))
const visitedTabs = ref(new Set<string>([mobileTab.value]))
watch(renderedTab, id => visitedTabs.value.add(id), { flush: 'sync' })
const transitionHeight = ref<number | null>(null)
const pageEnabled = computed(
  () => compact.value && mobileTabs.find(tab => tab.id === mobileTab.value)?.paginated !== false,
)
const cardPage = ref(1),
  cardPages = ref(1),
  cardsLoading = ref(false)
const pageSize = computed(() =>
  mobileTab.value === 'pairs' ? 6 : Number(mobileGeometry.value['--mobile-columns']) * 3,
)
const pageStates = new Map<string, { pages: number; loading: boolean }>()
function updatePageState(id: string, state: { pages: number; loading: boolean }) {
  pageStates.set(id, state)
  if (id === mobileTab.value) {
    cardPages.value = state.pages
    cardsLoading.value = state.loading
  }
}
function turnPage(delta: number) {
  closeTip()
  cardPage.value = Math.max(1, Math.min(cardPages.value, cardPage.value + delta))
}
watch(mobileTab, id => {
  cardPage.value = 1
  cardPages.value = pageStates.get(id)?.pages || 1
  cardsLoading.value = pageStates.get(id)?.loading ?? true
})
const tabStrip = ref<HTMLElement | null>(null),
  tabIndicator = ref<HTMLElement | null>(null)
let tabTextBounds: { left: number; width: number; highlight: HTMLElement | null }[] = []
let indicatorFrame = 0
const mobileGeometry = ref<Record<string, string>>({
  '--mobile-columns': '4',
  '--mobile-card-gap': '8px',
  '--tab-left': '0px',
  '--tab-width': '28px',
})
function measureMobileGeometry() {
  const strip = tabStrip.value
  if (!strip) return
  const width = strip.clientWidth,
    columns = Math.max(1, Math.floor((width + 6) / 82))
  // 两侧各占两个间距：总宽 = 卡片宽 × 列数 + 间距 × (列数 + 3)。
  const gap = Math.max(0, (width - columns * 76) / (columns + 3))
  strip
    .closest<HTMLElement>('.build-detail')
    ?.style.setProperty('--mobile-card-inset', 2 * gap + 'px')
  const root = strip.getBoundingClientRect()
  tabTextBounds = Array.from(strip.querySelectorAll<HTMLElement>('.hero-tab-text')).map(text => {
    const box = text.getBoundingClientRect()
    return {
      left: box.left - root.left,
      width: box.width,
      highlight: text.querySelector<HTMLElement>('.hero-tab-highlight'),
    }
  })
  mobileGeometry.value = {
    '--mobile-columns': String(columns),
    '--mobile-card-gap': gap + 'px',
    '--tab-left': '0px',
    '--tab-width': '28px',
    '--pager-start-inset': Math.max(0, (tabTextBounds[1]?.left ?? width / 5) - width / 5) + 'px',
    '--pager-end-inset':
      Math.max(
        0,
        width - ((tabTextBounds.at(-1)?.left ?? width) + (tabTextBounds.at(-1)?.width ?? 0)),
      ) + 'px',
  }
  mobileGeometry.value['--mobile-pair-width'] = (width - 5 * gap) / 2 + 'px'
  syncTabIndicator()
}
watch(
  tabStrip,
  (strip, _old, onCleanup) => {
    if (!strip) return
    const observer = new ResizeObserver(measureMobileGeometry)
    observer.observe(strip)
    let active = true
    void document.fonts.ready.then(() => {
      if (active) measureMobileGeometry()
    })
    measureMobileGeometry()
    onCleanup(() => {
      active = false
      observer.disconnect()
    })
  },
  { flush: 'post' },
)
watch(mobileTab, measureMobileGeometry, { flush: 'post' })
const tabTrack = ref<HTMLElement | null>(null)
const retainedContentHeight = ref(0),
  pageControlsHeight = ref(0)
watch(
  tabTrack,
  (track, _old, onCleanup) => {
    if (!track) return
    let width = track.clientWidth
    const measure = () => {
      if (!compact.value) {
        retainedContentHeight.value = 0
        pageControlsHeight.value = 0
        return
      }
      if (track.clientWidth !== width) {
        width = track.clientWidth
        retainedContentHeight.value = 0
      }
      const controls = track
        .closest('.detail-category-tabs')
        ?.querySelector<HTMLElement>('.detail-card-pagination')
      pageControlsHeight.value = controls?.getBoundingClientRect().height || 0
      const pane = track.children[tabIndex.value] as HTMLElement | undefined
      if (pane)
        retainedContentHeight.value = Math.max(
          retainedContentHeight.value,
          Math.ceil(pane.getBoundingClientRect().height + pageControlsHeight.value),
        )
    }
    const observer = new ResizeObserver(measure)
    observer.observe(track)
    for (const pane of Array.from(track.children)) observer.observe(pane)
    const stop = watch(mobileTab, measure, { flush: 'post' })
    measure()
    onCleanup(() => {
      observer.disconnect()
      stop()
    })
  },
  { flush: 'post' },
)
const tabIndex = computed(() => mobileTabs.findIndex(tab => tab.id === mobileTab.value))
const contentTabs = computed(() =>
  compact.value ? mobileTabs : [{ id: 'desktop', label: '', css: '', paginated: false }],
)
let settleTimer: ReturnType<typeof setTimeout> | undefined
function syncTabIndicator() {
  const track = tabTrack.value,
    indicator = tabIndicator.value
  if (!indicator || !tabTextBounds.length) return
  const progress = Math.max(
    0,
    Math.min(
      tabTextBounds.length - 1,
      track?.clientWidth ? track.scrollLeft / track.clientWidth : tabIndex.value,
    ),
  )
  const index = Math.floor(progress),
    fraction = progress - index
  const from = tabTextBounds[index]!,
    to = tabTextBounds[Math.min(index + 1, tabTextBounds.length - 1)]!
  // 直接插值已缓存的文字边界，滚动时不触发卡片重新渲染，也不追加缓动延迟。
  const left = from.left + (to.left - from.left) * fraction,
    width = from.width + (to.width - from.width) * fraction
  indicator.style.transform = `translateX(${left}px)`
  indicator.style.width = width + 'px'
  // 黄色文字与下划线使用同一帧、同一横向范围，支持半个字的覆盖。
  if (props.paintWithIndicator)
    for (const text of tabTextBounds) {
      const start = Math.max(0, Math.min(text.width, left - text.left))
      const end = Math.max(start, Math.min(text.width, left + width - text.left))
      if (text.highlight)
        text.highlight.style.clipPath = `inset(0 ${text.width - end}px 0 ${start}px)`
    }
}

let requestedTab: string | null = null
let requestedTimer: ReturnType<typeof setTimeout> | undefined
function releaseRequestedTab(commit = true) {
  const destination = requestedTab
  requestedTab = null
  transitionHeight.value = null
  clearTimeout(requestedTimer)
  if (commit && destination === mobileTab.value) renderedTab.value = destination
}
function settleTabScroll() {
  syncTabIndicator()
  clearTimeout(settleTimer)
  const track = tabTrack.value
  if (!compact.value || !track?.clientWidth) return
  if (requestedTab) {
    const target = mobileTabs.findIndex(tab => tab.id === requestedTab) * track.clientWidth
    if (Math.abs(track.scrollLeft - target) > 1) return
    releaseRequestedTab()
  }
  const index = Math.max(
    0,
    Math.min(mobileTabs.length - 1, Math.round(track.scrollLeft / track.clientWidth)),
  )
  if (mobileTab.value !== mobileTabs[index]!.id) {
    closeTip()
    mobileTab.value = mobileTabs[index]!.id
  }
}
function trackTabScroll() {
  if (!indicatorFrame)
    indicatorFrame = requestAnimationFrame(() => {
      indicatorFrame = 0
      syncTabIndicator()
    })
  clearTimeout(settleTimer)
  settleTimer = setTimeout(settleTabScroll, 120)
}
async function selectMobileTab(id: string) {
  if (id === mobileTab.value) return
  clearTimeout(settleTimer)
  releaseRequestedTab(false)
  requestedTab = id
  transitionHeight.value = tabTrack.value?.getBoundingClientRect().height ?? null
  // 隐藏旧分类前同步保留高度，避免首次点击早于 ResizeObserver 回调。
  if (transitionHeight.value !== null)
    retainedContentHeight.value = Math.max(
      retainedContentHeight.value,
      transitionHeight.value + pageControlsHeight.value,
    )
  closeTip()
  mobileTab.value = id
  await nextTick()
  if (requestedTab !== id) return
  const track = tabTrack.value
  track?.scrollTo({
    left: tabIndex.value * track.clientWidth,
    behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'instant' : 'smooth',
  })
  requestedTimer = setTimeout(() => {
    if (requestedTab !== id || !track) return
    track.scrollTo({
      left: mobileTabs.findIndex(tab => tab.id === id) * track.clientWidth,
      behavior: 'instant',
    })
    releaseRequestedTab()
    syncTabIndicator()
  }, 900)
}
watch(
  tabTrack,
  (track, _old, onCleanup) => {
    if (!track) return
    let width = 0
    const observer = new ResizeObserver(() => {
      if (!compact.value || track.clientWidth === width) return
      width = track.clientWidth
      track.scrollTo({ left: tabIndex.value * width, behavior: 'instant' })
    })
    observer.observe(track)
    onCleanup(() => observer.disconnect())
  },
  { flush: 'post' },
)
onUnmounted(() => {
  releaseRequestedTab(false)
  clearTimeout(settleTimer)
  cancelAnimationFrame(indicatorFrame)
})
async function navigateMobileTabs(event: KeyboardEvent, index: number) {
  const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
  if (!delta && event.key !== 'Home' && event.key !== 'End') return
  event.preventDefault()
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? mobileTabs.length - 1
        : (index + delta + mobileTabs.length) % mobileTabs.length
  selectMobileTab(mobileTabs[next]!.id)
  await nextTick()
  tabStrip.value
    ?.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')
    ?.focus({ preventScroll: true })
}
</script>
<template>
  <div
    class="detail-category-tabs"
    :class="{ 'pairs-tab': compact && mobileTab === 'pairs' }"
    :style="{
      ...mobileGeometry,
      '--tab-count': tabs.length,
      ...(compact && mobileTab === 'pairs' ? { '--mobile-columns': '2' } : {}),
    }"
  >
    <div
      v-if="compact"
      ref="tabStrip"
      class="hero-detail-tabs"
      :class="{ 'indicator-painted': paintWithIndicator }"
      :style="mobileGeometry"
      role="tablist"
      :aria-label="label || t('统计分类')"
    >
      <button
        v-for="(tab, index) in mobileTabs"
        :key="tab.id"
        :id="panelId + '-tab-' + tab.id"
        type="button"
        role="tab"
        :class="tab.css"
        :aria-selected="mobileTab === tab.id"
        :aria-controls="panelId + '-tab-panel'"
        :tabindex="mobileTab === tab.id ? 0 : -1"
        @click="selectMobileTab(tab.id)"
        @keydown="navigateMobileTabs($event, index)"
      >
        <span class="hero-tab-text"
          >{{ t(tab.label)
          }}<span v-if="paintWithIndicator" class="hero-tab-highlight" aria-hidden="true">{{
            t(tab.label)
          }}</span></span
        >
      </button>
      <span ref="tabIndicator" class="hero-tab-indicator" aria-hidden="true"></span>
    </div>

    <div
      v-if="compact"
      :style="{ visibility: pageEnabled ? undefined : 'hidden' }"
      :aria-hidden="!pageEnabled || undefined"
      :inert="!pageEnabled"
      class="detail-card-pagination"
      :class="{
        'hero-pagination': mobileTabs[0]?.css === 'prismatic',
        'rune-pagination': mobileTabs[0]?.id === 'heroes',
      }"
      :aria-label="t('翻页')"
    >
      <span class="detail-card-page-count" aria-live="polite">{{
        message('{current}/{total}页', { current: cardPage, total: cardPages })
      }}</span>
      <button type="button" :disabled="cardsLoading || cardPage <= 1" @click="turnPage(-1)">
        {{ t('上一页') }}
      </button>
      <button type="button" :disabled="cardsLoading || cardPage >= cardPages" @click="turnPage(1)">
        {{ t('下一页') }}
      </button>
    </div>
    <div
      class="category-content"
      :aria-busy="compact && (renderedTab !== mobileTab || cardsLoading)"
      :class="{ 'mobile-tab-content': compact }"
      :id="compact ? panelId + '-tab-panel' : undefined"
      :role="compact ? 'tabpanel' : undefined"
      :aria-labelledby="compact ? panelId + '-tab-' + mobileTab : undefined"
      :tabindex="compact ? 0 : undefined"
    >
      <div
        v-if="compact && pageEnabled && (renderedTab !== mobileTab || cardsLoading)"
        class="detail-tab-loading"
        role="status"
        :aria-label="t('正在读取当前范围的统计……')"
      >
        <div
          class="detail-loading-cards"
          :style="{ '--stat-card-metric-count': mobileTabs[0]?.id === 'heroes' ? 3 : 2 }"
          aria-hidden="true"
        >
          <StatCardFrame v-for="index in pageSize" :key="index" class="detail-loading-card"
            ><span></span
            ><span
              v-for="metric in mobileTabs[0]?.id === 'heroes' ? 3 : 2"
              :key="metric"
              class="detail-loading-metric"
            ></span
          ></StatCardFrame>
        </div>
      </div>
      <div
        ref="tabTrack"
        class="hero-tab-track"
        :style="
          compact
            ? {
                height: transitionHeight === null ? undefined : transitionHeight + 'px',
                minHeight:
                  (transitionHeight ?? Math.max(0, retainedContentHeight - pageControlsHeight)) +
                  'px',
                overflowY: transitionHeight === null ? undefined : 'clip',
              }
            : undefined
        "
        @pointerdown="releaseRequestedTab()"
        @touchstart.passive="releaseRequestedTab()"
        @scroll.passive="trackTabScroll"
        @scrollend="settleTabScroll"
      >
        <div
          v-for="tab in contentTabs"
          :key="tab.id"
          class="hero-tab-pane"
          :class="{ 'unpaged-tab-pane': tab.paginated === false }"
          :aria-hidden="compact && tab.id !== mobileTab ? true : undefined"
          :inert="compact && tab.id !== mobileTab"
        >
          <div v-show="!compact || tab.id === mobileTab" style="display: contents">
            <DetailPageScope
              v-if="
                !compact ||
                (tab.id === mobileTab && renderedTab === mobileTab) ||
                visitedTabs.has(tab.id)
              "
              :enabled="compact && tab.paginated !== false"
              :page="cardPage"
              :size="pageSize"
              @page="(!compact || tab.id === mobileTab) && (cardPage = $event)"
              @state="updatePageState(tab.id, $event)"
            >
              <slot :tab="tab" :active="!compact || tab.id === mobileTab" />
            </DetailPageScope>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.detail-category-tabs,
.category-content,
.hero-tab-track,
.hero-tab-pane {
  display: contents;
}
.detail-tab-loading {
  position: absolute;
  inset: 0;
  z-index: 3;
  background: var(--detail-surface);
  pointer-events: none;
}
.detail-loading-cards {
  display: grid;
  grid-template-columns: repeat(var(--mobile-columns), var(--detail-card-width));
  gap: 10px var(--mobile-card-gap);
  padding: 10px calc(2 * var(--mobile-card-gap));
  align-content: start;
  justify-content: center;
}
.detail-loading-metric {
  border-top: 1px solid var(--border);
}
@media (max-width: 700px) {
  .detail-category-tabs {
    display: block;
    min-width: 0;
    grid-column: 1 / -1;
    --detail-card-width: 76px;
  }
  .detail-category-tabs.pairs-tab {
    --detail-card-width: var(--mobile-pair-width, 150px);
  }
  .hero-detail-tabs .pairs .hero-tab-text {
    background: linear-gradient(to right, var(--prismatic), var(--gold) 50%, var(--rune-pair-blue));
    background-clip: text;
    -webkit-background-clip: text;
    color: transparent;
  }
  .hero-detail-tabs {
    position: relative;
    display: grid;
    grid-template-columns: repeat(var(--tab-count), minmax(0, 1fr));
    border-bottom: 1px solid var(--border);
    margin: 8px 0 0;
    gap: 0;
  }
  .hero-detail-tabs button {
    min-width: 0;
    min-height: 44px;
    padding: 8px 2px;
    border: 0;
    border-bottom: 2px solid transparent;
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
  .hero-detail-tabs button[aria-selected='true'] {
    color: var(--accent-text);
  }
  .hero-detail-tabs .prismatic,
  .hero-detail-tabs .prismatic[aria-selected='true'] {
    color: var(--prismatic);
  }
  .hero-detail-tabs .gold,
  .hero-detail-tabs .gold[aria-selected='true'] {
    color: var(--gold);
  }
  .hero-detail-tabs .silver,
  .hero-detail-tabs .silver[aria-selected='true'] {
    color: var(--silver-rail);
  }
  .hero-detail-tabs .items[aria-selected='true'],
  .hero-detail-tabs .other[aria-selected='true'] {
    color: var(--muted);
  }
  .indicator-painted button[aria-selected='true'] {
    color: var(--muted);
  }
  .indicator-painted .hero-tab-text {
    position: relative;
    display: inline-block;
  }
  .hero-tab-highlight {
    position: absolute;
    inset: 0;
    color: var(--accent-text);
    clip-path: inset(0 100% 0 0);
    pointer-events: none;
  }
  .hero-tab-indicator {
    position: absolute;
    bottom: -1px;
    left: 0;
    width: var(--tab-width);
    height: 2px;
    background: var(--accent);
    transform: translateX(var(--tab-left));
    pointer-events: none;
  }
  .hero-detail-tabs button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -3px;
  }
  .detail-card-pagination {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) minmax(0, 1fr);
    align-items: center;
    gap: 6px;
    padding: 4px 0;
    margin: 0;
  }
  .detail-card-pagination.rune-pagination {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0;
  }
  .rune-pagination .detail-card-page-count {
    text-align: center;
    padding-right: 0;
  }
  .rune-pagination button:nth-child(2) {
    margin-right: 3px;
  }
  .rune-pagination button:nth-child(3) {
    margin-left: 3px;
  }
  .detail-card-pagination.hero-pagination {
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 0;
  }
  .hero-pagination .detail-card-page-count {
    grid-column: 1;
    text-align: center;
    padding-right: 0;
  }
  .hero-pagination button:nth-child(2) {
    grid-column: 2 / 4;
    margin-left: var(--pager-start-inset, 0px);
    margin-right: 3px;
  }
  .hero-pagination button:nth-child(3) {
    grid-column: 4 / 6;
    margin-left: 3px;
    margin-right: var(--pager-end-inset, 0px);
  }
  .detail-card-page-count {
    color: var(--muted);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    padding-right: 4px;
  }
  .detail-card-pagination button {
    min-height: 36px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--chip);
    color: var(--text);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }
  .detail-card-pagination button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .detail-card-pagination button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
  .mobile-tab-content :deep(.detail-page-hidden) {
    display: none !important;
  }
  .mobile-tab-content :deep(.detail-card-viewport.is-paginated .build-detail-cards) {
    display: grid;
    grid-template-columns: repeat(var(--mobile-columns), var(--detail-card-width));
    grid-template-rows: repeat(3, 1fr);
    grid-auto-flow: row;
    gap: 10px var(--mobile-card-gap);
    padding: 10px calc(2 * var(--mobile-card-gap));
    overflow: visible;
    max-height: none;
    height: auto;
    touch-action: pan-y;
  }
  .mobile-tab-content :deep(.build-detail-row:has(.is-paginated)) {
    display: block;
    padding-top: 0;
  }
  .mobile-tab-content
    :deep(.build-detail-row:has(.is-paginated) .build-detail-rail:not(.floating-detail-sort)) {
    display: none;
  }
  .mobile-tab-content :deep(.hero-rune-pairs .is-paginated .build-stat-card) {
    --rune-pair-width: var(--detail-card-width);
  }
  .mobile-tab-content :deep(.detail-card-viewport.is-paginated) {
    overflow: visible;
  }
  .mobile-tab-content :deep(.detail-card-viewport.is-paginated)::before,
  .mobile-tab-content :deep(.detail-card-viewport.is-paginated)::after {
    display: none;
  }
  .mobile-tab-content .hero-tab-track {
    display: flex;
    align-items: flex-start;
    width: 100%;
    overflow-x: hidden;
    overflow-y: hidden;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
    overscroll-behavior-x: contain;
  }
  .hero-tab-track::-webkit-scrollbar {
    display: none;
  }
  .mobile-tab-content .hero-tab-pane {
    display: block;
    flex: 0 0 100%;
    min-width: 0;
    overflow-y: visible;
    overflow-x: clip;
    scroll-snap-align: start;
    scroll-snap-stop: always;
    scrollbar-width: none;
  }
  .mobile-tab-content .hero-tab-pane.unpaged-tab-pane {
    max-height: none;
    overflow: visible;
  }
  .mobile-tab-content .hero-tab-pane[aria-hidden='true'] :deep(.mobile-tab-row .build-detail-rail) {
    display: none;
  }
  .mobile-tab-content {
    position: relative;
    display: block;
    min-width: 0;
    overflow-x: clip;
  }
  .mobile-tab-content :deep(.mobile-tab-row),
  .mobile-tab-content :deep(.mobile-tab-row.prismatic) {
    display: block;
    padding-top: 0;
    max-height: none;
    overflow: visible;
  }
  .mobile-tab-content :deep(.mobile-tab-row .build-detail-rail) {
    width: 100%;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: var(--muted);
    margin: 0 0 8px;
  }
  .mobile-tab-content :deep(.mobile-tab-row .build-detail-rail .stat-card-layout) {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  .mobile-tab-content :deep(.mobile-tab-row .build-detail-rail h3) {
    display: none;
  }
  .mobile-tab-content :deep(.mobile-tab-row .build-detail-sort) {
    min-height: 44px;
    padding: 0 8px;
    border: 0;
    background: transparent;
    color: var(--muted);
  }
  .mobile-tab-content :deep(.mobile-tab-row .build-detail-sort[aria-pressed='true']) {
    color: var(--accent-text);
  }
  .mobile-tab-content :deep(.mobile-tab-row .detail-card-viewport) {
    display: block;
    overflow: visible;
  }
  .mobile-tab-content :deep(.mobile-tab-row .build-detail-cards) {
    display: grid;
    grid-template-columns: repeat(var(--mobile-columns), var(--detail-card-width));
    grid-auto-flow: row;
    grid-auto-columns: auto;
    justify-items: center;
    justify-content: center;
    height: auto;
    max-height: 60vh;
    max-height: 60dvh;
    overflow-x: hidden;
    overflow-y: auto;
    scrollbar-width: none;
    overscroll-behavior-x: auto;
    touch-action: auto;
    padding: 10px calc(2 * var(--mobile-card-gap));
    gap: 10px var(--mobile-card-gap);
    box-sizing: border-box;
  }
  .mobile-tab-content :deep(.hero-rune-pairs) {
    display: block;
  }
  .mobile-tab-content :deep(.hero-rune-pairs .build-detail-row) {
    grid-template-columns: var(--detail-rail-width) minmax(0, 1fr);
    column-gap: var(--detail-card-gap);
    padding-top: 0;
  }
  .mobile-tab-content :deep(.build-detail-paired) {
    display: block;
    overflow: visible;
  }
  .mobile-tab-content :deep(.build-detail-paired > .spells) {
    width: 100%;
  }

  .mobile-tab-content .hero-tab-pane::-webkit-scrollbar,
  .mobile-tab-content :deep(.mobile-tab-row .build-detail-cards::-webkit-scrollbar) {
    display: none;
  }
  .mobile-tab-content :deep(.mobile-stat-grid) {
    display: block;
  }
  .mobile-tab-content :deep(.mobile-tab-row .build-stat-card) {
    width: var(--detail-card-width);
    min-width: var(--detail-card-width);
    max-width: var(--detail-card-width);
  }
}
</style>
