<script setup lang="ts">
import { locale } from './locale'
import { t, message } from './i18n'
import { gameName, gameTitle, roleName } from './gameLocalization'
import { formatCount } from './formatCount'

import BoardBanner from './BoardBanner.vue'
import BoardPagination from './BoardPagination.vue'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import SearchBox from './SearchBox.vue'
import BoardNavSearch from './BoardNavSearch.vue'
import WinRateDelta from './WinRateDelta.vue'
import ComboMetric from './ComboMetric.vue'
import { augmentIcon } from './augmentIcons'
import {
  selectedPatch,
  selectedVersion,
  snapshotGeneration,
  loadVersions,
  updateDate,
} from './versions'
import { buildDetailUrl, runeDetailUrl } from './detailLink'
import { loadComboBoard, cachedComboBoard, type ComboBoard } from './comboBoard'
import { orderComboRunes, type ComboSort, type ComboEntry } from './comboRanking'

const props = withDefaults(defineProps<{ runeCount?: 1 | 2 }>(), { runeCount: 1 })

const dual = computed(() => props.runeCount === 2)
const title = computed(() => (dual.value ? '英雄＋符文＋符文' : '英雄＋符文'))
const sectionId = computed(() => (dual.value ? 'double-combos' : 'single-combos'))
const methodId = computed(() => sectionId.value + '-method')
const data = ref<ComboBoard | null>(null),
  loading = ref(true),
  error = ref('')
const query = ref(''),
  sort = ref<ComboSort>('winRate')
const page = ref(1)
const list = ref<HTMLElement | null>(null)
const pageSize = 10
const mobileQuery = window.matchMedia('(max-width:800px)')
const mobile = ref(mobileQuery.matches),
  mobileLimit = ref(20)
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | undefined
function updateViewport() {
  mobile.value = mobileQuery.matches
  page.value = 1
  mobileLimit.value = 20
}
onMounted(() => {
  mobileQuery.addEventListener('change', updateViewport)
})
watch(
  sentinel,
  element => {
    observer?.disconnect()
    if (!element) return
    observer = new IntersectionObserver(
      entries => {
        if (
          entries.some(entry => entry.isIntersecting) &&
          mobile.value &&
          !loading.value &&
          !error.value
        ) {
          mobileLimit.value = Math.min(rows.value.length, mobileLimit.value + 20)
        }
      },
      { rootMargin: '0px 0px 120px 0px' },
    )
    observer.observe(element)
  },
  { flush: 'post' },
)
let serial = 0
let searchTimer: ReturnType<typeof setTimeout> | undefined
let prefetchTimer: ReturnType<typeof setTimeout> | undefined
async function load() {
  clearTimeout(searchTimer)
  const current = ++serial
  clearTimeout(prefetchTimer)
  const patch = selectedPatch.value,
    count = props.runeCount,
    metric = sort.value,
    search = query.value.trim()
  const cached = cachedComboBoard(snapshotGeneration.value, patch, count, metric, search)
  loading.value = !cached
  error.value = ''
  data.value = cached || null
  try {
    const value = cached || (await loadComboBoard(patch, count, metric, search))
    if (current === serial) {
      data.value = value
      if (count === 1 && !search)
        prefetchTimer = setTimeout(() => {
          void loadComboBoard(patch, 2, metric, '').catch(() => {
            /* Foreground loads retain retry handling. */
          })
        }, 300)
    }
  } catch {
    if (current === serial) error.value = '组合统计暂时无法读取，请重试。'
  } finally {
    if (current === serial) loading.value = false
  }
}
void loadVersions()
  .then(() => {
    if (serial === 0) void load()
  })
  .catch(() => {
    error.value = '版本目录暂时无法读取，请重试。'
    loading.value = false
  })
