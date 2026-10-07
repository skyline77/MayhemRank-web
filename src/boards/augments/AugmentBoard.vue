<script setup lang="ts">
// 海克斯榜：按胜率区间 × 品质（棱彩 / 黄金 / 白银）排列符文卡片，点击卡片在所在条带下方展开详情。
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { t, message } from '@/i18n/i18n'
import { gameName } from '@/i18n/gameLocalization'
import { useDocumentTitle } from '@/app/useDocumentTitle'
import { runeDetailUrl, boardLink } from '@/app/detailLink'
import { readHistorySection, registerHistorySection, pushDetailHistory } from '@/app/pageHistory'
import { selectedPatch, selectedVersion } from '@/data/versions'
import {
  fadeDetailAtTop,
  replaceDetailEntry,
  revealDetailImmediately,
  transitionDetail,
  handoffDetail,
  cancelDetailTransition,
  preserveDetailPosition,
} from '@/details/detailScroll'
import { loadDetailSearch, type DetailSearchIndex } from '@/details/detailSearch'
import DetailEdges from '@/details/DetailEdges.vue'
import BuildStatCard from '@/details/BuildStatCard.vue'
import RuneDetail from '@/details/rune/RuneDetail.vue'
import { createDescriptionAnchor } from '@/details/rune/descriptionAnchor'
import BoardNavSearch from '@/navigation/BoardNavSearch.vue'
import BoardBanner from '@/boards/BoardBanner.vue'
import BoardUpdateNote from '@/boards/BoardUpdateNote.vue'
import WinRateTable from '@/boards/WinRateTable.vue'
import WinRateBand from '@/boards/WinRateBand.vue'
import { winRateRows, winRateStrips } from '@/boards/winRateTable'
import { bandSections, openStripKey, stripGridRow, stripKeyOf } from '@/boards/boardStrips'
import { createBoardReflow } from '@/boards/boardReflow'
import { createBoardScrollFloor } from '@/boards/boardScrollFloor'
import { boardCardSize } from '@/boards/boardCardSize'
import { useCompactBoard } from '@/boards/useCompactBoard'
import { usePreviousPatch } from '@/boards/usePreviousPatch'
import RuneSearchControls from './RuneSearchControls.vue'
import RuneBoardNotes from './RuneBoardNotes.vue'
import { loadRuneBoard, runeColumns, type RuneBoard, type RuneEntry } from './augmentBoard'
import { runeCardTrend } from './runeComparison'

// ---- 榜单数据与浏览器历史 ----
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
// 与上一版本比较胜率，在卡片上显示趋势标记
const previous = usePreviousPatch(loadRuneBoard)
const trends = computed(() => {
  const result: Record<string, ReturnType<typeof runeCardTrend>> = {}
  const previousBoard = previous.board.value
  if (!data.value || previous.comparedWith.value !== data.value.meta.patch || !previousBoard)
    return result
  const rates = new Map(previousBoard.entries.map(e => [e.id, e.winRate]))
  for (const entry of data.value.entries)
    result[entry.id] = runeCardTrend(entry.winRate, rates.get(entry.id))
  return result
})

// ---- 读取榜单与搜索索引 ----
let serial = 0
// 拼音与首字母索引读取失败时，仍可按中文名称搜索
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
  void loadSearch(patch, current)
  void previous.load(patch)
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
    // 深链接（?rune=…）：榜单就绪后直接展开对应详情
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

// ---- 表格布局：品质列、条带与胜率区间 ----
const columnFilter = ref(savedView?.column || '')
// 筛选某一品质后：选中列占满剩余宽度，其余列收窄为表头宽度
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
// openPanels：条带 key → 在该条带下方展开的符文
const selected = ref<RuneEntry | null>(null),
  openPanels = ref<Record<string, RuneEntry>>({})
useDocumentTitle(
  () => selected.value,
  () =>
    selected.value
      ? gameName('augments', selected.value.id, selectedPatch.value, selected.value.name)
      : t('海克斯榜'),
)
const stripFor = (entry: RuneEntry | null) => stripKeyOf(strips.value, entry)
// 从浏览器历史恢复详情时保留原来挂载的条带
const selectedStrip = computed(() => openStripKey(openPanels.value, selected.value))
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
const gridRow = (key: string) => stripGridRow(strips.value, openPanels.value, key)
const ranges = computed(() => bandSections(strips.value, openPanels.value))
onUnmounted(
  registerHistorySection('rune-board', () => ({
    query: query.value,
    column: columnFilter.value,
    selectedId: selected.value?.id || null,
    strip: selectedStrip.value,
  })),
)

// ---- 品质列筛选 ----
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
  descriptionAnchor.stop()
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

// ---- 详情的展开、交接与关闭 ----
const descriptionAnchor = createDescriptionAnchor()
onUnmounted(descriptionAnchor.stop)
async function selectEntry(entry: RuneEntry, linked = false) {
  descriptionAnchor.stop()
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
    if (location.hash === '#rune-description') descriptionAnchor.anchor(detailPanel(target))
    return
  }
  // 手机：顶部淡入；桌面已有详情：交接到新位置；桌面首次展开：高度展开并滚动到位
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
      beforeReplace: descriptionAnchor.stop,
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
  // 搜索打开的符文可能不在这一条带，关闭时朝本条带收起。
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
        <BoardUpdateNote
          v-if="data.meta.updatedAt"
          class="board-updated-corner board-updated-desktop"
          :updated-at="data.meta.updatedAt"
          :games="data.meta.games"
        />
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
                >
                  <template #result-extra
                    ><span
                      v-if="trends[entry.id]"
                      class="rune-card-trend"
                      :class="'is-' + trends[entry.id]!.tone"
                      :style="{ color: trends[entry.id]!.color }"
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
            :span="range.strips.length"
            :stacked="compact"
          />
        </template>
        <template #empty>
          <p v-if="!rows.length" class="board-message" role="status">
            {{ t('当前版本暂无达到样本门槛的符文。') }}
          </p>
        </template>
      </WinRateTable>
      <BoardUpdateNote
        v-if="data.meta.updatedAt"
        class="board-updated-mobile"
        :updated-at="data.meta.updatedAt"
        :games="data.meta.games"
      />
      <p v-if="error" class="board-message" role="alert">
        {{ t(error) }} <button class="board-retry" @click="load">{{ t('重新加载') }}</button>
      </p>
      <p v-if="searchError" class="board-message" role="status">
        {{ searchError }}
        <button class="board-retry" @click="loadSearch(selectedPatch, serial)">
          {{ t('重试搜索词加载') }}
        </button>
      </p>
      <RuneBoardNotes :meta="data.meta" :unranked="unranked" />
    </template>
  </section>
</template>
