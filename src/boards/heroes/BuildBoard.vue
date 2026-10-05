<script setup lang="ts">
import { useNearViewport } from '@/shared/useNearViewport'
import { locale, brands } from '@/i18n/locale'
import { t, message } from '@/i18n/i18n'
import { gameName, roleName } from '@/i18n/gameLocalization'
import DetailEdges from '@/details/DetailEdges.vue'
import { createBoardScrollFloor } from '@/boards/boardScrollFloor'
import { loadTooltipCatalogue } from '@/data/tooltipData'
import { formatCount } from '@/stats/formatCount'

import { previousRunePatch, runeCardTrend } from '@/boards/augments/runeComparison'
import { rankHeroes } from './heroRanking'
import heroDisplayRoles from '@/generated/heroDisplayRoles.json'
import BoardBanner from '@/boards/BoardBanner.vue'
import BoardModeSwitch from '@/boards/BoardModeSwitch.vue'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  fadeDetailAtTop,
  replaceDetailEntry,
  revealDetailImmediately,
  transitionDetail,
  handoffDetail,
  cancelDetailTransition,
  preserveDetailPosition,
} from '@/details/detailScroll'
import WinRateTable from '@/boards/WinRateTable.vue'
import { winRateStrips } from '@/boards/winRateTable'
import { createBoardReflow } from '@/boards/boardReflow'
import { boardCardSize, compactHeroSlots } from '@/boards/boardCardSize'
import { readHistorySection, registerHistorySection, pushDetailHistory } from '@/app/pageHistory'
import { useCompactBoard } from '@/boards/useCompactBoard'
import WinRateBand from '@/boards/WinRateBand.vue'
import DetailLink from '@/details/DetailLink.vue'
import { buildDetailUrl, boardLink } from '@/app/detailLink'
import { loadRuneBoard } from '@/boards/augments/augmentBoard'
import type { RuneFilter } from '@/details/hero/heroFilter'
import BuildDetail from '@/details/hero/BuildDetail.vue'
import HeroSearch from './HeroSearch.vue'
import BoardNavSearch from '@/navigation/BoardNavSearch.vue'
import { selectedPatch, selectedVersion, updateDate, loadVersions } from '@/data/versions'
import championSearch from '@/data/championSearch'
import { winRateColor } from '@/stats/winRateColor'
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
const data = ref<{ meta: BoardMeta; entries: BuildEntry[]; heroEntries?: BuildEntry[] } | null>(
  null,
)
const previousHeroes = ref<BuildEntry[]>([]),
  previousFor = ref('')
const heroTrends = computed(() => {
  const trends: Record<number, ReturnType<typeof runeCardTrend>> = {}
  if (rankingMode.value !== 'heroes' || !data.value || previousFor.value !== data.value.meta.patch)
    return trends
  const rates = new Map(previousHeroes.value.map(hero => [hero.championId, hero.winRate]))
  for (const hero of data.value.heroEntries || []) {
    const trend = runeCardTrend(hero.winRate, rates.get(hero.championId))
    if (trend?.tone.startsWith('up')) trends[hero.championId] = trend
  }
  return trends
})
async function loadPreviousHeroes(patch: string, serial: number) {
  try {
    const versions = await loadVersions(),
      previous = previousRunePatch(
        patch,
        versions.patches.map(row => row.patch),
      )
    if (!previous) return
    const board = await loadBuildBoard(previous)
    if (serial === loadSerial) {
      previousHeroes.value = board.heroEntries || []
      previousFor.value = patch
    }
  } catch {
    /* No indicator without a comparable previous snapshot. */
  }
}
const roleIconNames = ref<Record<string, string>>({})
const failedRoleIcons = ref(new Set<string>())
watch(
  selectedPatch,
  async (patch, _previous, onCleanup) => {
    let active = true
    onCleanup(() => {
      active = false
    })
    roleIconNames.value = {}
    failedRoleIcons.value = new Set()
    if (!patch.trim()) return
    try {
      const catalogue = await loadTooltipCatalogue(patch)
      if (active) {
        const names: Record<string, string> = {}
        // Base item IDs precede same-name variants from other game modes.
        // Keep the base icon instead of overwriting it with the last variant.
        for (const [id, item] of Object.entries(catalogue.items).sort(
          ([a], [b]) => Number(a) - Number(b),
        )) {
          if (!names[item.name]) names[item.name] = `/snapshot-assets/${patch}/items-${id}.png`
        }
        roleIconNames.value = names
      }
    } catch {
      /* Portrait and accessible role name remain available if metadata fails. */
    }
  },
  { immediate: true },
)
function roleIcons(entry: BuildEntry) {
  if (entry.nameItems) return entry.nameItems.filter(item => !failedRoleIcons.value.has(item.icon))
  const label = entry.label
  return label
    .split('＋')
    .map(name => ({ name, icon: roleIconNames.value[name] }))
    .filter(item => item.icon && !failedRoleIcons.value.has(item.icon))
}
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
const rankingModeStorageKey = 'team-site.hero-ranking-mode'
function readRankingMode() {
  try {
    return localStorage.getItem(rankingModeStorageKey) === 'roles' ? 'roles' : 'heroes'
  } catch {
    return 'heroes'
  }
}
const rankingMode = ref(
  savedView?.mode === 'heroes'
    ? 'heroes'
    : savedView?.mode === 'roles'
      ? 'roles'
      : readRankingMode(),
)
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
  try {
    localStorage.setItem(rankingModeStorageKey, rankingMode.value)
  } catch {
    /* Keep switching available when browser storage is blocked. */
  }
}
const query = ref(savedView?.query || ''),
  error = ref(''),
  loading = ref(false)
