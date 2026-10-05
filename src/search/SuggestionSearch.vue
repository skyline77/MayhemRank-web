<script setup lang="ts" generic="T extends { id: string; name: string; icon: string }">
import { t } from '@/i18n/i18n'
import { computed, nextTick, onMounted, onUnmounted, ref, useId, watch } from 'vue'
import SearchBox from './SearchBox.vue'
import DetailLink from '@/details/DetailLink.vue'

import { moveSuggestion } from './searchSuggestions'
import { normalizeSearch } from './search'

const props = defineProps<{
  results: readonly T[]
  recentResults?: readonly T[]
  loading: boolean
  scope: 'hero' | 'rune'
  label: string
  placeholder: string
  hint?: string
  hintIcon?: string
  loadingText: string
  emptyText: string
  listLabel: string
  visibleLimit?: number
  href: (entry: T) => string
  subtitle: (entry: T) => string
  title?: (entry: T) => string
}>()
const query = defineModel<string>({ required: true })
const emit = defineEmits<{ select: [entry: T] }>()
const root = ref<HTMLElement | null>(null),
  focused = ref(false),
  dismissed = ref(false),
  active = ref(0)
const list = ref<HTMLElement | null>(null),
  hasMore = ref(false),
  hasOverflow = ref(false)
function measureMore() {
  const element = list.value
  hasOverflow.value =
    !!props.visibleLimit && !!element && element.scrollHeight - element.clientHeight > 1
  hasMore.value =
    hasOverflow.value &&
    !!element &&
    element.scrollHeight - element.clientHeight - element.scrollTop > 1
}
watch(list, (element, _previous, onCleanup) => {
  if (!element || !props.visibleLimit) return
  const observer = new ResizeObserver(measureMore)
  observer.observe(element)
  onCleanup(() => observer.disconnect())
  measureMore()
})
const listId = props.scope + '-suggestions-' + useId()
const historyMode = computed(
  () => !normalizeSearch(query.value) && props.recentResults !== undefined,
)
const results = computed(() => (historyMode.value ? props.recentResults! : props.results))
const opened = computed(
  () => focused.value && !dismissed.value && (!!normalizeSearch(query.value) || historyMode.value),
)
const activeId = computed(() =>
  opened.value && !props.loading && results.value[active.value]
    ? listId + '-' + active.value
    : undefined,
)
watch([query, results], () => {
  active.value = 0
  dismissed.value = false
})
watch(
  [opened, results, active, () => props.loading],
  async () => {
    await nextTick()
    const element = list.value,
      option = element?.children[active.value] as HTMLElement | undefined
    if (props.visibleLimit && element && option) {
      const viewport = element.getBoundingClientRect(),
        bounds = option.getBoundingClientRect()
      if (bounds.top < viewport.top) element.scrollTop -= viewport.top - bounds.top
      else if (bounds.bottom > viewport.top + element.clientHeight)
        element.scrollTop += bounds.bottom - viewport.top - element.clientHeight
    }
    measureMore()
  },
  { flush: 'post' },
)
function select(entry: T) {
  dismissed.value = true
  root.value?.querySelector<HTMLInputElement>('input')?.blur()
  emit('select', entry)
}
function submit() {
  if (opened.value && !props.loading && results.value[active.value])
    select(results.value[active.value]!)
}
function keydown(event: KeyboardEvent) {
  if (
    !opened.value ||
    props.loading ||
    !results.value.length ||
    event.isComposing ||
    event.keyCode === 229 ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.shiftKey
  )
    return
  if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return
  event.preventDefault()
  event.stopPropagation()
  active.value = moveSuggestion(active.value, event.key, results.value.length)
}
function focusin() {
  focused.value = true
  dismissed.value = false
}
function focusout(event: FocusEvent) {
  if (!root.value?.contains(event.relatedTarget as Node | null)) focused.value = false
}
function outside(event: PointerEvent) {
  if (!root.value?.contains(event.target as Node)) focused.value = false
}
onMounted(() => document.addEventListener('pointerdown', outside))
onUnmounted(() => document.removeEventListener('pointerdown', outside))
</script>
<template>
  <div ref="root" class="suggestion-search" :class="scope + '-search'" @focusout="focusout">
    <SearchBox
      v-model="query"
      class="board-search"
      :scope="scope"
      :label="label"
      :placeholder="placeholder"
      :hint="hint"
      :hint-icon="hintIcon"
      :input-attrs="{
        role: 'combobox',
        'aria-autocomplete': 'list',
        'aria-expanded': opened,
        'aria-controls': opened ? listId : undefined,
        'aria-activedescendant': activeId,
      }"
      @focus="focusin"
      @keydown="keydown"
      @submit="submit"
    />
    <div
      v-if="opened"
      class="search-suggestions"
      :class="[scope + '-suggestions', { 'is-limited': visibleLimit }]"
      :style="visibleLimit ? { '--suggestion-visible-count': visibleLimit } : undefined"
    >
      <p v-if="loading" role="status">{{ loadingText }}</p>
      <p v-else-if="historyMode" :class="{ 'history-search-label': results.length }" role="status">
        <template v-if="results.length"
          ><span class="history-label-desktop">{{ t('历史搜索（按↓选择）') }}</span
          ><span class="history-label-mobile">{{ t('历史搜索') }}</span></template
        ><template v-else>{{ t('无搜索记录') }}</template>
      </p>
      <p v-else-if="!results.length" role="status">{{ emptyText }}</p>
      <div
        ref="list"
        :id="listId"
        class="suggestion-list"
        role="listbox"
        @scroll.passive="measureMore"
        :aria-label="historyMode ? t('历史搜索') : listLabel"
        :aria-busy="loading"
      >
        <DetailLink
          v-for="(entry, index) in loading ? [] : results"
          :id="listId + '-' + index"
          :key="entry.id"
          class="search-suggestion"
          :class="{ 'is-active': index === active }"
          role="option"
          :aria-selected="index === active"
          tabindex="-1"
          :href="href(entry)"
          @pointerdown.prevent
          @activate="select(entry)"
        >
          <slot name="icon" :entry="entry"
            ><img :src="entry.icon" alt="" width="40" height="40" draggable="false"
          /></slot>
          <span
            ><strong>{{ title ? title(entry) : entry.name }}</strong
            ><small>{{ subtitle(entry) }}</small></span
          >
        </DetailLink>
      </div>
      <div
        v-if="hasOverflow && !loading"
        class="suggestion-more"
        :class="{ 'is-hidden': !hasMore }"
        :aria-hidden="!hasMore"
        role="img"
        :aria-label="t('下方还有更多候选')"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="m6 5 6 6 6-6M4 11l8 8 8-8" />
        </svg>
      </div>
    </div>
  </div>
