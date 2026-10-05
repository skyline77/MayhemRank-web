<script setup lang="ts">
import { t, message } from './i18n'
import { locale } from './locale'
import { gameName, gameTitle, roleName } from './gameLocalization'
import { rememberView } from './recentViews'
import { formatCount } from './formatCount'
import { winRateColor } from './winRateColor'

import DetailLink from './DetailLink.vue'
import { readHistorySection, registerHistorySection } from './pageHistory'
import DetailHeading from './DetailHeading.vue'
import DetailCategoryTabs from './DetailCategoryTabs.vue'
import DesktopCategoryBrowser from './DesktopCategoryBrowser.vue'
import DetailMethod from './DetailMethod.vue'
import { buildDetailUrl } from './detailLink'
import FilterableStatRow from './FilterableStatRow.vue'
import SummonerSpells from './SummonerSpells.vue'
import HeroRunePairs from './HeroRunePairs.vue'
import { useCompactBoard } from './useCompactBoard'
import RecentChanges from './RecentChanges.vue'
import HeroFilterControls from './HeroFilterControls.vue'
import { heroFilter, type HeroFilter, type HeroFilterAction, type RuneFilter } from './heroFilter'
import { loadHeroDetail, type HeroDetailPayload } from './heroCohorts'
import { usePatchAvailability } from './usePatchAvailability'
import { computed, onMounted, onUnmounted, provide, ref, watch, nextTick } from 'vue'
import { closeTip } from './tooltip'
import { championBuilds, type BuildEntry } from './buildBoard'
const props = withDefaults(
  defineProps<{
    entry: BuildEntry
    entries?: BuildEntry[]
    patch: string
    panelId?: string
    standalone?: boolean
    initialRune?: RuneFilter | null
  }>(),
  { panelId: 'inline-build-detail', entries: () => [], standalone: false },
)
watch(
  () => String(props.entry.championId),
  id => rememberView('hero', id),
  { immediate: true },
)
const panel = ref<HTMLElement | null>(null)
const locked = false
const compact = useCompactBoard(
  () => panel.value,
  () => {},
)
provide('detail-history-key', props.panelId)
const savedView = readHistorySection<{ role: string; filter?: HeroFilter; recent: boolean }>(
  'detail:' + props.panelId,
)
const filter = ref<HeroFilter>(
  props.initialRune
    ? { role: null, rune: props.initialRune }
    : savedView?.filter
      ? { role: savedView.filter.role, rune: savedView.filter.rune, item: savedView.filter.item }
      : { role: savedView?.role || props.entry.role, rune: null },
)
const showRecentChanges = ref(savedView?.recent || false)
const hasRecentChanges = usePatchAvailability(
  'champion',
  () => props.entry.championId,
  () => props.patch,
)
watch(hasRecentChanges, available => {
  if (available === false) showRecentChanges.value = false
})
onUnmounted(
  registerHistorySection('detail:' + props.panelId, () => ({
    filter: filter.value,
    recent: showRecentChanges.value,
  })),
)
const roles = computed(() =>
  championBuilds(props.entries.length ? props.entries : [props.entry], props.entry.championId),
)
const displayedRoles = roles
// The board portrait remains the expansion anchor when its cohort changes.
const entry = computed(
  () => roles.value.find(option => option.role === filter.value.role) || props.entry,
)
watch(
  () => [props.entry.championId, props.entry.id, props.patch],
  (next, previous) => {
    if (
      next[0] !== previous[0] ||
      next[2] !== previous[2] ||
      (next[1] !== previous[1] && props.entry.role !== filter.value.role)
    ) {
      filter.value = heroFilter(filter.value, { type: 'reset', role: props.entry.role })
    }
  },
)
const emit = defineEmits<{
  close: []
  select: [entry: BuildEntry]
  'hero-select': [entry: BuildEntry]
  'filter-change': [filter: HeroFilter]
}>()
function changeFilter(action: HeroFilterAction) {
  filter.value = heroFilter(filter.value, action)
  if (filter.value.role && filter.value.role !== 'other') emit('select', entry.value)
  emit('filter-change', filter.value)
}
provide('filter-hero-rune', (rune: RuneFilter) => changeFilter({ type: 'rune', rune }))
const allWinRate = ref<number | undefined>(),
  allGames = ref<number | undefined>()
