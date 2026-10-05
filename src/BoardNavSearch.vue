<script setup lang="ts">
import { t, message } from './i18n'
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
const props = withDefaults(defineProps<{ query?: string }>(), { query: '' })
// Reuse each board's search state, suggestions and handlers in the mobile dock.
const mounted = ref(false),
  expanded = ref(false),
  mobile = ref(matchMedia('(max-width:700px)').matches)
const root = ref<HTMLElement | null>(null),
  keyboardInset = ref(0),
  suggestionsReady = ref(false)
const media = matchMedia('(max-width:700px)')
function resize() {
  mobile.value = media.matches
  if (!mobile.value) expanded.value = false
  else if (props.query.length) {
    expanded.value = true
    suggestionsReady.value = true
  }
  viewportChanged()
}
function viewportChanged() {
  const viewport = window.visualViewport
  keyboardInset.value = viewport
    ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
    : 0
}
watch(
  () => props.query,
  value => {
    if (value.length && mobile.value) {
      expanded.value = true
      suggestionsReady.value = true
    }
  },
  { immediate: true },
)
function close() {
  const keepOpen = !!props.query.length
  suggestionsReady.value = keepOpen
  expanded.value = keepOpen
  root.value?.querySelector<HTMLInputElement>('input')?.blur()
}
async function toggle() {
  if (expanded.value) {
    if (props.query.length) {
      suggestionsReady.value = true
      root.value?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true })
    } else close()
    return
  }
  suggestionsReady.value = matchMedia('(prefers-reduced-motion:reduce)').matches
  expanded.value = true
  await nextTick()
  root.value?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true })
}
function finishExpansion(event: TransitionEvent) {
  if (event.target === root.value && event.propertyName === 'width' && expanded.value)
    suggestionsReady.value = true
}
function outside(event: PointerEvent) {
  if (mobile.value && !root.value?.contains(event.target as Node)) close()
}
function escape(event: KeyboardEvent) {
  if (
    mobile.value &&
    event.key === 'Escape' &&
    !root.value?.querySelector<HTMLInputElement>('input')?.value
  )
    close()
}
onMounted(() => {
  mounted.value = true
  media.addEventListener('change', resize)
  document.addEventListener('pointerdown', outside)
  window.visualViewport?.addEventListener('resize', viewportChanged)
  window.visualViewport?.addEventListener('scroll', viewportChanged)
})
onUnmounted(() => {
  media.removeEventListener('change', resize)
  document.removeEventListener('pointerdown', outside)
  window.visualViewport?.removeEventListener('resize', viewportChanged)
  window.visualViewport?.removeEventListener('scroll', viewportChanged)
})
</script>
<template>
  <Teleport v-if="mounted" :to="mobile ? 'body' : '#board-nav-search'">
    <div
      ref="root"
      class="board-search-dock"
      :class="{
        'is-mobile': mobile,
        'is-expanded': expanded,
        'suggestions-ready': suggestionsReady,
      }"
      :style="mobile ? { '--search-keyboard-inset': keyboardInset + 'px' } : undefined"
      @keydown="escape"
      @transitionend="finishExpansion"
    >
      <button
        v-if="mobile"
        class="mobile-search-toggle"
        type="button"
        :aria-expanded="expanded"
        :aria-label="
          expanded && query.length ? t('搜索') : expanded ? t('收起搜索') : t('展开搜索')
        "
        @click="toggle"
      >
        <svg
          aria-hidden="true"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
        >
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m16 16 5 5" />
        </svg>
      </button>
      <div
        class="board-search-content"
        :inert="mobile && !expanded"
        :aria-hidden="mobile && !expanded ? true : undefined"
      >
        <slot />
      </div>
    </div>
  </Teleport>
</template>
<style scoped>
.board-search-dock,
.board-search-content {
  display: flex;
  flex: 1;
  min-width: 0;
  width: 100%;
}
.board-search-content > :deep(*) {
  flex: 1;
  min-width: 0;
  width: 100%;
}
.is-mobile.board-search-dock {
  display: block;
  position: fixed;
  z-index: 40;
  right: 12px;
  bottom: calc(max(12px, env(safe-area-inset-bottom)) + var(--search-keyboard-inset, 0px));
  width: 48px;
  height: 48px;
  border: 1px solid var(--border-strong);
  border-radius: 24px;
  background: var(--surface);
  box-shadow: var(--shadow);
  transition: width 240ms cubic-bezier(0.2, 0, 0, 1);
}
.is-mobile.is-expanded {
  width: min(430px, calc(100vw - 24px));
}
.mobile-search-toggle {
  position: absolute;
  inset: 0 auto 0 0;
  z-index: 2;
  width: 46px;
  height: 46px;
  border: 0;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
}
.mobile-search-toggle:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.is-mobile .board-search-content {
  display: block;
  width: 100%;
  height: 100%;
  visibility: hidden;
  opacity: 0;
  transition: opacity 160ms ease;
}
.is-mobile.is-expanded .board-search-content {
  visibility: visible;
  opacity: 1;
}
.is-mobile :deep(.search-with-version),
.is-mobile :deep(.suggestion-search) {
  width: 100%;
  height: 100%;
  min-width: 0;
}
.is-mobile :deep(.search) {
  box-sizing: border-box;
  display: flex;
  width: 100%;
  height: 46px;
  min-width: 0;
  margin: 0;
  padding: 0 12px 0 46px;
  border: 0;
  border-radius: 24px;
  background: transparent;
  overflow: hidden;
}
.is-mobile :deep(.search-icon) {
  display: none;
}
.is-mobile :deep(.search input) {
  font-size: 16px;
  min-width: 0;
}
.is-mobile :deep(.search-suggestions) {
  top: auto;
  bottom: calc(100% + 8px);
  max-height: min(340px, 45dvh);
}
.is-mobile:not(.suggestions-ready) :deep(.search-suggestions) {
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
}
.is-mobile.suggestions-ready :deep(.search-suggestions) {
  animation: mobile-suggestions-reveal 160ms ease-out both;
}
@keyframes mobile-suggestions-reveal {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .is-mobile.suggestions-ready :deep(.search-suggestions) {
    animation: none;
  }
}
.is-mobile :deep(.suggestion-list) {
  max-height: min(270px, 35dvh);
}
@media (prefers-reduced-motion: reduce) {
  .is-mobile.board-search-dock,
  .is-mobile .board-search-content {
    transition: none;
  }
}
</style>
