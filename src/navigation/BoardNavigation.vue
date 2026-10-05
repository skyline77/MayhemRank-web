<script setup lang="ts">
import { t } from '@/i18n/i18n'
import LanguagePicker from './LanguagePicker.vue'
import { locale, brands } from '@/i18n/locale'
import { onMounted, onUnmounted, ref } from 'vue'
import PatchPicker from './PatchPicker.vue'
import { navigationInset } from '@/app/navigationLayout'

const emit = defineEmits<{ navigate: [href: string] }>()
const wordmark = new URL('../assets/haidou-wordmark.webp', import.meta.url).href
const wordmarkInternational = new URL('../assets/mayhemrank-wordmark.png', import.meta.url).href
const wordmarkTraditional = new URL('../assets/haidou-tw-wordmark.png', import.meta.url).href
const nav = ref<HTMLElement | null>(null)
const links = ref<HTMLElement | null>(null)
const indicator = ref({ left: 0, width: 0 })
// Initial layout and restored pages must position the bar without replaying navigation.
const isMoving = ref(false)
let observer: ResizeObserver | undefined
let activeObserver: MutationObserver | undefined
let main: HTMLElement | null = null
let navigationTimer: ReturnType<typeof setTimeout> | undefined
let opacityFrame = 0
let background: HTMLElement | null = null,
  header: HTMLElement | null = null
let opacityTargetsDirty = true,
  lastOpacity = '',
  disposed = false,
  navHeight = 0
