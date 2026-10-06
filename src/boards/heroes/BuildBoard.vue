<script setup lang="ts">
// 英雄榜：按胜率区间 × 职责列排列英雄（或流派）头像，点击头像在所在条带下方展开详情。
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { t, message } from '@/i18n/i18n'
import { gameName, roleName } from '@/i18n/gameLocalization'
import { formatCount } from '@/stats/formatCount'
import { winRateColor } from '@/stats/winRateColor'
import { useNearViewport } from '@/shared/useNearViewport'
import { useDocumentTitle } from '@/app/useDocumentTitle'
import { readHistorySection, registerHistorySection, pushDetailHistory } from '@/app/pageHistory'
import { buildDetailUrl, boardLink } from '@/app/detailLink'
import { selectedPatch, selectedVersion } from '@/data/versions'
import championSearch from '@/data/championSearch'
import heroDisplayRoles from '@/generated/heroDisplayRoles.json'
import {
  fadeDetailAtTop,
  replaceDetailEntry,
  revealDetailImmediately,
  transitionDetail,
  handoffDetail,
  cancelDetailTransition,
  preserveDetailPosition,
} from '@/details/detailScroll'
import DetailEdges from '@/details/DetailEdges.vue'
import DetailLink from '@/details/DetailLink.vue'
import BuildDetail from '@/details/hero/BuildDetail.vue'
import { prefetchHeroDetail } from '@/details/hero/prefetchHeroDetail'
import type { RuneFilter } from '@/details/hero/heroFilter'
import BoardNavSearch from '@/navigation/BoardNavSearch.vue'
import BoardBanner from '@/boards/BoardBanner.vue'
import BoardModeSwitch from '@/boards/BoardModeSwitch.vue'
import BoardUpdateNote from '@/boards/BoardUpdateNote.vue'
import WinRateTable from '@/boards/WinRateTable.vue'
import WinRateBand from '@/boards/WinRateBand.vue'
import { winRateStrips } from '@/boards/winRateTable'
import { bandSections, openStripKey, stripGridRow, stripKeyOf } from '@/boards/boardStrips'
import { createBoardReflow } from '@/boards/boardReflow'
import { createBoardScrollFloor } from '@/boards/boardScrollFloor'
import { boardCardSize, compactHeroSlots } from '@/boards/boardCardSize'
import { useCompactBoard } from '@/boards/useCompactBoard'
import { usePreviousPatch } from '@/boards/usePreviousPatch'
import { loadRuneBoard } from '@/boards/augments/augmentBoard'
import { runeCardTrend } from '@/boards/augments/runeComparison'
import HeroSearch from './HeroSearch.vue'
import HeroBoardNotes from './HeroBoardNotes.vue'
import { rankHeroes } from './heroRanking'
import { useRankingMode } from './useRankingMode'
import { useRoleIcons } from './useRoleIcons'
import {
  championBuilds,
  buildRows,
  buildStrips,
  columns,
  compactColumns,
  compactColumnGroups,
  type BuildEntry,
  type BoardMeta,
  loadBuildBoard,
} from './buildBoard'

// ---- 榜单数据 ----
const data = ref<{ meta: BoardMeta; entries: BuildEntry[]; heroEntries?: BuildEntry[] } | null>(
  null,
)
// 与上一版本比较，只标记胜率上升的英雄
const previous = usePreviousPatch(loadBuildBoard)
const heroTrends = computed(() => {
  const trends: Record<number, ReturnType<typeof runeCardTrend>> = {}
  const previousHeroes = previous.board.value?.heroEntries || []
  if (
    rankingMode.value !== 'heroes' ||
    !data.value ||
    previous.comparedWith.value !== data.value.meta.patch
  )
    return trends
  const rates = new Map(previousHeroes.map(hero => [hero.championId, hero.winRate]))
  for (const hero of data.value.heroEntries || []) {
    const trend = runeCardTrend(hero.winRate, rates.get(hero.championId))
    if (trend?.tone.startsWith('up')) trends[hero.championId] = trend
  }
  return trends
})
const { roleIcons, failedIcons: failedRoleIcons } = useRoleIcons(selectedPatch)

