<script setup lang="ts">
import { locale, brands } from './locale'
import { t, message } from './i18n'
import { gameName } from './gameLocalization'
import DetailEdges from './DetailEdges.vue'
import { createBoardScrollFloor } from './boardScrollFloor'
import { formatCount } from './formatCount'

import BoardBanner from './BoardBanner.vue'
import { createBoardReflow } from './boardReflow'
import { boardCardSize } from './boardCardSize'
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { navigationInset } from './navigationLayout'
import RuneDetail from './RuneDetail.vue'
import { runeDetailUrl, boardLink } from './detailLink'
import { readHistorySection, registerHistorySection, pushDetailHistory } from './pageHistory'
import {
  fadeDetailAtTop,
  replaceDetailEntry,
  revealDetailImmediately,
  transitionDetail,
  handoffDetail,
  cancelDetailTransition,
  preserveDetailPosition,
} from './detailScroll'
import WinRateTable from './WinRateTable.vue'
import BoardNavSearch from './BoardNavSearch.vue'
import { useCompactBoard } from './useCompactBoard'
import WinRateBand from './WinRateBand.vue'
import { winRateRows, winRateStrips } from './winRateTable'
import { loadRuneBoard, runeColumns, type RuneBoard, type RuneEntry } from './augmentBoard'
import BuildStatCard from './BuildStatCard.vue'
import RuneSearchControls from './RuneSearchControls.vue'

import { loadDetailSearch, type DetailSearchIndex } from './detailSearch'
import { selectedPatch, selectedVersion, updateDate, loadVersions } from './versions'
import { previousRunePatch, runeCardTrend } from './runeComparison'
const data = ref<RuneBoard | null>(null),
  loading = ref(true),
  error = ref('')
const savedView = readHistorySection<{
  query: string
  selectedId: string | null
  strip: string | null
  column?: string
}>('rune-board')
let restoreSelection = savedView?.selectedId
let pendingRune = savedView ? null : boardLink(location.search).rune || null
const linkNotice = ref('')
const query = ref(savedView?.query || ''),
  searchIndex = ref<DetailSearchIndex | null>(null),
  searchError = ref('')
const previousBoard = ref<RuneBoard | null>(null),
  previousFor = ref('')
const trends = computed(() => {
  const result: Record<string, ReturnType<typeof runeCardTrend>> = {}
  if (!data.value || previousFor.value !== data.value.meta.patch || !previousBoard.value)
    return result
  const rates = new Map(previousBoard.value.entries.map(e => [e.id, e.winRate]))
  for (const entry of data.value.entries)
    result[entry.id] = runeCardTrend(entry.winRate, rates.get(entry.id))
  return result
})
let serial = 0
async function loadPrevious(patch: string, current: number) {
  try {
    const manifest = await loadVersions()
    const previousPatch = previousRunePatch(
      patch,
      manifest.patches.map(p => p.patch),
    )
    if (!previousPatch) return
    const value = await loadRuneBoard(previousPatch)
    if (current === serial) {
      previousBoard.value = value
      previousFor.value = patch
    }
  } catch {
    /* Missing history leaves card indicators empty. */
  }
}
async function loadSearch(patch: string, current: number) {
  try {
    const index = await loadDetailSearch(patch)
    if (current === serial) {
      searchIndex.value = index
      searchError.value = ''
    }
  } catch {
    if (current === serial) searchError.value = '拼音与首字母搜索暂时不可用，仍可使用中文搜索。'
  }
}
async function load() {
  const current = ++serial
  const patch = selectedPatch.value
  searchIndex.value = null
  searchError.value = ''
  previousBoard.value = null
  previousFor.value = ''
  void loadSearch(patch, current)
  void loadPrevious(patch, current)
  loading.value = true
  error.value = ''
  try {
    const value = await loadRuneBoard(patch)
    if (current !== serial) return
    const previousId = selected.value?.id || restoreSelection
    const restoreStrip = restoreSelection ? savedView?.strip : null
    restoreSelection = undefined
    const animateVersionChange =
      !!data.value &&
      (data.value.meta.patch !== value.meta.patch ||
        data.value.meta.snapshotId !== value.meta.snapshotId) &&
      !previousId &&
      !pendingRune
    const applyBoard = async () => {
      data.value = value
      selected.value = value.entries.find(entry => entry.id === previousId) || null
      const key =
        selected.value && restoreStrip && strips.value.some(strip => strip.key === restoreStrip)
          ? restoreStrip
          : stripFor(selected.value)
      openPanels.value = key && selected.value ? { [key]: selected.value } : {}
      await nextTick()
    }
    if (animateVersionChange) {
      await columnReflow.run(
        table.value?.header?.closest<HTMLElement>('.board-table') || null,
        applyBoard,
      )
    } else {
      await preserveDetailPosition(() => detailPanel(), applyBoard)
    }
    if (current !== serial) return
    if (pendingRune) {
      const id = pendingRune
      pendingRune = null
      const entry = value.entries.find(entry => entry.id === id)
      if (entry) {
        await selectEntry(entry, true)
      } else linkNotice.value = '该符文在当前版本暂无统计。'
    }
  } catch {
    if (current === serial) error.value = '符文统计暂时无法读取，请重试。'
  } finally {
    if (current === serial) loading.value = false
  }
}
onUnmounted(() => {
  serial++
  cancelDetailTransition()
})
const columnFilter = ref(savedView?.column || '')
const focusedCardSize = ref(72)
const columnWidths = ref<number[]>([]),
  columnSlots = ref(4)