watch(
  () => [props.entry.championId, props.patch, props.entry.snapshotId],
  async (_scope, _previous, onCleanup) => {
    let active = true
    onCleanup(() => {
      active = false
    })
    allWinRate.value = undefined
    allGames.value = undefined
    try {
      const all = await loadHeroDetail(props.entry, props.patch, { role: null, rune: null })
      if (active) {
        allWinRate.value = all.summary.winRate
        allGames.value = all.summary.games
      }
    } catch {
      /* Leave unavailable statistics blank. */
    }
  },
  { immediate: true },
)
const otherStats = ref<{ games: number; heroGames: number; winRate: number } | null>(null)
watch(
  () => [props.entry.championId, props.patch, props.entry.snapshotId],
  async (_scope, _previous, onCleanup) => {
    let active = true
    onCleanup(() => {
      active = false
    })
    otherStats.value = null
    const source = props.entry,
      patch = props.patch
    try {
      const other = await loadHeroDetail(source, patch, { role: 'other', rune: null })
      const heroGames =
        source.eligibleGames ??
        source.heroGames ??
        (await loadHeroDetail(source, patch, { role: null, rune: null })).summary.games
      if (active)
        otherStats.value = { games: other.summary.games, heroGames, winRate: other.summary.winRate }
    } catch {
      /* Keep unavailable statistics distinct from zero appearances. */
    }
  },
  { immediate: true },
)
const data = ref<HeroDetailPayload | null>(null)
const allSortData = ref<HeroDetailPayload | null>(null)
const loading = ref(true),
  error = ref('')
const appliedFilter = ref<HeroFilter>(filter.value)
const displayedFilter = computed(() => (data.value ? appliedFilter.value : filter.value))
const initialLoading = computed(() => loading.value && !data.value)
let requestId = 0
const groups = [
  { id: 'kPrismatic', name: '棱彩海克斯', label: '棱彩', css: 'prismatic' },
  { id: 'kGold', name: '黄金海克斯', label: '黄金', css: 'gold' },
  { id: 'kSilver', name: '白银海克斯', label: '白银', css: 'silver' },
  { id: 'items', name: '常见装备', label: '装备', css: 'items' },
]
const bootsGroup = { id: 'boots', name: '鞋子', label: '鞋子', css: 'items' }
const mobileTabs = [
  ...groups.slice(0, 3).map(group => ({ id: group.id, label: group.label, css: group.css })),
  { id: 'pairs', label: '组合', css: 'pairs' },
  ...groups.slice(3).map(group => ({ id: group.id, label: group.label, css: group.css })),
]
const detail = computed(() => data.value?.detail)
const summary = computed(() => data.value?.summary)
const headingRole = computed(() =>
  roles.value.find(role => role.role === displayedFilter.value.role),
)
const headingTitle = computed(() => {
  const title = gameTitle(entry.value.championId, props.patch, entry.value.name)
  if (!compact.value) return title
  if (!headingRole.value) return title + '－' + t('全部出场')
  const suffix = locale.value === 'en-US' ? ' build' : locale.value === 'ja-JP' ? 'ビルド' : '派'
  return title + '－' + roleName(headingRole.value, props.patch) + suffix
})
const headingName = ref<HTMLElement | null>(null)
let headingResize: ResizeObserver | undefined,
  headingFrame = 0