watch([selectedVersion, sort, () => props.runeCount], () => {
  void load()
})
watch(locale, () => {
  if (query.value.trim()) void load()
})
watch(query, () => {
  serial++
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    void load()
  }, 500)
})
const rows = computed(() => data.value?.entries || [])
const pageCount = computed(() => Math.max(1, Math.ceil(rows.value.length / pageSize)))
const pageStart = computed(() => (page.value - 1) * pageSize)
const visibleStart = computed(() => (mobile.value ? 0 : pageStart.value))
const slots = computed(() =>
  rows.value
    .slice(visibleStart.value, mobile.value ? mobileLimit.value : pageStart.value + pageSize)
    .map((row, index) => ({
      row: dual.value
        ? orderComboRunes(row, {
            [row.runeId]: row.runeRarity || '',
            [row.secondRuneId || '']: row.secondRuneRarity || '',
          })
        : row,
      index: visibleStart.value + index,
    })),
)
watch(rows, () => {
  page.value = 1
  mobileLimit.value = 20
})
async function turnPageFromBottom(direction: number) {
  const target = Math.max(1, Math.min(pageCount.value, page.value + direction))
  if (loading.value || error.value || target === page.value) return
  page.value = target
  await nextTick()
  list.value?.focus({ preventScroll: true })
  list.value?.scrollIntoView({
    block: 'start',
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
  })
}

onUnmounted(() => {
  serial++
  clearTimeout(prefetchTimer)
  clearTimeout(searchTimer)
  observer?.disconnect()
  mobileQuery.removeEventListener('change', updateViewport)
})
const percent = (value: number) => (value * 100).toFixed(1) + '%'
const sampleText = (row: ComboEntry) =>
  message('{games} 场 · 英雄平均 {rate}', {
    games: formatCount(row.games),
    rate: percent(row.baseline),
  })