const focusedColumns = computed(() => !!columnFilter.value && columnWidths.value.length === 3)
const columnGrid = computed(() =>
  focusedColumns.value
    ? (compact.value ? '32px' : 'var(--board-axis-width)') +
      ' ' +
      runeColumns
        .map((name, i) =>
          name === columnFilter.value ? 'minmax(0,1fr)' : columnWidths.value[i] + 'px',
        )
        .join(' ')
    : undefined,
)
const rows = computed(() =>
  winRateRows(
    (data.value?.entries || []).filter(
      entry => !columnFilter.value || entry.column === columnFilter.value,
    ),
    runeColumns,
  ),
)
const compact = useCompactBoard(
  () => detailPanel(),
  () => {
    const key = stripFor(selected.value)
    openPanels.value = key && selected.value ? { [key]: selected.value } : {}
  },
)
const strips = computed(() =>
  winRateStrips(
    rows.value,
    focusedColumns.value
      ? [columnSlots.value, columnSlots.value, columnSlots.value]
      : compact.value
        ? [2, 2, 2]
        : [4, 4, 4],
  ),
)
const table = ref<InstanceType<typeof WinRateTable> | null>(null)
const selected = ref<RuneEntry | null>(null),
  openPanels = ref<Record<string, RuneEntry>>({})
watch(
  [() => selected.value, locale],
  () => {
    document.title =
      brands[locale.value] +
      ' - ' +
      (selected.value
        ? gameName('augments', selected.value.id, selectedPatch.value, selected.value.name)
        : t('海克斯榜'))
  },
  { immediate: true },
)
const stripFor = (entry: RuneEntry | null) =>
  entry
    ? strips.value.find(strip => strip.cells.some(cell => cell.some(item => item.id === entry.id)))
        ?.key || null
    : null
// Preserve the mounted slot when restoring a detail from browser history.
const selectedStrip = computed(
  () =>
    Object.keys(openPanels.value).find(key => openPanels.value[key]?.id === selected.value?.id) ||
    null,
)
const detailPanel = (key = selectedStrip.value) =>
  key
    ? table.value?.header?.parentElement?.querySelector<HTMLElement>(
        '[data-rune-strip="' + key + '"]',
      ) || null
    : null
const findTrigger = (id: string) =>
  table.value?.header?.parentElement?.querySelector<HTMLElement>(
    '[data-rune-id="' + CSS.escape(id) + '"]',
  ) || null