function fitHeading() {
  cancelAnimationFrame(headingFrame)
  headingFrame = requestAnimationFrame(() => {
    const el = headingName.value
    if (!el) return
    el.style.removeProperty('font-size')
    if (
      window.matchMedia('(max-width:700px)').matches &&
      el.clientWidth > 0 &&
      el.scrollWidth > el.clientWidth
    ) {
      el.style.fontSize =
        Math.max(12, Math.floor(((22 * el.clientWidth) / el.scrollWidth) * 10) / 10) + 'px'
    }
  })
}
onMounted(() => {
  headingResize = new ResizeObserver(fitHeading)
  if (headingName.value) headingResize.observe(headingName.value)
  fitHeading()
})
watch(headingTitle, async () => {
  await nextTick()
  fitHeading()
})
onUnmounted(() => {
  headingResize?.disconnect()
  cancelAnimationFrame(headingFrame)
})
const headingGames = computed(
  () =>
    summary.value?.games ??
    (!displayedFilter.value.role && !displayedFilter.value.rune && !displayedFilter.value.item
      ? allGames.value
      : undefined),
)
const baseline = computed(() => summary.value?.winRate ?? 0.5)
const spellScope = computed(() =>
  data.value ? { row: data.value.spells, meta: data.value.meta } : null,
)
const scopeName = computed(() => {
  const filter = displayedFilter.value
  if (filter.item)
    return message('终局持有「{p0}」的出场', {
      p0: gameName('items', filter.item.id, props.patch, filter.item.name),
    })
  if (filter.rune)
    return message('选择「{p0}」的出场', {
      p0: gameName('augments', filter.rune.id, props.patch, filter.rune.name),
    })
  if (filter.role === 'other') return t('未归类为任一流派的出场')
  const row = props.entries.find(
    row => row.championId === entry.value.championId && row.role === filter.role,
  )
  return filter.role
    ? message('「{p0}」流派', { p0: row ? roleName(row, props.patch) : t(filter.role) })
    : t('全部出场')
})
const tooltipContext = computed(() => {
  const filter = displayedFilter.value
  const isRoleScope = !!filter.role && filter.role !== 'other' && !filter.item && !filter.rune
  return isRoleScope
    ? scopeName.value
    : gameName('champions', entry.value.championId, props.patch, entry.value.name) +
        ' · ' +
        scopeName.value
})
const displayedPatch = computed(() => data.value?.meta.patch || props.patch)
const displayedGroups = computed(() => detail.value?.groups || {})
const pct = (v: number) => (v * 100).toFixed(1) + '%'
const count = formatCount
async function load() {
  const request = ++requestId
  const requestedFilter = filter.value
  // Keep the prior same-hero view until the new version arrives atomically.
  // This gives the shared content animation both the old and new values.
  if (data.value && data.value.championId !== entry.value.championId) data.value = null
  loading.value = true
  error.value = ''
  try {
    const [result, all] = await Promise.all([
      loadHeroDetail(entry.value, props.patch, requestedFilter),
      loadHeroDetail(entry.value, props.patch, { role: null, rune: null }),
    ])
    if (request !== requestId) return
    closeTip()
    allSortData.value = all
    data.value = result
    appliedFilter.value = requestedFilter
  } catch (e) {
    if (request === requestId) error.value = e instanceof Error ? e.message : '英雄详情暂时无法读取'
  } finally {
    if (request === requestId) loading.value = false
  }
}
function close() {
  if (!props.standalone) emit('close')
}
watch(
  () => [
    entry.value.championId,
    props.patch,
    entry.value.snapshotId,
    filter.value.role,
    filter.value.rune?.id,
    filter.value.item?.id,
  ],
  () => {
    closeTip()
    void load()
  },
  { immediate: true },
)
onUnmounted(() => {
  ++requestId
  closeTip()
})
</script>

