<script setup lang="ts">
import { t } from './i18n'
import { computed } from 'vue'
import { recentViews } from './recentViews'
import SuggestionSearch from './SuggestionSearch.vue'
import { runeDetailUrl } from './detailLink'
import { runeSuggestions } from './runeSuggestions'
import { augmentIcon, needsGoldTint } from './augmentIcons'
import type { RuneEntry } from './augmentBoard'
import type { DetailSearchIndex } from './detailSearch'
const props = defineProps<{
  entries: readonly RuneEntry[]
  patch: string
  loading: boolean
  index: DetailSearchIndex | null
}>()
const query = defineModel<string>({ required: true })
const emit = defineEmits<{ select: [entry: RuneEntry] }>()
const recentResults = computed(() =>
  recentViews.rune.value.flatMap(id => {
    const entry = props.entries.find(entry => entry.id === id)
    return entry ? [entry] : []
  }),
)
const results = computed(() => runeSuggestions(props.entries, query.value, props.index))
</script>
<template>
  <SuggestionSearch
    v-model="query"
    :results="results"
    :recent-results="recentResults"
    :loading="loading"
    scope="rune"
    :visible-limit="5"
    :label="t('搜索符文')"
    placeholder=""
    hint="JRSS"
    :hint-icon="augmentIcon(1195, patch, '/build-assets/augment-1195.png')"
    :loading-text="t('正在加载符文……')"
    :empty-text="t('未找到达到样本门槛的符文')"
    :list-label="t('匹配的符文')"
    :href="(entry: RuneEntry) => runeDetailUrl(entry.id, patch)"
    :subtitle="
      (entry: RuneEntry) => entry.column + ' · 胜率 ' + (entry.winRate * 100).toFixed(1) + '%'
    "
    @select="emit('select', $event)"
  >
    <template #icon="{ entry }"
      ><img
        class="augment-artwork"
        :class="{ 'augment-gold-fallback': needsGoldTint(entry.id, patch, entry.rarity) }"
        :src="augmentIcon(entry.id, patch, entry.icon)"
        alt=""
        width="40"
        height="40"
        draggable="false"
    /></template>
  </SuggestionSearch>
</template>

<style scoped>
:deep(.search-hint img) {
  width: 28px;
  height: 28px;
  flex-basis: 28px;
}
</style>