const gridRow = (key: string) => {
  const index = strips.value.findIndex(strip => strip.key === key)
  return (
    index + 1 + strips.value.slice(0, index).filter(strip => openPanels.value[strip.key]).length
  )
}
const ranges = computed(() => {
  const sections: { key: string; lower: number; upper: number; count: number }[] = []
  let section: (typeof sections)[number] | undefined
  for (const strip of strips.value) {
    if (!section) section = { key: strip.key, lower: strip.lower, upper: strip.upper, count: 0 }
    section.count++
    if (strip.last || openPanels.value[strip.key]) {
      sections.push(section)
      section = undefined
    }
  }
  return sections
})
onUnmounted(
  registerHistorySection('rune-board', () => ({
    query: query.value,
    column: columnFilter.value,
    selectedId: selected.value?.id || null,
    strip: selectedStrip.value,
  })),
)
const columnReflow = createBoardReflow('.build-stat-card[data-rune-id]', 'data-rune-id', true)
onUnmounted(columnReflow.stop)
const scrollFloor = createBoardScrollFloor({ keepBoardVisible: true })
onUnmounted(scrollFloor.dispose)
function measureColumns() {
  const header = table.value?.header
  if (!header || !columnFilter.value) return
  const labels = Array.from(header.querySelectorAll<HTMLElement>('.rune-column-name'))
  if (labels.length !== 3) return
  const widths = labels.map(label =>
    compact.value ? Math.ceil(label.getBoundingClientRect().width) + 25 : 80,
  )
  const axis = header.querySelector('.board-axis')?.getBoundingClientRect().width || 72
  const gap = compact.value ? 4 : 6,
    inset = compact.value ? 8 : 24
  const available =
    header.clientWidth -
    2 -
    axis -
    (compact.value
      ? 0
      : widths.reduce(
          (sum, width, i) => sum + (runeColumns[i] === columnFilter.value ? 0 : width),
          0,
        ))
  const cardSize = boardCardSize('rune', header.clientWidth, axis, compact.value)
  const slots = Math.max(1, Math.floor((available - inset - 1 + gap) / (cardSize + gap)))
  if (
    Math.abs(cardSize - focusedCardSize.value) < 0.01 &&
    slots === columnSlots.value &&
    widths.every((width, i) => width === columnWidths.value[i])
  )
    return
  void preserveDetailPosition(
    () => detailPanel(),
    async () => {
      focusedCardSize.value = cardSize
      columnWidths.value = widths
      columnSlots.value = slots
      const key = stripFor(selected.value)
      openPanels.value = key && selected.value ? { [key]: selected.value } : {}
      await nextTick()
    },
  )
}
watch(
  [table, columnFilter, compact],
  async (_value, _previous, onCleanup) => {
    const observer = new ResizeObserver(measureColumns)
    let active = true
    onCleanup(() => {
      active = false
      observer.disconnect()
    })
    await nextTick()
    if (!active) return
    if (table.value?.header) observer.observe(table.value.header)
    measureColumns()
  },
  { flush: 'post' },
)
async function toggleColumn(column: string) {
  const switching = !!columnFilter.value && columnFilter.value !== column
  const clearing = columnFilter.value === column
  stopDescriptionAnchor()
  const root = table.value?.header?.closest<HTMLElement>('.board-table') || null
  await scrollFloor.preserve(root, () =>
    columnReflow.run(
      root,
      async () => {
        cancelDetailTransition()
        selected.value = null
        openPanels.value = {}
        columnFilter.value = columnFilter.value === column ? '' : column
        await nextTick()
        measureColumns()
        await nextTick()
      },
      { columnVisual: true, revealNew: switching || clearing, enterOnly: switching },
    ),
  )
}
let stopDescriptionAnchor = () => {}
onUnmounted(() => stopDescriptionAnchor())
function anchorDescription(panel: HTMLElement | null) {
  stopDescriptionAnchor()
  const section = panel?.querySelector<HTMLElement>('.rune-description')
  if (!panel || !section) return
  let frame = 0
  const align = () => {
    const header = panel.querySelector<HTMLElement>('.build-detail-heading')
    window.scrollBy({
      top:
        section.getBoundingClientRect().top - navigationInset() - (header?.offsetHeight || 0) - 9,
      behavior: 'instant',
    })
  }
  const observer = new ResizeObserver(() => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(align)
  })
  const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const
  stopDescriptionAnchor = () => {
    observer.disconnect()
    cancelAnimationFrame(frame)
    for (const event of events) window.removeEventListener(event, stopDescriptionAnchor, true)
  }
  for (const event of events)
    window.addEventListener(event, stopDescriptionAnchor, { capture: true, passive: true })
  observer.observe(panel)
  align()
}
async function selectEntry(entry: RuneEntry, linked = false) {
  stopDescriptionAnchor()
  const target = stripFor(entry) || (linked ? strips.value.at(-1)?.key : null),
    previous = selectedStrip.value
  if (!target) return
  if (selected.value?.id === entry.id) {
    await closeDetail(previous || target)
    return
  }
  if (!linked) pushDetailHistory(runeDetailUrl(entry.id, selectedPatch.value))
  const prepare = async () => {
    selected.value = entry
    openPanels.value = { ...openPanels.value, [target]: entry }
    await nextTick()
  }
  if (linked) {
    await revealDetailImmediately(() => detailPanel(target), prepare)
    if (location.hash === '#rune-description') anchorDescription(detailPanel(target))
    return
  }
  if (window.matchMedia('(max-width:700px)').matches) {
    await fadeDetailAtTop(
      () => detailPanel(target),
      async () => {
        selected.value = entry
        openPanels.value = { [target]: entry }
        await nextTick()
      },
    )
  } else if (previous && detailPanel(previous)) {
    await handoffDetail({
      previous: () => detailPanel(previous),
      target: () => detailPanel(target),
      sameRow: previous === target,
      prepare,
      finish: async () => {
        openPanels.value = { [target]: entry }
        await nextTick()
      },
    })
  } else
    await transitionDetail({
      panel: () => detailPanel(target),
      anchor: () => findTrigger(entry.id),
      opening: true,
      scrollAfterOpen: true,
      render: prepare,
    })
}
async function openSearchResult(entry: RuneEntry) {
  if (loading.value) return
  const currentStrip = selectedStrip.value
  if (currentStrip && openPanels.value[currentStrip]) {
    if (selected.value?.id !== entry.id)
      pushDetailHistory(runeDetailUrl(entry.id, selectedPatch.value))
    await replaceDetailEntry({
      entry,
      key: currentStrip,
      loading: loading.value,
      selected,
      openPanels,
      panel: () => detailPanel(currentStrip),
      beforeReplace: stopDescriptionAnchor,
      afterRender: nextTick,
    })
    return
  }
  if (!findTrigger(entry.id)) return
  if (selected.value?.id === entry.id) {
    await handoffDetail({
      previous: () => null,
      target: () => detailPanel(),
      sameRow: false,
      prepare: async () => {},
      finish: async () => {},
    })
  } else await selectEntry(entry)
}
async function closeDetail(key = selectedStrip.value) {
  if (!key || !openPanels.value[key]) return
  pushDetailHistory('/?page=augments&patch=' + encodeURIComponent(selectedPatch.value))
  const id = openPanels.value[key]!.id
  // A searched rune may belong to another board row. Close towards this slot.
  const strip = strips.value.find(strip => strip.key === key)
  const anchorId = strip?.cells.some(cell => cell.some(entry => entry.id === id))
    ? id
    : strip?.cells.flat()[0]?.id
  const trigger = anchorId ? findTrigger(anchorId) : null
  const finished = await transitionDetail({
    panel: () => detailPanel(key),
    anchor: () => trigger,
    opening: false,
    closeInset: (table.value?.header?.offsetHeight || 104) + 12,
    render: async () => {
      const rest = { ...openPanels.value }
      delete rest[key]
      openPanels.value = rest
      if (selected.value?.id === id) selected.value = Object.values(rest).at(-1) || null
      await nextTick()
    },
  })
  if (finished) trigger?.focus({ preventScroll: true })
}