let contentObserver: MutationObserver | undefined
function invalidateOpacity() {
  opacityTargetsDirty = true
  scheduleOpacity()
}
function updateOpacity() {
  opacityFrame = 0
  const element = nav.value
  if (!element) return
  const mobile = window.innerWidth <= 700

  if (opacityTargetsDirty || background?.isConnected === false || header?.isConnected === false) {
    navHeight = navigationInset()
    background =
      main?.querySelector<HTMLElement>(mobile ? '.board-banner' : '.shared-board-art') || null
    header = main?.querySelector<HTMLElement>('.board-sticky-header,.combo-table thead') || null
    opacityTargetsDirty = false
  }
  // 页面顶部为80%；终点是表格冻结后再滚过一个表头高度。
  const origin = header?.closest<HTMLElement>('.board-table,.combo-table')
  const headerHeight = header?.getBoundingClientRect().height || 0
  const scrollTop = Math.max(0, window.scrollY)
  const naturalTop = header
    ? (origin || header).getBoundingClientRect().top + window.scrollY
    : (background?.getBoundingClientRect().bottom || navHeight) + window.scrollY
  const endScroll = Math.max(1, naturalTop - navHeight + headerHeight)
  const progress = Math.max(0, Math.min(1, scrollTop / endScroll))
  const opacity = (80 + 20 * progress).toFixed(2) + '%'
  if (opacity !== lastOpacity) {
    ;(main || element).style.setProperty('--nav-opacity', opacity)
    lastOpacity = opacity
  }
}
function scheduleOpacity() {
  if (!disposed && !opacityFrame) opacityFrame = requestAnimationFrame(updateOpacity)
}
function moveIndicator(link: HTMLElement) {
  const label = link.querySelector('span') || link
  const rect = label.getBoundingClientRect(),
    parent = links.value!.getBoundingClientRect()
  indicator.value = { left: rect.left - parent.left, width: rect.width }
}
function measure() {
  if (disposed) return
  navHeight = navigationInset()
  scheduleOpacity()
  if (nav.value) main?.style.setProperty('--site-nav-height', navHeight + 'px')
  const toolsHeight = nav.value?.querySelector('.product-nav-tools')?.getBoundingClientRect().height
  if (toolsHeight) main?.style.setProperty('--nav-tools-height', toolsHeight + 'px')
  const active = links.value?.querySelector<HTMLElement>('a[aria-current=page]')
  if (active && !navigationTimer) moveIndicator(active)
}
function navigate(event: MouseEvent) {
  const link = (event.target as Element).closest<HTMLAnchorElement>('a')
  if (
    !link ||
    !links.value?.contains(link) ||
    event.button !== 0 ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.altKey ||
    link.target ||
    link.hasAttribute('download') ||
    event.defaultPrevented
  )
    return
  if (link.origin !== location.origin || link.getAttribute('aria-current') === 'page') return
  event.preventDefault()
  clearTimeout(navigationTimer)
  isMoving.value = !matchMedia('(prefers-reduced-motion: reduce)').matches
  moveIndicator(link)
  emit('navigate', link.href)
  navigationTimer = setTimeout(() => {
    navigationTimer = undefined
    measure()
  }, 220)
}
function restoreIndicator() {
  clearTimeout(navigationTimer)
  navigationTimer = undefined
  isMoving.value = false
  measure()
}
onMounted(() => {
  window.addEventListener('pageshow', restoreIndicator)
  window.addEventListener('scroll', scheduleOpacity, { passive: true })
  window.addEventListener('resize', invalidateOpacity)
  main = nav.value?.closest('main') || null
  contentObserver = new MutationObserver(records => {
    const selector = '.board-banner,.shared-board-art,.board-sticky-header,.combo-table'
    if (
      records.some(record =>
        Array.from(record.addedNodes)
          .concat(Array.from(record.removedNodes))
          .some(
            node =>
              node instanceof HTMLElement &&
              (node.matches(selector) || node.querySelector(selector)),
          ),
      )
    )
      invalidateOpacity()
  })
  if (main) contentObserver.observe(main, { childList: true, subtree: true })
  observer = new ResizeObserver(measure)
  if (nav.value) {
    measure()
    observer.observe(nav.value)
  }
  if (links.value) {
    observer.observe(links.value)
    activeObserver = new MutationObserver(() => {
      isMoving.value = !matchMedia('(prefers-reduced-motion: reduce)').matches
      measure()
    })
    activeObserver.observe(links.value, {
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-current'],
    })
  }
  for (const element of Array.from(
    nav.value?.querySelectorAll(
      '.product-nav-destinations,.product-nav-secondary,.product-nav-tools',
    ) || [],
  ))
    observer.observe(element)
  void document.fonts.ready.then(measure)
})
onUnmounted(() => {
  disposed = true
  contentObserver?.disconnect()
  window.removeEventListener('scroll', scheduleOpacity)
  window.removeEventListener('resize', invalidateOpacity)
  cancelAnimationFrame(opacityFrame)
  window.removeEventListener('pageshow', restoreIndicator)
  clearTimeout(navigationTimer)
  observer?.disconnect()
  activeObserver?.disconnect()
  main?.style.removeProperty('--site-nav-height')
  main?.style.removeProperty('--nav-opacity')
  main?.style.removeProperty('--nav-tools-height')
})
</script>
<template>
  <nav ref="nav" class="product-nav" :aria-label="t('主要页面')">
    <div class="product-nav-primary">
      <div class="product-nav-destinations">
        <a class="product-nav-brand" href="/" :aria-label="brands[locale]">
          <img
            :src="
              locale === 'zh-CN'
                ? wordmark
                : locale === 'zh-TW'
                  ? wordmarkTraditional
                  : wordmarkInternational
            "
            :alt="brands[locale]"
            decoding="sync"
            fetchpriority="high"
            loading="eager"
          />
        </a>
        <div ref="links" class="product-nav-links" @click="navigate">
          <slot /><span
            class="product-nav-indicator"
            :class="{ 'is-moving': isMoving }"
            aria-hidden="true"
            :style="{
              width: indicator.width + 'px',
              transform: `translateX(${indicator.left}px)`,
              visibility: indicator.width ? 'visible' : 'hidden',
            }"
          ></span>
        </div>
      </div>
      <div class="product-nav-tools">
        <div class="product-nav-selectors"><LanguagePicker /><PatchPicker hide-label /></div>
        <div id="board-nav-search" class="product-nav-search"></div>
      </div>
    </div>
    <div id="board-nav-secondary" class="product-nav-secondary"></div>
  </nav>