// ---- 浏览器历史与深链接 ----
const savedView = readHistorySection<{
  query: string
  column: string
  selectedId: string | null
  anchorId?: string | null
  stripKey?: string | null
  mode?: string
}>('hero-board')
let restoreSelection = savedView?.selectedId
let pendingLink = savedView ? null : boardLink(location.search)
const initialRune = ref<RuneFilter | null>(null),
  linkNotice = ref('')
const { seen: nearPortraits, directive: vNearPortrait } = useNearViewport()

// ---- 统计方式：按英雄 / 按最强流派 ----
const { mode: rankingMode, persist: persistRankingMode } = useRankingMode(savedView?.mode)
const boardEntries = computed(() =>
  rankHeroes(
    data.value?.heroEntries || [],
    data.value?.entries || [],
    heroDisplayRoles,
    rankingMode.value === 'roles',
    data.value?.meta.minimumGames || 50,
  ),
)
async function setRankingMode(mode: string) {
  if (mode === rankingMode.value) return
  await columnReflow.run(
    table.value?.header?.closest<HTMLElement>('.board-table') || null,
    async () => {
      resetDetails()
      rankingMode.value = mode
      await nextTick()
    },
  )
  persistRankingMode()
}

const query = ref(savedView?.query || ''),
  error = ref(''),
  loading = ref(false)
const selected = ref<BuildEntry | null>(null)
useDocumentTitle(
  () => selected.value,
  () =>
    selected.value
      ? gameName('champions', selected.value.championId, selectedPatch.value, selected.value.name)
      : t('英雄榜'),
)