</script>
<template>
  <section
    :id="sectionId"
    class="build-board combo-board"
    :class="{ 'double-combos': dual }"
    :aria-label="message('{p0}榜', { p0: title })"
  >
    <BoardNavSearch :query="query"
      ><SearchBox
        v-model="query"
        :label="dual ? t('搜索英雄与双符文组合') : t('搜索英雄或符文组合')"
        :placeholder="mobile ? '' : dual ? t('英雄 / 符文＋符文') : t('搜索英雄 / 符文')"
        scope="hero"
        hint="zzzy mscq"
        :hint-icons="[
          '/role-portraits/120.png',
          augmentIcon(1058, selectedPatch, '/build-assets/augment-1058.png'),
        ]"
    /></BoardNavSearch>
    <BoardBanner>
      <div class="board-banner-controls">
        <slot name="filters" />
        <BoardPagination
          v-if="!mobile"
          :page="page"
          :page-count="pageCount"
          :disabled="loading || !!error"
          :controls="sectionId + '-list'"
          :label="message('{p0}榜翻页', { p0: title })"
          announce
          @change="page = $event"
        />
      </div>
    </BoardBanner>
    <div ref="list" :id="sectionId + '-list'" class="combo-list" tabindex="-1">
      <div v-if="loading" class="board-message" role="status" :aria-label="t('正在读取组合统计')">
        <span class="combo-spinner" aria-hidden="true"></span>
      </div>
      <p v-else-if="error" class="board-message" role="alert">
        {{ t(error) }} <button class="board-retry" @click="load">{{ t('重试') }}</button>
      </p>
      <table
        v-else-if="data"
        class="combo-table"
        :aria-label="message('{p0}胜率榜', { p0: title })"
        :aria-rowcount="rows.length + 1"
        :aria-describedby="methodId"
      >
        <thead>
          <tr>
            <th scope="col">
              <span class="combo-column-label">{{ t('组合') }}</span>
            </th>
            <th scope="col" :aria-sort="sort === 'winRate' ? 'descending' : 'none'">
              <button @click="sort = 'winRate'">
                {{ t('胜率') }}<span aria-hidden="true">{{ sort === 'winRate' ? '↓' : '' }}</span>
              </button>
            </th>
            <th scope="col" :aria-sort="sort === 'delta' ? 'descending' : 'none'">
              <button @click="sort = 'delta'">
                {{ t('Δ胜率') }}<span aria-hidden="true">{{ sort === 'delta' ? '↓' : '' }}</span>
              </button>
            </th>
            <th scope="col" class="combo-games">{{ t('场次') }}</th>
          </tr>
        </thead>
        <tbody>
          <template
            v-for="slot in slots"
            :key="
              [
                data.meta.snapshotId,
                data.meta.query,
                slot.index,
                slot.row.championId,
                slot.row.runeId,
                slot.row.secondRuneId,
              ].join('|')
            "
            ><tr
              v-if="slot.row"
              :aria-rowindex="slot.index + 2"
              :data-rank="slot.index + 1"
              class="combo-row-enter"
            >
              <td>
                <div class="combo-pair">
                  <span
                    class="combo-rank"
                    :aria-label="message('第 {p0} 名', { p0: slot.index + 1 })"
                    >{{ slot.index + 1 }}</span
                  >
                  <a
                    :href="
                      buildDetailUrl(
                        Number(slot.row.championId),
                        '',
                        data.meta.patch,
                        dual ? undefined : slot.row.runeId,
                      )
                    "
                    :aria-label="
                      gameName(
                        'champions',
                        slot.row.championId,
                        selectedPatch,
                        slot.row.championName,
                      )
                    "
                    ><img :src="slot.row.championIcon" alt="" loading="lazy"
                  /></a>
                  <span class="combo-plus">×</span>
                  <div class="combo-runes" :class="{ 'combo-runes-stack': dual }">
                    <span class="combo-rune"
                      ><a :href="runeDetailUrl(slot.row.runeId, data.meta.patch)"
                        ><img
                          :src="augmentIcon(slot.row.runeId, data.meta.patch, slot.row.runeIcon)"
                          class="augment-artwork"
                          alt=""
                          loading="lazy"
                        /><span
                          class="combo-rune-name"
                          :title="
                            gameName('augments', slot.row.runeId, selectedPatch, slot.row.runeName)
                          "
                          >{{
                            gameName('augments', slot.row.runeId, selectedPatch, slot.row.runeName)
                          }}</span
                        ></a
                      ></span
                    >
                    <span v-if="slot.row.secondRuneId" class="combo-rune"
                      ><a :href="runeDetailUrl(slot.row.secondRuneId, data.meta.patch)"
                        ><img
                          :src="
                            augmentIcon(
                              slot.row.secondRuneId,
                              data.meta.patch,
                              slot.row.secondRuneIcon || '',
                            )
                          "
                          class="augment-artwork"
                          alt=""
                          loading="lazy"
                        /><span
                          class="combo-rune-name"
                          :title="
                            gameName(
                              'augments',
                              slot.row.secondRuneId || '',
                              selectedPatch,
                              slot.row.secondRuneName,
                            )
                          "
                          >{{
                            gameName(
                              'augments',
                              slot.row.secondRuneId || '',
                              selectedPatch,
                              slot.row.secondRuneName,
                            )
                          }}</span
                        ></a
                      ></span
                    >
                  </div>
                </div>
              </td>
              <td class="combo-rate">
                <ComboMetric :lines="[sampleText(slot.row)]"
                  ><span>{{ percent(slot.row.winRate) }}</span></ComboMetric
                >
              </td>
              <td class="combo-rate">
                <ComboMetric :lines="[sampleText(slot.row), '相对该英雄整体胜率的差值（百分点）']"
                  ><WinRateDelta :win-rate="slot.row.winRate" :baseline="slot.row.baseline"
                /></ComboMetric>
              </td>
              <td class="combo-games">{{ formatCount(slot.row.games) }}</td>
            </tr></template
          >
          <tr v-if="!rows.length">
            <td colspan="4" class="combo-empty">{{ t('没有符合条件的组合，试试其他关键词。') }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <BoardPagination
      v-if="!mobile"
      :page="page"
      :page-count="pageCount"
      :disabled="loading || !!error"
      :controls="sectionId + '-list'"
      :label="message('{p0}榜底部翻页', { p0: title })"
      bottom
      @change="turnPageFromBottom($event - page)"
    />
    <p
      v-if="mobile && !loading && !error && mobileLimit < rows.length"
      ref="sentinel"
      class="combo-load-more"
    >
      {{ t('下划查看更多。') }}
    </p>
    <p v-else-if="mobile && !loading && !error && rows.length" class="combo-load-more">
      {{ t('已显示全部') }}{{ rows.length }}{{ t('个组合。') }}
    </p>
    <div class="combo-footer">
      <p v-if="!loading" class="combo-count" role="status">
        {{
          error ||
          message('{p0} 个组合 · 显示前 {p1} 个 · {p2} · {p3}更新', {
            p0: (data?.meta.matchedEntries ?? 0).toLocaleString(),
            p1: rows.length,
            p2: selectedPatch,
            p3: updateDate(data?.meta.updatedAt),
          })
        }}
      </p>
      <details v-if="data" class="combo-source">
        <summary>{{ t('样本、来源与统计说明') }}</summary>
        <p :id="methodId" class="combo-method">
          {{
            t(
              'Δ胜率 = 组合胜率 − 同版本该英雄整体胜率（百分点）。胜率沿用原站的贝叶斯估计，描述历史关联。',
            )
          }}
        </p>
        <p>
          Mayhem · Queue {{ data.meta.queue }}{{ t('· 版本') }}{{ data.meta.patch }} ·
          {{ formatCount(data.meta.games)
          }}{{
            t('场对局。按完整有效英雄出场统计，同一出场的同符文去重，不要求流派可分类；仅列出至少')
          }}{{ data.meta.minimumGames }}{{ t('场的组合。') }}
        </p>
        <p v-if="dual">
          {{
            t(
              '双符文必须出现在同一英雄的同一次出场中，允许同时持有其他符文。A＋B 与 B＋A 合并为一条；Δ胜率比较的是该英雄整体胜率，不代表第二个符文带来的额外收益。',
            )
          }}
        </p>
        <p>
          {{ data.meta.source }}；{{ t(data.meta.region) }}{{ t('。时间范围：') }}{{ data.meta.from
          }}{{ t('至') }}{{ data.meta.cutoff }}。
        </p>
        <p>
          {{
            t(
              '胜率使用与英雄／符文详情页相同的后验估计；悬停或聚焦胜率／Δ胜率可查看样本数与英雄平均胜率。Δ胜率不是因果收益，小样本组合仍可能存在较大波动。',
            )
          }}
        </p>
      </details>
    </div>
  </section>
</template>
<style scoped>
.combo-spinner {
  display: block;
  width: 28px;
  height: 28px;
  border: 3px solid var(--border);
  border-top-color: var(--muted);
  border-radius: 50%;
  animation: combo-spin 0.8s linear infinite;
}
@keyframes combo-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .combo-spinner {
    animation: none;
  }
}
.combo-board:not(.double-combos) .combo-plus {
  margin-left: 5px;
}
.combo-row-enter {
  animation: combo-row-reveal 240ms ease-out both;
}
@keyframes combo-row-reveal {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .combo-row-enter {
    animation: none;
  }
}
.combo-load-more {
  margin: 16px 0;
  text-align: center;
  color: var(--muted);
  font-size: 13px;
  line-height: 24px;
}
.combo-board {
  min-width: 0;
  padding: 0 0 24px;
  margin: 0;
}