</template>
<style scoped>
.product-nav-selectors {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  width: max-content;
}
.product-nav-selectors :deep(.language-picker-wrap),
.product-nav-selectors :deep(.patch-picker) {
  width: 100%;
}
.product-nav .product-nav-selectors :deep(select) {
  width: 100%;
  min-width: 0;
}
.product-nav-destinations {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.product-nav-brand {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 120px;
  min-height: 48px;
  border-radius: 4px;
}
.product-nav-brand img {
  display: block;
  width: 100%;
  height: auto;
  max-height: 56px;
  object-fit: contain;
}
.product-nav-brand:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
/* Keep the full destination name on one line without widening narrow screens. */
.product-nav {
  --primary-tab-width: 112px;
  padding-top: var(--safe-area-top, 0px);
}
.product-nav-links :deep(a) {
  white-space: nowrap;
}
@media (min-width: 701px) {
  .product-nav-primary {
    padding-block: 0;
    min-height: 58px;
    align-items: stretch;
  }
  .product-nav-destinations {
    align-self: stretch;
    align-items: stretch;
  }
  .product-nav-links {
    align-self: stretch;
  }
  .product-nav-tools {
    align-self: center;
  }
}
@media (max-width: 700px) {
  .product-nav-selectors {
    grid-template-columns: 1fr;
  }
  /* Only the destination row stays pinned on phones. */
  .product-nav {
    display: contents;
    background: transparent;
    border-bottom-color: transparent;
  }
  .product-nav-destinations {
    position: sticky;
    top: 0;
    z-index: 10;
    padding-top: var(--safe-area-top, 0px);
  }
  .product-nav-secondary {
    position: sticky;
    top: calc(56px + var(--safe-area-top, 0px));
    z-index: 10;
  }
  .product-nav-tools {
    position: relative;
    z-index: 9;
  }
  .product-nav-destinations,
  .product-nav-secondary {
    background: color-mix(in srgb, var(--bg) var(--nav-opacity, 80%), transparent);
  }
  .product-nav-tools {
    min-height: 68px;
    padding: 20px 0 8px 8px;
    box-sizing: border-box;
    justify-content: flex-end;
  }
  .product-nav-tools :deep(.search),
  .product-nav-tools :deep(.patch-picker select),
  .product-nav-tools :deep(.language-picker) {
    background: color-mix(in srgb, var(--surface) 80%, transparent);
  }

  .product-nav-destinations {
    order: 0;
    gap: 6px;
  }
  .product-nav-destinations,
  .product-nav-secondary {
    box-sizing: border-box;
    width: calc(100% + 32px + env(safe-area-inset-left, 0px) + env(safe-area-inset-right, 0px));
    margin-left: calc(-16px - env(safe-area-inset-left, 0px));
    margin-right: calc(-16px - env(safe-area-inset-right, 0px));
    padding-left: calc(16px + env(safe-area-inset-left, 0px));
    padding-right: calc(16px + env(safe-area-inset-right, 0px));
  }
  .product-nav-brand {
    width: 72px;
  }
  .product-nav-tools {
    flex-wrap: wrap;
  }
  .product-nav-tools .product-nav-search {
    flex: 1;
    min-width: 120px;
  }
  .product-nav-links {
    flex: 1;
    min-width: 0;
  }
  .product-nav-links :deep(a) {
    width: auto;
    flex: 1;
    min-width: 0;
    padding-inline: 4px;
    font-size: 12px;
  }
}
@media (max-width: 380px) {
  .product-nav-destinations {
    gap: 4px;
  }
  .product-nav-brand {
    width: 72px;
  }
  .product-nav-links :deep(a) {
    padding-inline: 2px;
  }
}
</style>