// ---- 详情的展开、替换与关闭 ----
// openPanels：条带 key → 在该条带下方展开的英雄
const openPanels = ref<Record<string, BuildEntry>>({})
// 打开详情的头像；关闭时焦点回到这里
let selectedTriggerId: string | null = savedView?.anchorId || null
function findTrigger(id = selectedTriggerId) {
  return id
    ? stickyHeader.value?.parentElement?.querySelector<HTMLAnchorElement>(
        `[data-build-id="${CSS.escape(id)}"]`,
      ) || null
    : null
}
function detailPanel(key = selectedStrip.value) {
  return key
    ? stickyHeader.value?.parentElement?.querySelector<HTMLElement>(
        `[data-detail-strip="${CSS.escape(key)}"]`,
      ) || null
    : null
}
const stripFor = (entry: BuildEntry | null) => stripKeyOf(strips.value, entry)
// 鼠标或触控笔按下时提前请求详情数据。触摸时不预取：手机的停顿主要来自整页重排，
// 数据提前到达反而会与挂载挤在同一段工作中，实测缓存命中时停顿更长。
function prefetchOnPress(event: PointerEvent, entry: BuildEntry) {
  if (event.pointerType !== 'touch' && data.value) prefetchHeroDetail(entry, data.value.meta.patch)
}
async function selectEntry(entry: BuildEntry, _trigger: HTMLAnchorElement | null, linked = false) {
  if (!linked) initialRune.value = null
  const targetStrip = stripFor(entry) || (linked ? strips.value.at(-1)?.key : null),
    previousStrip = selectedStrip.value
  if (!targetStrip) return
  if (!linked && selected.value?.id !== entry.id)
    pushDetailHistory(buildDetailUrl(entry.championId, entry.role, selectedPatch.value))
  selectedTriggerId = entry.id
  if (selected.value?.id === entry.id) {
    await closeDetail(previousStrip || targetStrip)
    return
  }
  const prepare = async () => {
    openPanels.value = { ...openPanels.value, [targetStrip]: entry }
    selected.value = entry
    await nextTick()
  }
  if (linked) {
    await revealDetailImmediately(() => detailPanel(targetStrip), prepare)
    return
  }
  // 手机或已有详情时：直接在顶部淡入；桌面首次展开：高度展开并滚动到位
  if (
    window.matchMedia('(max-width:700px)').matches ||
    (previousStrip && detailPanel(previousStrip))
  ) {
    await fadeDetailAtTop(
      () => detailPanel(targetStrip),
      async () => {
        openPanels.value = { [targetStrip]: entry }
        selected.value = entry
        await nextTick()
      },
    )
  } else {
    await transitionDetail({
      panel: () => detailPanel(targetStrip),
      anchor: () => findTrigger(entry.id),
      opening: true,
      scrollAfterOpen: true,
      render: prepare,
    })
  }
}
async function openSearchResult(entry: BuildEntry) {
  if (loading.value) return
  const currentStrip = selectedStrip.value
  if (currentStrip && openPanels.value[currentStrip]) {
    await replaceSearchResult(entry, currentStrip)
    return
  }
  // 只在激活候选时清除不兼容的职责筛选，输入过程中不清除。
  if (!findTrigger(entry.id)) {
    resetDetails()
    columnFilter.value = ''
    await nextTick()
  }
  const trigger = findTrigger(entry.id)
  if (!trigger) return
  if (selected.value?.id === entry.id) {
    await handoffDetail({
      previous: () => null,
      target: () => detailPanel(),
      sameRow: false,
      prepare: async () => {},
      finish: async () => {},
    })
  } else await selectEntry(entry, trigger)
}
function replaceSearchResult(entry: BuildEntry, key: string) {
  if (selected.value?.id !== entry.id)
    pushDetailHistory(buildDetailUrl(entry.championId, entry.role, selectedPatch.value))
  return replaceDetailEntry({
    entry,
    key,
    loading: loading.value,
    selected,
    openPanels,
    panel: () => detailPanel(key),
    transition: fadeDetailAtTop,
    beforeReplace: () => {
      initialRune.value = null
    },
    afterRender: nextTick,
  })
}
async function closeDetail(key = selectedStrip.value) {
  if (!key) return
  initialRune.value = null
  const closing = openPanels.value[key]
  if (!closing) return
  pushDetailHistory('/?page=heroes&patch=' + encodeURIComponent(selectedPatch.value))
  const id = closing.id
  const strip = strips.value.find(strip => strip.key === key)
  const anchorId =
    strip?.cells.flat().find(entry => entry.id === selectedTriggerId)?.id ||
    strip?.cells.flat()[0]?.id
  const trigger = anchorId ? findTrigger(anchorId) : null
  const finished = await transitionDetail({
    panel: () => detailPanel(key),
    anchor: () => trigger,
    opening: false,
    closeInset: (stickyHeader.value?.offsetHeight || 104) + 12,
    render: async () => {
      table.value?.fadeNextBands()
      const remaining = { ...openPanels.value }
      delete remaining[key]
      openPanels.value = remaining
      if (selected.value?.id === id) selected.value = Object.values(remaining).at(-1) || null
      await nextTick()
    },
  })
  await nextTick()
  table.value?.revealBands()
  if (finished) trigger?.focus({ preventScroll: true })
}
function resetDetails() {
  cancelDetailTransition()
  selected.value = null
  openPanels.value = {}
}
onUnmounted(cancelDetailTransition)

// ---- 职责列筛选 ----
const columnFilter = ref(savedView?.column || '')
onUnmounted(
  registerHistorySection('hero-board', () => ({
    query: query.value,
    mode: rankingMode.value,
    column: columnFilter.value,
    selectedId: selected.value?.id || null,
    anchorId: selectedTriggerId,
    stripKey: selectedStrip.value,
  })),
)
const columnReflow = createBoardReflow('.build-tile[data-champion-id]', 'data-champion-id', true)
onUnmounted(columnReflow.stop)
const scrollFloor = createBoardScrollFloor()
onUnmounted(scrollFloor.dispose)
async function toggleColumn(column: string) {
  const switching = !!columnFilter.value && columnFilter.value !== column
  const clearing = columnFilter.value === column
  const root = table.value?.header?.closest<HTMLElement>('.board-table') || null
  await scrollFloor.preserve(root, () =>
    columnReflow.run(
      root,
      async () => {
        table.value?.beginBandLayout()
        try {
          resetDetails()
          columnFilter.value = columnFilter.value === column ? '' : column
          selected.value = null
          await nextTick()
          measureFocusedColumns()
          await nextTick()
        } finally {
          table.value?.finishBandLayout()
        }
      },
      { columnVisual: true, revealNew: switching || clearing, enterOnly: switching },
    ),
  )
}