<template>
  <section
    ref="panel"
    :id="panelId"
    class="build-detail hero-detail"
    role="region"
    :aria-labelledby="panelId + '-title'"
    :aria-busy="loading"
  >
    <DetailHeading sticky class="hero-detail-heading">
      <div class="hero-heading-identity">
        <DetailLink
          class="build-detail-portrait"
          :href="buildDetailUrl(entry.championId, entry.role, patch)"
          :aria-label="
            message('{p0}，英雄详情', {
              p0: gameName('champions', entry.championId, patch, entry.name),
            })
          "
          ><img :src="entry.icon" alt="" width="76" height="76" draggable="false"
        /></DetailLink>
        <h2 ref="headingName" class="hero-heading-name" :id="panelId + '-title'">
          {{ headingTitle }}
        </h2>
        <div class="hero-heading-win">
          {{ locale === 'en-US' ? 'WR: ' : t('胜率：')
          }}<strong :style="{ color: winRateColor(allWinRate) }">{{
            allWinRate === undefined ? '—' : pct(allWinRate)
          }}</strong>
        </div>
        <div class="hero-heading-games">
          <span
            ><template v-if="!compact">{{ locale === 'en-US' ? 'Total ' : t('共') }}</template
            >{{ headingGames === undefined ? '—' : count(headingGames)
            }}{{ locale === 'en-US' ? ' games' : t('场') }}</span
          ><span v-if="!compact" class="hero-heading-games-reserve" aria-hidden="true"
            >{{ locale === 'en-US' ? 'Total ' : t('共') }}000,000{{
              locale === 'en-US' ? ' games' : t('场')
            }}</span
          >
        </div>
      </div>
      <button
        v-if="!standalone"
        class="build-detail-close"
        :aria-label="t('关闭流派详情')"
        @click="close"
      >
        ×
      </button>
      <HeroFilterControls
        :selection-games="headingGames"
        :hero="{
          name: gameName('champions', entry.championId, patch, entry.name),
          icon: entry.icon,
          winRate: allWinRate,
          games: allGames,
        }"
        :other-stats="otherStats"
        :unformed-stats="
          props.entry.unformedGames === undefined
            ? null
            : { games: props.entry.unformedGames, total: props.entry.heroGames ?? 0 }
        "
        :selection-win-rate="summary?.winRate"
        :state="displayedFilter"
        :roles="displayedRoles"
        :patch="patch"
        @change="changeFilter"
      />
    </DetailHeading>
    <p v-if="error && data" class="detail-refresh-error" role="alert">
      {{ t(error) }}{{ t('；仍显示上次成功加载的统计。')
      }}<button class="board-retry" @click="load">{{ t('重试') }}</button>
    </p>
    <div class="build-detail-grid" :class="{ 'hero-mobile-grid': compact }">
      <span v-if="loading" class="detail-status" role="status">{{
        t('正在读取当前范围的统计……')
      }}</span>
      <p v-if="error && data" class="build-detail-message" role="alert">
        {{ t(error) }}{{ t('（仍显示更新前的数据）')
        }}<button class="board-retry" @click="load">{{ t('重试') }}</button>
      </p>
      <div v-if="error && !data" class="build-detail-message" role="alert">
        {{ t(error) }}<button class="board-retry" @click="load">{{ t('重试') }}</button>
      </div>
      <DetailCategoryTabs
        v-if="data || !error"
        :enabled="compact"
        :panel-id="panelId"
        :tabs="mobileTabs"
        :label="t('英雄统计分类')"
        v-slot="{ tab: contentTab, active }"
      >
        <DesktopCategoryBrowser
          :enabled="!compact"
          :groups="compact ? groups.filter(group => contentTab.id === group.id) : groups"
          :panel-id="panelId"
          v-slot="{ group, expanded, toggle, rowAttrs, tabMode }"
        >
          <FilterableStatRow
            :tab-mode="tabMode"
            v-bind="rowAttrs"
            :managed-expansion="!compact"
            :overlay-scrollbar="!compact"
            :floating-sort="compact && active"
            v-if="!compact || contentTab.id === group.id"
            :class="{ 'mobile-tab-row': compact }"
            :visual-family-reference="allSortData?.detail.groups[group.id] || []"
            :visual-family-sort="!compact && expanded && group.id !== 'items'"
            :expandable="!compact"
            :expanded="compact || expanded"
            @toggle-expand="toggle"
            :show-delta="!compact"
            :group="group"
            :cells="displayedGroups[group.id] || []"
            :loading="initialLoading"
            :locked="locked"
            query=""
            :patch="displayedPatch"
            :baseline="baseline"
            :context="tooltipContext"
            :selected-rune="displayedFilter.rune?.id"
            :selected-item="displayedFilter.item?.id"
            @rune="changeFilter({ type: 'rune', rune: $event })"
            @item="changeFilter({ type: 'item', item: $event })"
          />
        </DesktopCategoryBrowser>
        <div
          v-if="!compact"
          class="build-detail-paired"
          tabindex="0"
          :aria-label="t('召唤师技能与鞋子，可左右滚动查看')"
        >
          <SummonerSpells
            :show-delta="!compact"
            :locked="locked"
            :scope="spellScope"
            :loading="initialLoading"
            :patch="displayedPatch"
            :baseline="baseline"
          />
          <FilterableStatRow
            :show-delta="!compact"
            :group="bootsGroup"
            :cells="displayedGroups.boots || []"
            :loading="initialLoading"
            :locked="locked"
            query=""
            :patch="displayedPatch"
            :baseline="baseline"
            :context="tooltipContext"
          />
        </div>
        <HeroRunePairs
          :rune-cells="Object.values(allSortData?.detail.groups || {}).flat()"
          :search-index="null"
          :floating-sort="compact && active"
          :show-delta="!compact"
          v-if="!compact || contentTab.id === 'pairs'"
          :champion-id="entry.championId"
          :patch="patch"
          :snapshot-id="entry.snapshotId"
          :locked="locked"
          query=""
        />
      </DetailCategoryTabs>
    </div>
    <RecentChanges
      :id="panelId + '-patches'"
      v-model="showRecentChanges"
      :available="hasRecentChanges"
      kind="champion"
      :entity-id="entry.championId"
      :patch="patch"
    >
    </RecentChanges>
    <div v-if="initialLoading" class="build-detail-method-placeholder" aria-hidden="true"></div>
    <DetailMethod v-if="data && detail && summary && spellScope">
      <p>
        {{
          t(
            '海克斯组合：该英雄全部出场 · 不随筛选变化 · 仅展示超过 50 场的组合。Δ胜率对比全部出场；使用率以有海克斯记录的出场为分母。',
          )
        }}
      </p>
      <p v-if="props.entry.eligibleGames !== undefined">
        {{
          t(
            '流派统计只包含终局至少持有2件成装的出场；鞋子、出门装、重伤散件不计为成装。使用率分母为该英雄的',
          )
        }}{{ count(props.entry.eligibleGames)
        }}{{
          t('次达标出场；出装未成型单独显示，其比例以全部出场为分母。英雄整体胜率保留全部出场。')
        }}
      </p>
      <p
        v-if="
          (data.meta as { classificationMethod?: string }).classificationMethod ===
          'item-vote-seven-v1'
        "
      >
        {{
          t(
            '流派按七类装备投票划分，最高票并列时均分归属，因此流派场次和胜场可能为小数。不同流派可能共享同一份出场。按使用率从高到低保留流派，直到未展示流派合计不超过统计分母的5%；隐藏部分不计入未分类。',
          )
        }}
      </p>
      <p class="build-detail-intro">
        {{ t('除海克斯组合固定统计该英雄全部出场外，其余各行仅统计')
        }}{{ gameName('champions', entry.championId, patch, entry.name) }}{{ t('的') }}{{ scopeName
        }}{{
          t(
            '· 装备与鞋子展示使用率 >0.5% 的条目 · 各品质海克斯展示全部有记录条目。默认按使用率降序，可点击每行左侧切换排序；再次点击胜率切换升序／降序。符文按胜率排序时，50 场及以下的条目放在末尾。',
          )
        }}
      </p>
      <p>
        {{
          t(
            '流派、符文和装备筛选互斥，不叠加。全部出场、符文和装备条件统计包含未能归类流派的有效出场。符文条件要求此英雄选过该符文；装备条件要求终局持有该装备，均不限制流派。流派由终局装备划分，所有统计只描述历史关联，不代表因果收益。',
          )
        }}
      </p>
      <p>
        {{ t('当前范围原始胜率') }}{{ pct(summary.rawWinRate) }}，{{ count(summary.wins)
        }}{{ t('胜 /') }}{{ count(summary.games) }}{{ t('场。基准胜率') }}{{ pct(summary.winRate)
        }}{{ t('采用平滑估计。') }}
      </p>
      <p>
        {{ t('装备与鞋子使用率：终局持有该项的出场次数 ÷ 装备记录完整的')
        }}{{ count(detail.itemGames ?? detail.games) }}{{ t('次出场；缺失或无效装备记录')
        }}{{ count(detail.games - (detail.itemGames ?? detail.games))
        }}{{
          t(
            '次不计入此分母。“无鞋”仅统计终局未持有任何鞋子。海克斯使用率：选择该项的出场次数 ÷ 有已知海克斯记录的',
          )
        }}{{ count(detail.augmentGames) }}{{ t('次出场；缺失或没有已知符文的')
        }}{{ count(detail.games - detail.augmentGames)
        }}{{
          t(
            '次不计入此分母。同局同装备、同海克斯去重，各项使用率不要求合计 100%，不是出现后选择概率。',
          )
        }}
      </p>
      <p>
        {{
          t(
            '装备、海克斯及符文／装备筛选摘要统一使用当前版本该英雄全部出场的固定基准 b =（总胜场 + 1）÷（总场数 + 2），显示胜率 =（当前胜场 + 50 × b）÷（当前场数 + 50）。切换筛选只改变样本范围，不改变平滑基准。流派按钮仍采用榜单的 Beta(1,1) 口径。颜色和括号差值仍与当前筛选范围的胜率比较。相差不超过 1 个百分点为中性色，超过则逐渐变绿或变红，差异达到 6 个百分点时颜色最深；全站复用相同色阶。少于',
          )
        }}{{ data.meta.minimumGames }}{{ t('场以 * 标记。') }}
      </p>
      <p>
        {{ t('召唤师技能组合使用率：组合次数 ÷ 技能记录完整的')
        }}{{ count(spellScope.row.validGames) }}{{ t('次出场；缺失或无效')
        }}{{ count(spellScope.row.missingGames)
        }}{{
          t(
            '次，D/F 顺序合并。优先显示未取整使用率严格大于 0.5% 的组合，不足 3 组按使用率补足；有效组合不足 3 组则全部展示，不设上限。胜率为组合获胜次数 ÷ 组合出场次数，未平滑；悬停胜率可查看胜场和样本数。',
          )
        }}
      </p>
      <p>
        Mayhem queue {{ data.meta.queue }} · {{ data.meta.patch }} · {{ data.meta.region }} ·
        {{ data.meta.source }}。{{ data.meta.from.slice(0, 10) }} —
        {{ data.meta.cutoff.slice(0, 10)
        }}{{
          t(
            'UTC，与榜单使用同一代快照及对局范围。流派按钮的出场率 = 该流派场次 ÷ 同版本该英雄全部有效出场次数（含未分类出场），各流派出场率之和可能小于 100%；流派胜率仍只统计该流派。',
          )
        }}
      </p>
    </DetailMethod>
  </section>