</template>
<style scoped>
.history-label-mobile {
  display: none;
}
@media (max-width: 700px) {
  .history-label-desktop {
    display: none;
  }
  .history-label-mobile {
    display: inline;
  }
}
.suggestion-search {
  position: relative;
  flex: 1;
  min-width: 0;
}
.suggestion-search :deep(.search) {
  width: 100%;
}
.search-suggestions {
  position: absolute;
  top: calc(100% + 4px);
  inset-inline: 0;
  z-index: 20;
  padding: 4px;
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  background: var(--card);
  box-shadow: var(--shadow);
  max-height: min(340px, 60dvh);
  overflow-y: auto;
}
.search-suggestions.is-limited {
  max-height: none;
  overflow: hidden;
}
.is-limited .suggestion-list {
  max-height: min(calc(var(--suggestion-visible-count) * 52px), calc(60dvh - 10px));
  overflow-y: auto;
  overscroll-behavior: contain;
}
.is-limited .search-suggestion {
  box-sizing: border-box;
  height: 52px;
}
.is-limited .search-suggestion strong,
.is-limited .search-suggestion small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.suggestion-more.is-hidden {
  visibility: hidden;
}
.suggestion-more {
  position: absolute;
  inset: auto 4px 4px;
  z-index: 1;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  height: 32px;
  padding-bottom: 2px;
  box-sizing: border-box;
  color: var(--text);
  box-shadow: rgba(0, 0, 0, 0.5) 0 -22px 20px -14px inset;
  pointer-events: none;
}
.search-suggestions p {
  margin: 0;
  padding: 12px;
  color: var(--muted);
}
.search-suggestions .history-search-label {
  padding: 4px 12px;
  font-size: 12px;
  text-align: center;
}
.search-suggestion {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: 5px;
}
.search-suggestion.is-active,
.search-suggestion:hover {
  background: var(--chip);
  outline: 1px solid var(--border-strong);
  outline-offset: -1px;
}
.search-suggestion :deep(img) {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 5px;
}
.search-suggestion span {
  display: grid;
  min-width: 0;
}
.search-suggestion strong {
  font-size: 13px;
  color: var(--text);
}
.search-suggestion small {
  font-size: 11px;
  color: var(--muted);
}
</style>