// ---- 表格布局：职责列、条带与胜率区间 ----
// ≤1024px 合并为三列；跨断点时清除筛选并尽量保持详情位置
const compact = useCompactBoard(
  () => detailPanel(),
  () => {
    columnFilter.value = ''
    const key = stripFor(
      boardEntries.value.find(entry => entry.id === selectedTriggerId) || selected.value,
    )
    openPanels.value = key && selected.value ? { [key]: selected.value } : {}
  },
  1024,
)
const displayColumns = computed(() => (compact.value ? compactColumns : columns))
const columnHeading = (column: string) =>
  column === 'AD输出' ? '射手' : column === 'AP输出' ? '法师' : column
const rows = computed(() => buildRows(boardEntries.value, '', columnFilter.value, compact.value))
// 筛选某一列后：选中列占满剩余宽度，其余列只保留表头图标的宽度
const focusedCardSize = ref(56)
const focusedWidths = ref<number[]>([]),
  focusedSlots = ref(1)
const focusedColumns = computed(
  () => !!columnFilter.value && focusedWidths.value.length === displayColumns.value.length,
)
const focusedGrid = computed(() =>
  focusedColumns.value
    ? (compact.value ? '32px' : 'var(--hero-axis-width)') +
      ' ' +
      displayColumns.value
        .map((column, i) =>
          column === columnFilter.value ? 'minmax(0,1fr)' : focusedWidths.value[i] + 'px',
        )
        .join(' ')
    : undefined,
)
const compactSlots = ref(2)
const strips = computed(() =>
  focusedColumns.value
    ? winRateStrips(
        rows.value,
        displayColumns.value.map(() => focusedSlots.value),
      )
    : compact.value
      ? winRateStrips(rows.value, [compactSlots.value, compactSlots.value, compactSlots.value])
      : buildStrips(rows.value, false),
)
const singlePortraitColumns = computed(() =>
  displayColumns.value.map((_, i) =>
    strips.value.every(strip => (strip.cells[i]?.length || 0) <= 1),
  ),
)
const selectedStrip = computed(() => openStripKey(openPanels.value, selected.value))
const gridRow = (key: string) => stripGridRow(strips.value, openPanels.value, key)
const rangeSections = computed(() => bandSections(strips.value, openPanels.value))
const unranked = computed(() => boardEntries.value.filter(e => e.lowSample))

const pct = (v: number) => (v * 100).toFixed(1) + '%'
const count = formatCount