watch(
  selectedVersion,
  () => {
    cancelDetailTransition()
    void load()
  },
  { immediate: true },
)
const unranked = computed(() => (data.value?.entries || []).filter(entry => entry.lowSample))
const pct = (n: number) => (n * 100).toFixed(1) + '%'
const count = formatCount
</script>
<template>
  <section
    class="build-board rune-board"
    data-search-group="rune-board"
    :aria-label="t('海克斯榜')"
    :aria-busy="loading"
  >
    <BoardNavSearch :query="query">
      <RuneSearchControls
        data-search-group="rune-board"
        v-model="query"
        :entries="data?.entries || []"
        :patch="data?.meta.patch || selectedPatch"
        :index="searchIndex"
        :loading="loading"
        @select="openSearchResult"
      />
    </BoardNavSearch>
    <p v-if="loading && !data" class="board-message" role="status">
      {{ t('正在读取海克斯符文统计……') }}
    </p>
    <div v-else-if="error && !data" class="board-message" role="alert">
      {{ t(error) }} <button class="board-retry" @click="load">{{ t('重新加载') }}</button>
    </div>
    <template v-else-if="data">
      <BoardBanner style="--board-banner-offset: 15px">
        <p v-if="linkNotice" class="board-message" role="status">{{ linkNotice }}</p>
        <p
          v-if="data.meta.updatedAt"
          class="board-updated board-updated-corner board-updated-desktop"
        >
          {{ t('数据更新于') }}{{ updateDate(data.meta.updatedAt) }}{{ t('，共')
          }}{{ count(data.meta.games) }}{{ t('场。') }}
        </p>
      </BoardBanner>
      <WinRateTable
        ref="table"
        :layout-revision="strips"
        :class="{ 'has-focused-column': focusedColumns }"
        :style="{
          '--focused-rune-columns': columnGrid,
          '--focused-rune-slots': columnSlots,
          '--focused-card-size': focusedCardSize + 'px',
        }"
        :label="t('按胜率区间与棱彩、黄金、白银排列的海克斯符文')"
        :columns="runeColumns"
        :row-count="strips.length + 1 + Object.keys(openPanels).length"
        :scroll-label="t('海克斯符文榜')"
      >
        <template #column="{ column, index }"
          ><button
            type="button"
            class="board-column-filter"
            :class="'rune-rarity-' + index"
            :aria-pressed="columnFilter === column"
            :title="
              columnFilter === column
                ? t('再次点击显示全部品质')
                : message('筛选{p0}', { p0: t(column) })
            "
            @click="toggleColumn(column)"
          >
            <span class="rune-column-name">{{ t(column) }}</span>
          </button></template
        >
        <template #default>
          <template v-for="strip in strips" :key="strip.key">
            <div
              class="board-row board-strip"
              :class="{
                'board-strip-first': strip.index === 0,
                'board-strip-last': strip.last || !!openPanels[strip.key],
              }"
              :style="{ gridRow: gridRow(strip.key) }"
              role="row"
            >
              <div
                class="board-axis board-range"
                role="rowheader"
                :aria-label="
                  message('{p0}% 至{p1}%，下界包含，{p2}', {
                    p0: strip.lower,
                    p1: strip.upper,
                    p2: strip.upper === 100 ? t('上界包含') : t('上界不含'),
                  })
                "
              ></div>
              <div
                v-for="(cell, i) in strip.cells"
                :key="runeColumns[i]"
                class="board-cell rune-cell"
                :class="{ 'is-focused-cell': runeColumns[i] === columnFilter }"
                role="cell"
                :aria-label="
                  message('{p0}，{p1} 个符文', { p0: t(runeColumns[i]), p1: cell.length })
                "
              >
                <BuildStatCard
                  v-for="entry in cell"
                  :key="entry.id"
                  :data-rune-id="entry.id"
                  :href="runeDetailUrl(entry.id, data.meta.patch)"
                  :cell="entry"
                  :group="entry.rarity"
                  :patch="data.meta.patch"
                  usage-display="count"
                  expandable
                  :expanded="selected?.id === entry.id"
                  :aria-controls="
                    selected?.id === entry.id ? 'rune-detail-' + selectedStrip : undefined
                  "
                  @activate="selectEntry(entry)"
                  :title="
                    message('{p0} · 胜率 {p1} · 使用次数 {p2}次{p3} · 点击查看逐选走势', {
                      p0: gameName('augments', entry.id, data.meta.patch, entry.name),
                      p1: pct(entry.winRate),
                      p2: count(entry.games),
                      p3: trends[entry.id] ? ' · ' + trends[entry.id]!.label : '',
                    })
                  "
                >
                  <template #result-extra
                    ><span
                      v-if="trends[entry.id]"
                      class="rune-card-trend"
                      :class="'is-' + trends[entry.id]!.tone"
                      :style="{ color: trends[entry.id]!.color }"
                      :title="trends[entry.id]!.label"
                      :aria-label="trends[entry.id]!.label"
                      >{{ trends[entry.id]!.symbol }}</span
                    ></template
                  >
                </BuildStatCard>
              </div>
            </div>
            <div
              v-if="openPanels[strip.key]"
              :data-rune-strip="strip.key"
              class="board-detail-row"
              :style="{ gridRow: gridRow(strip.key) + 1 }"
              role="row"
            >
              <DetailEdges />
              <div role="cell" aria-colspan="4">
                <RuneDetail
                  :entry="openPanels[strip.key]!"
                  :patch="data.meta.patch"
                  :panel-id="'rune-detail-' + strip.key"
                  @close="closeDetail(strip.key)"
                >
                </RuneDetail>
              </div>
            </div>
          </template>
          <WinRateBand
            v-for="range in ranges"
            :key="range.key"
            :lower="range.lower"
            :upper="range.upper"
            :row="gridRow(range.key)"
            :span="range.count"
            :stacked="compact"
          />
        </template>
        <template #empty>
          <p v-if="!rows.length" class="board-message" role="status">
            {{ t('当前版本暂无达到样本门槛的符文。') }}
          </p>
        </template>
      </WinRateTable>
      <p v-if="data.meta.updatedAt" class="board-updated board-updated-mobile">
        {{ t('数据更新于') }}{{ updateDate(data.meta.updatedAt) }}{{ t('，共')
        }}{{ count(data.meta.games) }}{{ t('场。') }}
      </p>
      <p v-if="error" class="board-message" role="alert">
        {{ t(error) }} <button class="board-retry" @click="load">{{ t('重新加载') }}</button>
      </p>
      <p v-if="searchError" class="board-message" role="status">
        {{ searchError }}
        <button class="board-retry" @click="loadSearch(selectedPatch, serial)">
          {{ t('重试搜索词加载') }}
        </button>
      </p>
      <details class="board-method">
        <summary>{{ t('数据范围与胜率说明') }}</summary>
        <p>
          Mayhem · queue {{ data.meta.queue }} · {{ data.meta.patch }} ·
          {{ t(data.meta.region) }}。{{ data.meta.source }}；{{ data.meta.from.slice(0, 10)
          }}{{ t('至') }}{{ data.meta.cutoff.slice(0, 10) }}{{ t('（UTC），来源共')
          }}{{ count(data.meta.games) }}{{ t('场对局。') }}
        </p>
        <p>
          {{ t('首版复用英雄流派快照，仅涵盖可分类且具有已知符文记录的')
          }}{{ count(data.meta.denominator)
          }}{{
            t(
              '个出场人次，不代表全部对局。缺失装备、不足两件 TOP10 成装、无法识别流派或没有已知符文的出场不进入分母。',
            )
          }}
        </p>
        <p>
          {{
            t(
              '胜率按原始胜场、使用人次合并后计算（胜场 + 1）÷（使用人次 + 2），不平均各英雄或流派的胜率。使用率 = 携带该符文的人次 ÷ 上述有效出场人次，不是出现后的选择率；每人可携带多个符文，总和可超过 100%。',
            )
          }}
        </p>
        <p>
          {{ t('复用英雄榜每 2 个百分点的分档，至少') }}{{ data.meta.minimumGames
          }}{{
            t(
              '人次才入榜。同格按未取整平滑胜率和样本数降序。胜率是历史关联，受英雄和流派构成影响，不表示因果收益。',
            )
          }}
        </p>
      </details>
      <details v-if="unranked.length" class="board-method">
        <summary>{{ unranked.length }}{{ t('个符文样本不足，暂不分档') }}</summary>
        <p>
          <span v-for="entry in unranked" :key="entry.id"
            >{{ gameName('augments', entry.id, data.meta.patch, entry.name) }}（{{
              count(entry.games)
            }}{{ t('人次）') }}</span
          >
        </p>
      </details>
      <footer class="board-footer">
        <span>{{
          message('数据地区：{region} · 版本 {patch} · 队列 {queue}', {
            region: t(data.meta.region) || t('地区无法核验'),
            patch: data.meta.patch,
            queue: data.meta.queue,
          })
        }}</span
        ><span>Mayhem · 2400 · {{ data.meta.patch }}</span
        ><span
          >{{ count(data.meta.denominator) }}{{ t('个有效出场人次 ·')
          }}{{ t(data.meta.region) }}</span
        ><span>{{ t('按胜率分档 · 棱彩 / 黄金 / 白银') }}</span>
      </footer>
    </template>
  </section>
</template>
