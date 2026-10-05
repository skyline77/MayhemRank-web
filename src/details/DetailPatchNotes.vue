<script setup lang="ts">
import { t, message } from '@/i18n/i18n'
import StatText from '@/stats/StatText.vue'
import { computed, ref, watch } from 'vue'
import { locale } from '@/i18n/locale'
import {
  coveredPatchLabel,
  loadPatchNotes,
  recentPatches,
  type PatchCatalogue,
  type PatchKind,
} from '@/data/patchNotes'
const props = defineProps<{
  kind: PatchKind
  entityId: string | number
  patch: string
  id: string
  hideHeading?: boolean
  headingId?: string
  hideSourceNote?: boolean
}>()
const data = ref<PatchCatalogue | null>(null),
  error = ref(''),
  loading = ref(true)
const patches = computed(() =>
  data.value ? recentPatches(data.value, props.kind, props.entityId, props.patch) : [],
)
const coverage = computed(() => (data.value ? coveredPatchLabel(data.value, props.patch) : ''))
const sourceUrl = (patch: string) => data.value?.sources.find(source => source.patch === patch)?.url
let requestId = 0
async function load() {
  const request = ++requestId
  loading.value = true
  error.value = ''
  try {
    const result = await loadPatchNotes()
    if (request === requestId) data.value = result
  } catch (e) {
    if (request === requestId) error.value = e instanceof Error ? e.message : '暂时无法读取近期改动'
  } finally {
    if (request === requestId) loading.value = false
  }
}
watch(locale, load, { immediate: true })
</script>

<template>
  <section
    :id="id"
    class="champion-patch-notes"
    tabindex="0"
    :aria-labelledby="headingId || id + '-title'"
    :aria-busy="loading"
  >
    <div v-if="!hideHeading" class="champion-patch-heading">
      <h3 :id="id + '-title'">{{ t('近期改动') }}</h3>
      <small v-if="coverage">{{ t('已收录') }}{{ coverage }}</small>
    </div>
    <p v-else-if="coverage" class="champion-patch-coverage">{{ t('版本范围') }}{{ coverage }}</p>
    <p v-if="loading" class="champion-patch-status" role="status">{{ t('正在读取近期改动……') }}</p>
    <p v-else-if="error" class="champion-patch-status" role="alert">
      {{ t(error) }} <button class="board-retry" @click="load">{{ t('重试') }}</button>
    </p>
    <template v-else>
      <div v-for="version in patches" :key="version.patch" class="champion-patch-version">
        <div class="champion-patch-version-heading">
          <h4>{{ version.patch }}</h4>
          <a
            v-if="sourceUrl(version.patch)"
            :href="sourceUrl(version.patch)"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="message('{p0} 官方更新公告（新窗口）', { p0: version.patch })"
            >{{ t('官方公告 ↗') }}</a
          >
        </div>
        <ul>
          <li v-for="(change, index) in version.changes" :key="index">
            <div
              v-if="change.ability || (kind === 'champion' && change.scope === 'mayhem')"
              class="patch-change-label"
            >
              <strong v-if="change.ability">{{ change.ability }}</strong
              ><span
                v-if="kind === 'champion' && change.scope === 'mayhem'"
                class="champion-patch-mayhem"
                >{{ t('海斗') }}</span
              >
            </div>
            <p class="patch-change-text"><StatText :text="change.text" /></p>
          </li>
        </ul>
      </div>
      <p v-if="!patches.length" class="champion-patch-status" role="status">
        {{
          coverage
            ? message('已收录的 {p0} 版本中，该{p1}暂无改动。', {
                p0: coverage,
                p1: kind === 'rune' ? t('符文') : t('英雄'),
              })
            : t('尚未收录该版本及此前的改动。')
        }}
      </p>
      <slot v-if="!hideSourceNote" name="source-note"
        ><p v-if="locale === 'en-US'" class="champion-patch-source-note">
          Source: Riot official patch notes · Original English.
        </p>
        <p v-else-if="locale === 'zh-TW'" class="champion-patch-source-note">
          來源：Riot 官方更新公告 · 繁體中文原文。
        </p>
        <p v-else class="champion-patch-source-note">
          {{ t('来源：Riot 官方更新公告 · 繁中转简体，')
          }}{{ kind === 'rune' ? t('符文名') : t('技能名') }}{{ t('对照简中资料。') }}
        </p></slot
      >
    </template>
  </section>
</template>
<style scoped>
.champion-patch-notes {
  min-width: 0;
  max-height: 440px;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: var(--border-strong) transparent;
  padding-right: 8px;
}
.champion-patch-notes:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
.champion-patch-heading {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 8px;
}
.champion-patch-heading h3 {
  font-size: 14px;
  margin: 0;
}
.champion-patch-heading small,
.champion-patch-coverage,
.champion-patch-source-note {
  font-size: 11px;
  line-height: 1.6;
  color: var(--muted);
}
.champion-patch-coverage {
  margin: 0 0 8px;
  font-variant-numeric: tabular-nums;
}
.champion-patch-version {
  display: grid;
  grid-template-columns: 100px minmax(0, 1fr);
  gap: 20px;
  padding: 16px 0;
}
.champion-patch-version + .champion-patch-version {
  border-top: 1px solid var(--border);
}
.champion-patch-version-heading {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}
.champion-patch-version-heading h4 {
  margin: 0;
  font-size: 16px;
  line-height: 1.4;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  color: var(--text);
}
.champion-patch-version-heading a {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  color: var(--muted);
  font-size: 12px;
  text-decoration: none;
}
.champion-patch-version-heading a:hover {
  color: var(--accent-text);
  text-decoration: underline;
  text-underline-offset: 3px;
}
.champion-patch-version-heading a:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
.champion-patch-version ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 14px;
  min-width: 0;
}
.champion-patch-version li {
  font-size: 13px;
  line-height: 1.8;
  overflow-wrap: anywhere;
  min-width: 0;
}
.patch-change-label {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 3px;
}
.patch-change-label strong {
  font-weight: 600;
  color: var(--text);
  font-size: 12px;
}
.patch-change-text {
  margin: 0;
  white-space: pre-line;
  font-variant-numeric: tabular-nums;
}
.champion-patch-mayhem {
  padding: 0 5px;
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.6;
  white-space: nowrap;
}
.champion-patch-status {
  color: var(--muted);
  font-size: 12px;
  margin: 8px 0;
}
.champion-patch-source-note {
  margin: 8px 0 0;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}
@media (max-width: 700px) {
  .champion-patch-notes {
    max-height: none;
    overflow: visible;
    padding-right: 0;
  }
  .champion-patch-version {
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
    padding: 14px 0;
  }
  .champion-patch-version-heading {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
  .champion-patch-version-heading a {
    min-height: 32px;
  }
  .champion-patch-version ul {
    gap: 12px;
  }
}
</style>