const selected = ref<BuildEntry | null>(null)
watch(
  [() => selected.value, locale],
  () => {
    document.title =
      brands[locale.value] +
      ' - ' +
      (selected.value
        ? gameName('champions', selected.value.championId, selectedPatch.value, selected.value.name)
        : t('英雄榜'))
  },
  { immediate: true },
)
const openPanels = ref<Record<string, BuildEntry>>({})
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
function stripFor(entry: BuildEntry | null) {
  return entry
    ? strips.value.find(strip => strip.cells.some(cell => cell.some(item => item.id === entry.id)))
        ?.key || null
    : null
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
  // Clear an incompatible role filter only on activation, never while typing.
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
const selectedStrip = computed(
  () =>
    Object.keys(openPanels.value).find(key => openPanels.value[key]?.id === selected.value?.id) ||
    null,
)
const stripGridRow = (key: string) => {
  const index = strips.value.findIndex(strip => strip.key === key)
  return (
    index + 1 + strips.value.slice(0, index).filter(strip => openPanels.value[strip.key]).length
  )
}
// Center each range over its portrait strips; an expanded detail splits the band.
const rangeSections = computed(() => {
  const sections: {
    key: string
    lower: number
    upper: number
    strips: ReturnType<typeof buildStrips>
    detail: boolean
  }[] = []
  let section: (typeof sections)[number] | undefined
  for (const strip of strips.value) {
    if (!section)
      section = {
        key: strip.key,
        lower: strip.lower,
        upper: strip.upper,
        strips: [],
        detail: false,
      }
    section.strips.push(strip)
    if (strip.last || openPanels.value[strip.key]) {
      section.detail = !!openPanels.value[strip.key]
      sections.push(section)
      section = undefined
    }
  }
  return sections
})
const unranked = computed(() => boardEntries.value.filter(e => e.lowSample))

const pct = (v: number) => (v * 100).toFixed(1) + '%'
const count = formatCount
const day = (v: string) => v.slice(0, 10)
let loadSerial = 0
async function load() {
  const serial = ++loadSerial
  previousHeroes.value = []
  previousFor.value = ''
  void loadPreviousHeroes(selectedPatch.value, serial)
  loading.value = true
  error.value = ''
  try {
    const board = await loadBuildBoard(selectedPatch.value)
    if (serial !== loadSerial) return
    // Read selection and viewport after the request, so scrolling or closing
    // a detail while the network is pending is respected.
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
    if (pendingLink?.champion) {
      const link = pendingLink
      const choices = championBuilds(data.value!.entries, link.champion!)
      const entry = choices.find(entry => entry.role === link.role) || choices[0]
      if (link.augment) {
        const runes = await loadRuneBoard(board.meta.patch)
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
  } catch (reason) {
    if (serial === loadSerial)
      error.value = reason instanceof Error ? reason.message : '榜单统计暂时无法读取，请重试。'
  } finally {
    if (serial === loadSerial) loading.value = false
  }
}
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
          <p
            v-if="data.meta.updatedAt"
            class="board-updated board-updated-corner board-updated-desktop"
          >
            {{ t('数据更新于') }}{{ updateDate(data.meta.updatedAt) }}{{ t('，共')
            }}{{ count(data.meta.games) }}{{ t('场。') }}
          </p>
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
              :style="{ gridRow: stripGridRow(strip.key) }"
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
              :style="{ gridRow: stripGridRow(strip.key) + 1 }"
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
            :row="stripGridRow(section.key)"
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
      <p v-if="data.meta.updatedAt" class="board-updated board-updated-mobile">
        {{ t('数据更新于') }}{{ updateDate(data.meta.updatedAt) }}{{ t('，共')
        }}{{ count(data.meta.games) }}{{ t('场。') }}
      </p>
      <p v-if="error" class="board-message" role="alert">
        {{ t(error) }} <button class="board-retry" @click="load">{{ t('重新加载') }}</button>
      </p>
      <details class="board-method">
        <summary>{{ t('数据范围与胜率说明') }}</summary>
        <p>
          Mayhem · queue {{ data.meta.queue }} · {{ data.meta.patch }} ·
          {{ t(data.meta.region) }}。{{ data.meta.source }}{{ t('，共') }}{{ count(data.meta.games)
          }}{{ t('场对局、') }}{{ count(data.meta.appearances) }}{{ t('个可分类英雄样本；')
          }}{{ day(data.meta.from) }}{{ t('至') }}{{ day(data.meta.cutoff) }}（UTC）。
        </p>
        <p v-if="rankingMode === 'heroes'">
          {{
            t(
              '每个英雄只显示一次，按全部有效出场的整体胜率分档，包含未能分类的出场。职责列按该英雄出场最多的职责决定（同列流派合并场次），仅决定展示位置，不筛选统计样本。胜率与英雄详情的“全部出场”一致，沿用固定英雄基准的 Beta(50) 平滑。至少',
            )
          }}{{ data.meta.minimumGames }}{{ t('场才进入分档。') }}
        </p>
        <p v-else>
          {{
            t(
              '每张头像代表一个英雄的具体流派。职责列仅合并展示位置，保留原有流派的胜场和样本；例如近战暴击属于 AD 输出。流派按终局装备与既有分类划分，描述历史关联，不能解释为选择该出装带来的因果收益。',
            )
          }}
        </p>
        <p v-if="rankingMode === 'roles'">
          {{ t('流派胜率采用中性 Beta(1,1) 平滑，并列归类按归属权重计算有效样本量。至少')
          }}{{ data.meta.minimumGames
          }}{{
            t(
              '场才进入胜率分档；分档使用未四舍五入的值，下界包含、上界不包含。同格按平滑胜率降序，持平时参考样本数。',
            )
          }}
        </p>
        <p v-if="data.meta.classification">
          {{ data.meta.classification }}{{ t('。无法归类的出场（含旧口径特征不足）')
          }}{{
            count(
              (data.meta.exclusions.unclassified_inventory || 0) +
                (data.meta.exclusions.fewer_than_two_top10_completed_items || 0),
            )
          }}{{ t('人次，未知英雄') }}{{ count(data.meta.exclusions.unknown_champion || 0)
          }}{{ t('人次，不归入具体流派，达到2件成装门槛的未分类出场仍计入流派使用率的分母。') }}
        </p>
        <p>
          {{
            t(
              '两种口径均按使用率从高到低保留流派，直到未展示流派合计不超过流派统计分母的 5%；未分类单独统计。流派统计要求终局至少2件成装；流派出场率 = 该流派场次 ÷ 同版本该英雄至少2件成装的出场次数，各流派比例之和可能小于 100%。隐藏流派保留原始统计，不重新分配比例，也不计入未分类。不足2件成装的',
            )
          }}{{ count(data.meta.exclusions.fewer_than_two_completed_items || 0)
          }}{{ t('人次单列为出装未成型；缺失装备的')
          }}{{ count(data.meta.exclusions.missing_inventory || 0)
          }}{{ t('人次也不进入流派分母。英雄整体统计仍保留全部有效出场。') }}
        </p>
        <p>
          {{
            t('当前队伍只用于显示客户端阵容；队伍头像与榜单头像使用相同版本、相同流派的历史统计。')
          }}
        </p>
      </details>
      <p v-if="unranked.length" class="board-footnote">
        {{ t('样本不足，暂不分档：')
        }}<span v-for="entry in unranked" :key="entry.id"
          >{{ gameName('champions', entry.championId, data.meta.patch, entry.name) }} ·
          {{ roleName(entry, data.meta.patch) }}（{{ formatCount(entry.games)
          }}{{ t('场）') }}</span
        >
      </p>
      <footer class="board-footer">
        <span>{{
          message('数据地区：{region} · 版本 {patch} · 队列 {queue}', {
            region: t(data.meta.region) || t('地区无法核验'),
            patch: data.meta.patch,
            queue: data.meta.queue,
          })
        }}</span
        ><span
          >Mayhem · 2400 · {{ data.meta.patch }} · {{ count(data.meta.games) }}{{ t('场') }}</span
        ><span
          >{{ day(data.meta.from) }} — {{ day(data.meta.cutoff)
          }}{{ t('UTC · 地区无法核验') }}</span
        ><span>{{
          rankingMode === 'heroes' ? t('点击头像查看英雄全部出场详情') : t('点击头像查看该流派详情')
        }}</span>
      </footer>
    </template>
  </section>
</template>