// ---- 读取榜单 ----
let loadSerial = 0
async function load() {
  const serial = ++loadSerial
  void previous.load(selectedPatch.value)
  loading.value = true
  error.value = ''
  try {
    const board = await loadBuildBoard(selectedPatch.value)
    if (serial !== loadSerial) return
    // 请求完成后再读取选择与视口，尊重等待期间的滚动或关闭详情。
    const restoring = !!restoreSelection
    const previousHero = selected.value?.championId
    const previousPanelKey = Object.keys(openPanels.value)[0]
    const previousId = selected.value?.id || restoreSelection
    restoreSelection = undefined
    const animateVersionChange =
      !!data.value &&
      (data.value.meta.patch !== board.meta.patch ||
        data.value.meta.snapshotId !== board.meta.snapshotId) &&
      !previousId &&
      !pendingLink?.champion
    const applyBoard = async () => {
      const searchable = (entry: BuildEntry) => ({
        ...entry,
        searchTerms: championSearch[String(entry.championId)] || [],
      })
      data.value = {
        ...board,
        entries: board.entries.map(searchable),
        heroEntries: board.heroEntries?.map(searchable),
      }
      selected.value =
        [...boardEntries.value, ...data.value.entries].find(entry => entry.id === previousId) ||
        boardEntries.value.find(entry => entry.championId === previousHero) ||
        null
      const key =
        previousPanelKey &&
        selected.value &&
        strips.value.some(strip => strip.key === previousPanelKey)
          ? previousPanelKey
          : restoring &&
              savedView?.stripKey &&
              strips.value.some(strip => strip.key === savedView.stripKey)
            ? savedView.stripKey
            : stripFor(
                boardEntries.value.find(entry => entry.id === selectedTriggerId) || selected.value,
              )
      openPanels.value = key && selected.value ? { [key]: selected.value } : {}
      loading.value = false
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
    if (serial !== loadSerial) return
    if (pendingLink?.champion) await openPendingLink(serial, board.meta.patch)
  } catch (reason) {
    if (serial === loadSerial)
      error.value = reason instanceof Error ? reason.message : '榜单统计暂时无法读取，请重试。'
  } finally {
    if (serial === loadSerial) loading.value = false
  }
}
// 深链接（?champion=…&role=…&augment=…）：榜单就绪后直接展开对应详情
async function openPendingLink(serial: number, patch: string) {
  const link = pendingLink!
  const choices = championBuilds(data.value!.entries, link.champion!)
  const entry = choices.find(entry => entry.role === link.role) || choices[0]
  if (link.augment) {
    const runes = await loadRuneBoard(patch)
    if (serial !== loadSerial) return
    const rune = runes.entries.find(rune => rune.id === link.augment)
    if (rune) initialRune.value = { id: rune.id, name: rune.name, icon: rune.icon }
    else linkNotice.value = '该符文在当前版本暂无统计，已显示英雄详情。'
  }
  pendingLink = null
  if (entry) {
    await nextTick()
    await selectEntry(entry, findTrigger(entry.id), true)
  } else linkNotice.value = '该英雄在当前版本暂无可用流派统计。'
}

// ---- 筛选列宽度测量 ----
const table = ref<InstanceType<typeof WinRateTable> | null>(null)
const stickyHeader = computed(() => table.value?.header || null)
function measureFocusedColumns() {
  const header = table.value?.header
  if (!header) return
  compactSlots.value = compactHeroSlots(window.innerWidth)
  if (!columnFilter.value) return
  const labels = Array.from(header.querySelectorAll<HTMLElement>('.board-column-content'))
  if (labels.length !== displayColumns.value.length) return
  // 未选中的职责列只容纳图标与两侧12px留白，不由翻译文字决定宽度。
  const widths = labels.map(() => (compact.value ? 73 : 49))
  const axis = header.querySelector('.board-axis')?.getBoundingClientRect().width || 72
  const available =
    header.clientWidth -
    2 -
    axis -
    (compact.value
      ? 0
      : widths.reduce(
          (sum, width, i) => sum + (displayColumns.value[i] === columnFilter.value ? 0 : width),
          0,
        ))
  const gap = 6,
    inset = compact.value ? 9 : 25
  const cardSize = boardCardSize('hero', header.clientWidth, axis, compact.value)
  const slots = Math.max(1, Math.floor((available - inset + gap) / (cardSize + gap)))
  if (
    Math.abs(cardSize - focusedCardSize.value) < 0.01 &&
    slots === focusedSlots.value &&
    widths.every((width, i) => width === focusedWidths.value[i])
  )
    return
  void preserveDetailPosition(
    () => detailPanel(),
    async () => {
      focusedCardSize.value = cardSize
      focusedWidths.value = widths
      focusedSlots.value = slots
      const key = stripFor(
        boardEntries.value.find(entry => entry.id === selectedTriggerId) || selected.value,
      )
      openPanels.value = key && selected.value ? { [key]: selected.value } : {}
      await nextTick()
    },
  )
}
watch(
  [table, columnFilter, compact],
  async (_value, _old, onCleanup) => {
    const observer = new ResizeObserver(measureFocusedColumns)
    onCleanup(() => observer.disconnect())
    await nextTick()
    if (table.value?.header) observer.observe(table.value.header)
    measureFocusedColumns()
  },
  { flush: 'post' },
)

onMounted(load)
watch(selectedVersion, () => {
  cancelDetailTransition()
  void load()
})
</script>

<template>
  <section
    class="build-board hero-board"
    data-search-group="hero-board"
    :aria-label="t('英雄榜')"
    :aria-busy="loading"
  >
    <BoardNavSearch :query="query">
      <HeroSearch
        data-search-group="hero-board"
        v-model="query"
        :entries="boardEntries"
        :patch="data?.meta.patch || selectedPatch"
        :loading="loading"
        @select="openSearchResult"
      />
    </BoardNavSearch>
    <p v-if="loading && !data" class="board-message" role="status">
      {{ t('正在读取英雄流派统计……') }}
    </p>
    <div v-else-if="error && !data" class="board-message" role="alert">
      {{ t(error) }} <button class="board-retry" @click="load">{{ t('重新加载') }}</button>
    </div>
    <template v-else-if="data">
      <BoardBanner>
        <p v-if="linkNotice" class="board-message" role="status">{{ linkNotice }}</p>
        <div class="board-banner-controls">
          <BoardModeSwitch
            :model-value="rankingMode"
            :label="t('英雄榜统计方式')"
            :options="[
              { value: 'heroes' as const, label: '按英雄', disabled: !data.heroEntries },
              { value: 'roles' as const, label: '按最强流派' },
            ]"
            @update:model-value="setRankingMode"
          />
          <BoardUpdateNote
            v-if="data.meta.updatedAt"
            class="board-updated-corner board-updated-desktop"
            :updated-at="data.meta.updatedAt"
            :games="data.meta.games"
          />
        </div>
      </BoardBanner>
      <WinRateTable
        ref="table"
        :layout-revision="strips"
        :class="{ 'has-focused-column': focusedColumns }"
        :style="{
          '--focused-hero-columns': focusedGrid,
          '--focused-hero-slots': focusedSlots,
          '--focused-card-size': focusedCardSize + 'px',
        }"
        :label="t('按胜率区间与六种职责排列的英雄流派')"
        :columns="displayColumns"
        :row-count="strips.length + 1 + Object.keys(openPanels).length"
        :scroll-label="t('英雄流派榜')"
      >
        <template #column="{ column, index }"
          ><button
            class="board-column-filter"
            :aria-label="t(column)"
            :aria-pressed="columnFilter === column"
            :title="
              columnFilter === column
                ? t('再次点击显示全部职责')
                : message('筛选{p0}', { p0: t(column) })
            "
            @click="toggleColumn(column)"
          >
            <span class="board-column-content"
              ><span v-if="compact" class="board-role-pair" aria-hidden="true"
                ><span
                  v-for="icon in compactColumnGroups[index]!.icons"
                  :key="icon"
                  :class="'board-role-' + icon"
                  ><span class="board-role-icon"></span></span></span
              ><span v-else class="board-role-icon" aria-hidden="true"></span
              ><span class="board-column-name">{{ t(columnHeading(column)) }}</span></span
            >
          </button></template
        >
        <template #default>
          <!-- Stable strip parents keep portraits mounted while detail placement changes. -->
          <template v-for="(strip, index) in strips" :key="strip.key">
            <div
              class="board-row board-strip"
              :style="{ gridRow: gridRow(strip.key) }"
              :class="{
                'board-strip-first':
                  strip.index === 0 || (index > 0 && !!openPanels[strips[index - 1]!.key]),
                'board-strip-last': strip.last || !!openPanels[strip.key],
              }"
              role="row"
            >
              <div
                class="board-axis board-range"
                role="rowheader"
                :aria-label="
                  message('{p0}% 至小于 {p1}%，{p2}', {
                    p0: strip.lower,
                    p1: strip.upper,
                    p2: strip.upper === 100 ? t('含100%') : '',
                  })
                "
              ></div>
              <div
                v-for="(cell, i) in strip.cells"
                :key="displayColumns[i]"
                class="board-cell"
                :class="[
                  'board-role-' + i,
                  {
                    'is-focused-cell': displayColumns[i] === columnFilter,
                    'is-single-portrait-column': singlePortraitColumns[i],
                  },
                ]"
                role="cell"
                :aria-label="
                  message('{p0}，{p1} 个组合', { p0: t(displayColumns[i]), p1: cell.length })
                "
              >
                <DetailLink
                  v-for="entry in cell"
                  :href="buildDetailUrl(entry.championId, entry.role, data.meta.patch)"
                  :key="entry.id"
                  :data-build-id="entry.id"
                  :data-champion-id="entry.championId"
                  class="build-tile"
                  :aria-expanded="openPanels[strip.key]?.id === entry.id"
                  :aria-controls="
                    openPanels[strip.key]?.id === entry.id
                      ? 'inline-build-detail-' + strip.key
                      : undefined
                  "
                  @pointerdown="prefetchOnPress($event, entry)"
                  @activate="(event, trigger) => selectEntry(entry, trigger)"
                  :title="
                    message('{p0} · {p1} · {p2} · {p3} 场', {
                      p0: gameName('champions', entry.championId, data.meta.patch, entry.name),
                      p1: entry.role ? roleName(entry, data.meta.patch) : t('全部出场'),
                      p2: pct(entry.winRate),
                      p3: count(entry.games),
                    })
                  "
                  :aria-label="
                    message('{p0}，{p1}，{p2}平滑胜率 {p3}，{p4} 场，查看详情', {
                      p0: gameName('champions', entry.championId, data.meta.patch, entry.name),
                      p1: entry.role ? roleName(entry, data.meta.patch) : t('全部出场'),
                      p2: rankingMode === 'heroes' ? t('整体') : t('流派'),
                      p3: pct(entry.winRate),
                      p4: count(entry.games),
                    })
                  "
                >
                  <span v-near-portrait="entry.championId" class="build-portrait"
                    ><img
                      :src="entry.icon"
                      alt=""
                      loading="lazy"
                      decoding="async"
                      width="54"
                      height="54"
                      draggable="false"
                    /><span
                      v-if="rankingMode === 'heroes'"
                      class="build-hover-name"
                      aria-hidden="true"
                      >{{
                        gameName('champions', entry.championId, data.meta.patch, entry.name)
                      }}</span
                    ><span class="build-win" :style="{ color: winRateColor(entry.winRate) }"
                      >{{ pct(entry.winRate)
                      }}<span
                        v-if="heroTrends[entry.championId]"
                        class="hero-card-trend"
                        :style="{ color: heroTrends[entry.championId]!.color }"
                        :title="heroTrends[entry.championId]!.label"
                        :aria-label="heroTrends[entry.championId]!.label"
                        >{{ heroTrends[entry.championId]!.symbol }}</span
                      ></span
                    >
                    <Transition name="equipment-tag" appear
                      ><span
                        v-if="
                          rankingMode === 'roles' &&
                          entry.role &&
                          nearPortraits.has(entry.championId)
                        "
                        class="build-tag build-equipment-tag"
                        :title="roleName(entry, data.meta.patch)"
                        ><img
                          v-for="item in roleIcons(entry)"
                          :key="item.name"
                          :src="item.icon"
                          loading="lazy"
                          decoding="async"
                          :alt="
                            'id' in item
                              ? gameName('items', String(item.id), data.meta.patch, item.name)
                              : ''
                          "
                          width="24"
                          height="24"
                          @error="failedRoleIcons.add(item.icon)" /></span
                    ></Transition>
                  </span>
                </DetailLink>
              </div>
            </div>
            <div
              v-if="openPanels[strip.key]"
              :data-detail-strip="strip.key"
              class="board-detail-row"
              :style="{ gridRow: gridRow(strip.key) + 1 }"
              role="row"
            >
              <DetailEdges />
              <div role="cell" :aria-colspan="displayColumns.length + 1">
                <BuildDetail
                  :entry="openPanels[strip.key]!"
                  :entries="data.entries"
                  :patch="data.meta.patch"
                  :initial-rune="initialRune"
                  :panel-id="'inline-build-detail-' + strip.key"
                  @hero-select="replaceSearchResult($event, strip.key)"
                  @close="closeDetail(strip.key)"
                />
              </div>
            </div>
          </template>
          <WinRateBand
            v-for="section in rangeSections"
            :key="'range-' + section.key"
            :lower="section.lower"
            :upper="section.upper"
            :row="gridRow(section.key)"
            :span="section.strips.length"
            :stacked="compact"
          />
        </template>
        <template #empty>
          <p v-if="!rows.length" class="board-message" role="status">
            {{ t('当前') }}{{ columnFilter ? message('{p0}职责', { p0: columnFilter }) : t('版本')
            }}{{ t('暂无可展示的英雄流派。') }}
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
      <HeroBoardNotes :meta="data.meta" :ranking-mode="rankingMode" :unranked="unranked" />
    </template>
  </section>
</template>