.combo-method,
.combo-count,
.combo-source {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.7;
}
.combo-method {
  margin: 14px 0 0;
}
.combo-count {
  margin: 12px 0;
  font-variant-numeric: tabular-nums;
}
.combo-list,
.combo-footer {
  width: 100%;
}
.combo-list {
  border-top: 1px solid var(--border);
  scroll-margin-top: calc(var(--site-nav-height, 0px) + 12px);
}
.combo-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
  font-variant-numeric: tabular-nums;
}
.combo-table tbody {
  background: var(--bg);
}
.combo-table th,
.combo-table td {
  text-align: right;
  border-bottom: 1px solid var(--border);
  box-sizing: border-box;
  padding: 12px 14px;
  height: 64px;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}
.combo-table th {
  height: 52px;
  font-size: 14px;
  color: var(--muted);
  font-weight: 700;
  background: color-mix(in srgb, var(--bg) var(--nav-opacity, 80%), transparent);
  position: sticky;
  top: var(--site-nav-height, 0px);
  z-index: 3;
}
.combo-table th:first-child,
.combo-table td:first-child {
  text-align: left;
  width: auto;
}
.combo-table th:not(:first-child) {
  width: 100px;
}
.combo-table td.combo-rate {
  font-weight: 700;
}
.combo-games {
  color: var(--muted);
}
.combo-table th button {
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  padding: 4px 0;
}
.combo-table th[aria-sort='descending'] {
  color: var(--accent-text);
}
.combo-table tbody tr[data-rank]:hover {
  background: var(--surface);
}
.combo-pair,
.combo-rune,
.combo-pair a {
  display: flex;
  align-items: center;
  gap: 10px;
}
.combo-pair {
  height: 50px;
  white-space: nowrap;
  overflow: hidden;
}
.combo-rank {
  min-width: 28px;
  margin-right: 6px;
  flex-shrink: 0;
  color: var(--muted);
  font-size: 14px;
  font-weight: 400;
  text-align: center;
}
.combo-pair > a,
.combo-pair img,
.combo-plus {
  flex-shrink: 0;
}
.combo-rune,
.combo-rune a {
  min-width: 0;
}
.combo-rune {
  flex-shrink: 1;
}
.combo-rune-name {
  overflow: hidden;
  text-overflow: ellipsis;
}
.combo-pair a {
  color: var(--text);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
}
.combo-pair a:hover {
  color: var(--accent-text);
}
.combo-runes {
  min-width: 0;
}
.combo-runes-stack {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.double-combos .combo-pair {
  height: auto;
  min-height: 40px;
}
.combo-column-label {
  display: inline-block;
  margin-left: 44px;
}
.combo-pair img {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  object-fit: contain;
}
.combo-rune img {
  width: 45px;
  height: 45px;
  background: transparent;
}
.double-combos .combo-rune img {
  width: 40px;
  height: 40px;
}
.combo-plus {
  color: var(--muted);
  font-size: 14px;
  font-weight: 400;
}
.combo-empty {
  white-space: normal !important;
  text-align: center !important;
  color: var(--muted);
  padding: 20px !important;
}
.combo-footer {
  min-width: 0;
}
.combo-source {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
  overflow-wrap: anywhere;
}
.combo-source summary {
  cursor: pointer;
}
button:focus-visible,
a:focus-visible,
select:focus-visible,
summary:focus-visible,
.combo-list:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
@media (max-width: 800px) {
  .combo-rank,
  .combo-table .combo-games {
    display: none;
  }
  .combo-column-label {
    margin-left: 0;
  }
  .combo-table th {
    position: sticky;
  }
  .combo-table th:not(:first-child) {
    width: 68px;
  }
  .combo-table th,
  .combo-table td {
    padding-inline: 6px;
  }
  .combo-table td {
    height: 60px;
  }
  .combo-table th {
    height: 46px;
  }
  .combo-pair,
  .combo-rune,
  .combo-pair a {
    gap: 6px;
  }
  .combo-pair a {
    font-size: 14px;
  }
  .combo-plus {
    font-size: 14px;
  }
  .double-combos .combo-pair,
  .double-combos .combo-rune,
  .double-combos .combo-pair a {
    gap: 3px;
  }
  .double-combos .combo-pair a {
    font-size: 14px;
  }
  .double-combos .combo-rune img {
    width: 24px;
    height: 24px;
  }
}
@media (max-width: 700px) {
  .combo-table th:first-child,
  .combo-table td:first-child {
    padding-left: 12px;
  }
  .combo-table th:nth-child(3),
  .combo-table td:nth-child(3) {
    padding-right: 12px;
  }
  .combo-table th:nth-child(3) {
    width: 74px;
  }
}
</style>