</template>
<style scoped>
.hero-heading-identity {
  display: contents;
}
.hero-heading-win,
.hero-heading-games {
  display: none;
}
@media (min-width: 701px) {
  .hero-detail .hero-detail-heading {
    grid-template-columns: auto minmax(0, 1fr) auto;
    grid-template-rows: auto;
    gap: 12px;
    padding-right: 0;
    align-items: end;
  }
  .hero-detail-heading .hero-heading-identity {
    display: grid;
    grid-template-columns: 76px auto;
    grid-template-rows: auto auto auto;
    gap: 3px 12px;
    align-items: center;
  }
  .hero-detail-heading .hero-heading-identity .build-detail-portrait {
    grid-column: 1;
    grid-row: 1 / 4;
    align-self: end;
  }
  .hero-detail-heading .hero-heading-identity .hero-heading-name {
    grid-column: 2;
    grid-row: 1;
    margin: 0;
    padding: 0;
    font-size: 20px;
    white-space: nowrap;
  }
  .hero-heading-win,
  .hero-heading-games {
    display: block;
    grid-column: 2;
    color: var(--muted);
    font-size: 13px;
    line-height: 20px;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .hero-heading-win {
    grid-row: 2;
  }
  .hero-heading-win strong {
    color: var(--text);
    font-weight: 600;
  }
  .hero-heading-games {
    display: grid;
    grid-row: 3;
  }
  .hero-heading-games > span {
    grid-area: 1 / 1;
  }
  .hero-heading-games-reserve {
    visibility: hidden;
    pointer-events: none;
  }
  .hero-detail-heading .hero-filter-controls {
    grid-column: 2;
    grid-row: 1;
    align-self: end;
    margin-left: 20px;
  }
  .build-detail.hero-detail .hero-detail-heading .build-detail-close {
    position: static;
    grid-column: 3;
    grid-row: 1;
    align-self: end;
    margin: 0 0 calc(var(--detail-rail-width) - 40px);
  }
}
@media (min-width: 701px) and (max-width: 1100px) {
  .hero-detail .hero-detail-heading {
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 8px;
  }
}

.hero-detail {
  --detail-rail-width: 76px;
}
@media (min-width: 701px) {
  .hero-detail {
    --detail-inline-padding: 16px;
    padding-inline: 16px;
  }
  .hero-detail :deep(.hero-rune-pairs) {
    grid-template-columns: var(--detail-rail-width) minmax(0, 1fr);
    column-gap: 14px;
  }
  .hero-detail :deep(.build-detail-paired) {
    grid-template-columns:
      calc(6 * (var(--detail-card-width) + var(--detail-card-gap)) + 6px)
      minmax(calc(var(--detail-rail-width) + 8px + var(--detail-card-width)), 1fr);
  }
  .hero-detail :deep(.build-detail-paired > .build-detail-row) {
    padding-top: 20px;
    padding-bottom: 0;
  }
  .hero-detail :deep(.build-detail-paired > .spells) {
    column-gap: 14px;
    width: min(
      100%,
      calc(
        var(--detail-rail-width) + 14px + 4.7 * var(--detail-card-width) + 4 *
          var(--detail-card-gap)
      )
    );
  }
}
.hero-detail-heading .build-detail-portrait {
  border: 0;
  outline: 1px solid var(--border);
  outline-offset: -1px;
}
.hero-detail-heading .hero-heading-name {
  padding-left: 5px;
  font-size: 20px;
}
.hero-filter-controls :deep(.role-choice) {
  padding-inline: 10px;
  justify-content: flex-start;
}
.build-detail-grid :deep(.build-detail-row.prismatic) {
  padding-top: 20px;
}
.build-detail-grid :deep(.build-stat-name) {
  font-size: 12px;
  line-height: 14px;
}

.detail-refresh-error {
  margin: 8px 0;
  color: var(--muted);
  font-size: 12px;
}
.hero-detail-heading {
  display: grid;
  grid-template-columns: var(--detail-rail-width) minmax(0, 1fr) minmax(
      240px,
      var(--hero-detail-actions-width)
    );
  grid-template-rows: auto auto auto;
  gap: 6px 8px;
  align-items: center;
}
.hero-detail-heading .build-detail-portrait {
  grid-column: 1;
  grid-row: 1 / 3;
  align-self: end;
}
.hero-heading-name {
  grid-column: 2 / -1;
  grid-row: 1;
  padding-right: 48px;
  min-width: 0;
}
.hero-detail-heading h2 .hero-name-separator {
  font: inherit;
  color: inherit;
}
.hero-detail-name {
  font-weight: 700;
}
.build-detail .hero-detail-heading .build-detail-close {
  position: static;
  grid-column: 3;
  grid-row: 1;
  justify-self: end;
  align-self: start;
  margin: 0;
}
.hero-filter-controls {
  grid-column: 2;
  grid-row: 2;
  min-width: 0;
  align-self: end;
}
.hero-filter-controls :deep(.build-role-picker) {
  padding-bottom: 0;
}
.hero-filter-controls :deep(.filter-choice) {
  min-height: 40px;
}
@media (max-width: 700px) {
  .hero-detail-heading .build-detail-portrait {
    display: none;
  }
  .hero-detail :deep([data-detail-patches]) {
    margin-inline: 20px;
  }
  .hero-mobile-grid {
    display: block;
  }
  .hero-detail-heading {
    grid-template-columns: 12px minmax(0, 1fr) 36px;
    grid-template-rows: auto auto;
    gap: 4px 8px;
    padding-bottom: 0;
  }
  .build-detail .hero-detail-heading:has(.build-detail-close) {
    padding-right: 0;
  }
  .hero-detail-heading .hero-heading-name {
    grid-column: 2;
    grid-row: 1;
    padding: 0;
    font-size: 22px;
    line-height: 1.4;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .hero-detail-heading .hero-heading-games {
    display: none;
  }
  .build-detail .hero-detail-heading .build-detail-close {
    position: static;
    grid-column: 3;
    grid-row: 1;
  }
  .hero-detail-heading .hero-filter-controls {
    grid-column: 1 / -1;
    grid-row: 2;
    margin: 4px var(--mobile-card-inset, 20px) 0;
  }
  .hero-order-lock,
  .hero-cohort-summary {
    display: none;
  }
}
</style>
