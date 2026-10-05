<script setup lang="ts">
import { t, message } from '@/i18n/i18n'
import { locale } from '@/i18n/locale'
import { gameName } from '@/i18n/gameLocalization'
import { rememberView } from '@/app/recentViews'
import { formatCount } from '@/stats/formatCount'

import DetailCategoryTabs from '@/details/DetailCategoryTabs.vue'
import { useCompactBoard } from '@/boards/useCompactBoard'
import SearchBox from '@/search/SearchBox.vue'
import { loadDetailSearch, type DetailSearchIndex } from '@/details/detailSearch'
import { closeTip } from '@/tooltip/tooltip'
import DetailHeading from '@/details/DetailHeading.vue'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { augmentIcon, needsGoldTint } from '@/data/augmentIcons'
import { loadRuneBoard, type RuneEntry } from '@/boards/augments/augmentBoard'
import { loadVersions } from '@/data/versions'
import { winRateColor } from '@/stats/winRateColor'
import { previousRunePatch, runePatchChange } from '@/boards/augments/runeComparison'
import {
  loadRuneDescriptions,
  matchingRuneTranslation,
  type RuneDescriptionCatalogue,
} from './runeDescriptions'
import RuneDescriptionPanel from './RuneDescriptionPanel.vue'
import RunePickChart from './RunePickChart.vue'
import RuneHeroes from './RuneHeroes.vue'
import RuneSynergies from './RuneSynergies.vue'
import { RUNE_SYNERGY_MIN_GAMES, type RuneSynergies as SynergyPayload } from './runeSynergies'
import { showRuneHeroChart } from './runeFeatures'
import { RUNE_HERO_MIN_GAMES, type RuneHeroes as RuneHeroesPayload } from './runeHeroes'
import { runeChartPoints, runeChartTotal } from './runeChart'
import RecentChanges from '@/details/RecentChanges.vue'
import DetailMethod from '@/details/DetailMethod.vue'
import { usePatchAvailability } from '@/data/usePatchAvailability'
import DetailSection from '@/details/DetailSection.vue'
import type { DescriptionMode } from './runeDescriptionPreference'
import { loadDescription, type DescriptionEntry } from '@/data/tooltipData'
const props = defineProps<{
  entry: RuneEntry
  patch: string
  panelId: string
  standalone?: boolean
}>()
watch(
  () => props.entry.id,
  id => rememberView('rune', id),
  { immediate: true },
)
const panel = ref<HTMLElement | null>(null)
const compact = useCompactBoard(
  () => panel.value,
  () => {},
)
const mobileTabs = [
  { id: 'heroes', label: '英雄' },
  { id: 'augments', label: '符文' },
  { id: 'items', label: '装备' },
]
const emit = defineEmits<{ close: [] }>()
const query = ref(''),
  searchIndex = ref<DetailSearchIndex | null>(null),
  searchError = ref('')
watch(
  () => props.entry.id,
  () => {
    query.value = ''
  },
)
watch(query, closeTip)
watch(
  compact,
  value => {
    if (value) query.value = ''
  },
  { immediate: true },
)
watch(
  () => props.patch,
  async (patch, _, onCleanup) => {
    let stale = false
    onCleanup(() => {
      stale = true
    })
    searchIndex.value = null
    searchError.value = ''
    try {
      const index = await loadDetailSearch(patch)
      if (!stale) searchIndex.value = index
    } catch {
      if (!stale) searchError.value = '符文和装备拼音搜索暂时不可用，仍可按中文名称搜索。'
    }
  },
  { immediate: true },
)
const linkedDescription =
  location.hash === '#rune-description' &&
  new URLSearchParams(location.search).get('rune') === props.entry.id
const heroMeta = ref<RuneHeroesPayload['meta'] | null>(null)
const synergyMeta = ref<SynergyPayload['meta'] | null>(null)
watch(
  () => [props.patch, props.entry.id, props.entry.snapshotId],
  () => {
    synergyMeta.value = null
  },
)
const hasRecentChanges = usePatchAvailability(
  'rune',
  () => props.entry.id,
  () => props.patch,
)
const recentChangesOverride = ref<boolean | null>(null)
const showRecentChanges = computed({
  get: () =>
    hasRecentChanges.value === false
      ? false
      : (recentChangesOverride.value ?? hasRecentChanges.value === true),
  set: (value: boolean) => {
    recentChangesOverride.value = value
  },
})
watch(
  () => [props.patch, props.entry.id],
  () => {
    recentChangesOverride.value = null
  },
)
const previous = ref<RuneEntry | null>(null)
const comparisonPatch = ref('')
watch(
  () => [props.patch, props.entry.id],
  async (_, __, onCleanup) => {
    let stale = false
    onCleanup(() => {
      stale = true
    })
    previous.value = null
    comparisonPatch.value = ''
    try {
      const manifest = await loadVersions()
      const patch = previousRunePatch(
        props.patch,
        manifest.patches.map(p => p.patch),
      )
      if (!patch) return
      const board = await loadRuneBoard(patch)
      if (!stale) {
        comparisonPatch.value = patch
        previous.value = board.entries.find(e => e.id === props.entry.id) || null
      }
    } catch {
      /* Keep the comparison hidden when the previous snapshot is unavailable. */
    }
  },
  { immediate: true },
)
const change = computed(() =>
  previous.value ? runePatchChange(props.entry.winRate, previous.value.winRate) : null,
)
const rateColor = computed(() => winRateColor(props.entry.winRate))
const descriptions = ref<RuneDescriptionCatalogue | null>(null)
const descriptionError = ref('')
const wikiLoading = ref(false)
const translations = ref<RuneDescriptionCatalogue | null>(null)
const translationLoading = ref(false)
const translationError = ref('')
async function readTranslations() {
  if (translations.value || translationLoading.value) return
  translationLoading.value = true
  translationError.value = ''
  try {
    translations.value = await loadRuneDescriptions('zh_CN')
  } catch {
    translationError.value = 'Wiki 中文译文暂时无法读取。'
  } finally {
    translationLoading.value = false
  }
}
const simple = ref<DescriptionEntry | null>(null)
const simpleLoading = ref(false)
const simpleError = ref('')
let simpleRequest = 0
async function readSimple() {
  const request = ++simpleRequest
  simple.value = null
  simpleError.value = ''
  simpleLoading.value = true
  try {
    const result = await loadDescription(props.patch, 'augments', props.entry.id)
    if (request === simpleRequest) simple.value = result
  } catch {
    if (request === simpleRequest) simpleError.value = '中文说明暂时无法读取。'
  } finally {
    if (request === simpleRequest) simpleLoading.value = false
  }
}
watch(() => [props.patch, props.entry.id], readSimple, { immediate: true })
function retryDescription(mode: DescriptionMode) {
  if (mode === 'simple') {
    void readSimple()
    return
  }
  if (mode === 'wiki' || descriptionError.value) void readDescriptions()
  if (mode === 'translation') void readTranslations()
}
const description = computed(() => descriptions.value?.entries[props.entry.id])
const translation = computed(() =>
  matchingRuneTranslation(description.value, translations.value?.entries[props.entry.id]),
)
const sourceUrl = computed(
  () =>
    (descriptions.value?.source.url ||
      'https://wiki.leagueoflegends.com/en-us/ARAM:_Mayhem/Augments') +
    (description.value ? '#' + encodeURIComponent(description.value.anchor) : ''),
)
async function readDescriptions() {
  descriptionError.value = ''
  wikiLoading.value = true
  try {
    descriptions.value = await loadRuneDescriptions()
  } catch {
    descriptionError.value = '英文说明暂时无法读取。'
  } finally {
    wikiLoading.value = false
  }
}
onMounted(readDescriptions)
const points = computed(() => runeChartPoints(props.entry.slots || []))
const observed = computed(() => runeChartTotal(points.value))
const count = formatCount
const pct = (n: number | null) => (n === null ? '—' : (n * 100).toFixed(1) + '%')

const headingName = ref<HTMLElement | null>(null)
const headingText = computed(() =>
  gameName('augments', props.entry.id, props.patch, props.entry.name),
)
const englishGap = computed(() => (locale.value === 'en-US' ? ' ' : ''))
let headingObserver: ResizeObserver | undefined,
  headingFrame = 0
function fitRuneHeading() {
  cancelAnimationFrame(headingFrame)
  headingFrame = requestAnimationFrame(() => {
    const el = headingName.value
    if (!el || !el.clientWidth) return
    el.style.removeProperty('font-size')
    let size = parseFloat(getComputedStyle(el).fontSize)
    // 按实际换行测量，不截断任何语言的完整符文名。
    while (
      size > 1 &&
      (el.scrollHeight > parseFloat(getComputedStyle(el).lineHeight) * 2 + 1 ||
        el.scrollWidth > el.clientWidth + 1)
    ) {
      size = Math.max(1, size - 0.5)
      el.style.fontSize = size + 'px'
    }
  })
}
onMounted(() => {
  headingObserver = new ResizeObserver(fitRuneHeading)
  const heading = headingName.value?.closest('.build-detail-heading')
  if (heading) headingObserver.observe(heading)
  fitRuneHeading()
  void document.fonts.ready.then(() => {
    if (headingName.value) fitRuneHeading()
  })
})
watch(
  [headingText, locale, change],
  async () => {
    await nextTick()
    fitRuneHeading()
  },
  { flush: 'post' },
)
onUnmounted(() => {
  headingObserver?.disconnect()
  cancelAnimationFrame(headingFrame)
})
</script>
<template>
  <section
    ref="panel"
    :id="panelId"
    class="build-detail rune-detail"
    :aria-label="message('{p0}符文详情', { p0: gameName('augments', entry.id, patch, entry.name) })"
  >
    <DetailHeading sticky>
      <img
        class="rune-detail-icon augment-artwork"
        :class="{ 'augment-gold-fallback': needsGoldTint(entry.id, patch, entry.rarity) }"
        :src="augmentIcon(entry.id, patch, entry.icon)"
        alt=""
        width="60"
        height="60"
      />
      <div class="build-detail-title">
        <h2 ref="headingName">{{ headingText }}</h2>
        <p>{{ count(entry.games) }}{{ englishGap }}{{ t('次') }}</p>
      </div>
      <div class="rune-detail-summary">
        <div class="rune-detail-result">
          <strong :style="{ color: rateColor }"
            >{{ t('胜率：') }}{{ englishGap }}{{ pct(entry.winRate) }}</strong
          >
          <p
            v-if="change"
            :style="{ color: change.color }"
            :title="
              comparisonPatch
                ? message('相较 {p0}，胜率差值以百分点计；前后版本采用相同统计口径', {
                    p0: comparisonPatch,
                  })
                : undefined
            "
            aria-live="polite"
          >
            {{ t('较上版本') }}{{ englishGap }}{{ t(change.label) }}
          </p>
          <p v-else>{{ t('暂无上版本数据') }}</p>
        </div>
      </div>
      <div class="rune-detail-actions">
        <SearchBox
          v-model="query"
          scope="detail"
          class="rune-detail-search"
          :label="t('搜索详情中的英雄、符文或装备')"
          placeholder=""
          :hint-icons="[
            '/role-portraits/17.png',
            augmentIcon(1195, patch, '/build-assets/augment-1195.png'),
            '/build-assets/item-2051.png',
          ]"
        />
        <button
          v-if="!standalone"
          class="build-detail-close"
          :aria-label="t('关闭符文详情')"
          @click="emit('close')"
        >
          ×
        </button>
      </div>
    </DetailHeading>
    <div class="rune-detail-body">
      <p v-if="searchError" class="board-message" role="status">{{ searchError }}</p>
      <div class="rune-detail-card-groups">
        <DetailCategoryTabs
          paint-with-indicator
          :enabled="compact"
          :panel-id="panelId"
          :tabs="mobileTabs"
          :label="t('符文统计分类')"
          v-slot="{ tab, active }"
        >
          <RuneHeroes
            v-if="!compact || tab.id === 'heroes'"
            :grid-mode="compact"
            :floating-sort="compact && active"
            :rune-id="entry.id"
            :patch="patch"
            :snapshot-id="entry.snapshotId"
            :query="query"
            :search-index="searchIndex"
            @loaded="heroMeta = $event"
          />
          <RuneSynergies
            :grid-mode="compact"
            :floating-sort="compact && active"
            :rune-id="entry.id"
            :patch="patch"
            :snapshot-id="entry.snapshotId"
            v-if="!compact || tab.id === 'augments'"
            kind="augments"
            :query="query"
            :search-index="searchIndex"
            @loaded="synergyMeta = $event"
          />
          <RuneSynergies
            :grid-mode="compact"
            :floating-sort="compact && active"
            :rune-id="entry.id"
            :patch="patch"
            :snapshot-id="entry.snapshotId"
            v-if="!compact || tab.id === 'items'"
            kind="items"
            :query="query"
            :search-index="searchIndex"
            @loaded="synergyMeta = $event"
          />
        </DetailCategoryTabs>
      </div>
      <div class="rune-detail-overview">
        <DetailSection
          :id="panelId + '-description'"
          non-collapsible
          :title="t('符文说明')"
          class="rune-description"
        >
          <RuneDescriptionPanel
            :id="panelId + '-left'"
            :label="t('符文说明')"
            side="left"
            initial-mode="translation"
            :prefer-initial-mode="linkedDescription"
            :simple="simple"
            :simple-loading="simpleLoading"
            :simple-error="simpleError"
            :wiki="description"
            :wiki-loading="wikiLoading"
            :wiki-error="descriptionError"
            :translation="translation"
            :translation-loading="translationLoading"
            :translation-error="translationError"
            @request-translation="readTranslations"
            @retry="retryDescription"
          />
          <p class="rune-description-warning">
            <span aria-hidden="true">⚠</span
            >{{ t('Wiki 社区说明不保证与所选统计版本一致；简中译文不是官方文本。') }}
          </p>
        </DetailSection>
        <DetailSection
          :id="panelId + '-statistics'"
          non-collapsible
          :title="t('统计数据')"
          class="rune-chart-module"
        >
          <p v-if="!entry.slots" class="board-message" role="status">
            {{ t('当前快照尚无逐选记录，请更新统计快照后重试。') }}
          </p>
          <div v-else class="rune-statistics-content">
            <RunePickChart
              :slots="entry.slots"
              :baseline="entry.winRate"
              :name="gameName('augments', entry.id, patch, entry.name)"
            />
          </div>
        </DetailSection>
      </div>
    </div>
    <RecentChanges
      :id="panelId + '-patches'"
      v-model="showRecentChanges"
      :available="hasRecentChanges"
      kind="rune"
      :entity-id="entry.id"
      :patch="patch"
      hide-source-note
    >
    </RecentChanges>
    <DetailMethod :id="panelId + '-method'">
      <h3 :id="panelId + '-source-notes'" tabindex="-1">{{ t('说明来源与显示偏好') }}</h3>
      <p>{{ t('说明选项会通过 Cookie 在此浏览器中记住 180 天，仅用于恢复显示偏好。') }}</p>
      <p>
        {{ t('来源：')
        }}<a :href="sourceUrl" target="_blank" rel="noopener noreferrer"
          >League of Legends Wiki · ARAM: Mayhem/Augments</a
        ><template v-if="descriptions">
          ·
          <a :href="descriptions.source.history" target="_blank" rel="noopener noreferrer">{{
            t('贡献者')
          }}</a>
          ·
          <a :href="descriptions.source.licenseUrl" target="_blank" rel="noopener noreferrer">{{
            descriptions.source.license
          }}</a></template
        >
      </p>
      <p v-if="descriptions">
        {{ descriptions.source.capturedAt }}{{ t('读取的 Wiki 说明；未按') }}{{ patch
        }}{{
          t(
            '回溯。主效果摘录，已整理排版并将部分图标转为文字；补充注释及任务阶段表见原文。摘录及译文沿用 CC BY-SA 3.0。',
          )
        }}
      </p>
      <p v-if="translations">
        {{
          t(
            'Wiki翻译为基于上述英文摘录的 AI 辅助中文译文，非官方翻译；含义如有出入请对照英文原文。',
          )
        }}
      </p>
      <p>{{ t('来源：Riot 官方更新公告 · 繁中转简体，符文名对照简中资料。') }}</p>
      <template v-if="entry.slots">
        <h3 :id="panelId + '-chart-notes'" tabindex="-1">{{ t('图表统计口径与数据范围') }}</h3>
        <p>
          {{ t('第 1–4 选共') }}{{ count(observed)
          }}{{
            t(
              '次记录。某选次数占比不足 1% 时，不绘制该选的胜率点及连接线；次数仍保留。胜率轴跨度固定为 20 个百分点，中点为非条件胜率最接近的 5% 刻度（恰在两刻度中间时向上取整），上下各 10 个百分点。超出范围用箭头标记，实际值可点选查看。选次按 LCU 非空槽位顺序近似；无记录不代表该轮不可获得。次数不是出现概率。',
            )
          }}
        </p>
        <div class="rune-chart-data">
          <table>
            <thead>
              <tr>
                <th>{{ t('选次') }}</th>
                <th>{{ t('选择次数') }}</th>
                <th>{{ t('胜率') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="point in points" :key="point.slot">
                <th>{{ t('第') }}{{ point.slot }}{{ t('选') }}</th>
                <td>{{ count(point.games) }}{{ t('次') }}</td>
                <td :style="{ color: winRateColor(point.winRate, entry.winRate) }">
                  {{ pct(point.winRate)
                  }}{{ point.lowSample && point.games ? t('（样本较少）') : '' }}
                </td>
              </tr>
            </tbody>
          </table>
          <p>
            Mayhem · queue 2400 · {{ patch
            }}{{
              t(
                '· 可分类流派样本，与当前榜单同一快照。胜率为（胜场 + 1）÷（次数 + 2）；少于 20 次用空心点标记，零次不绘制胜率。非条件胜率使用该符文全部出场记录，与卡片胜率一致，不受第 1–4 选展示或 1% 绘图门槛影响。重复符文记录不参与选次统计。两轴分别缩放，曲线交点没有统计含义；胜率是历史关联，非选次的因果收益。',
              )
            }}
          </p>
        </div>
      </template>
      <h3 :id="panelId + '-hero-notes'" tabindex="-1">{{ t('英雄统计口径') }}</h3>
      <p v-if="showRuneHeroChart">
        {{
          t(
            '头像箭头图默认仅显示选用当前符文至少 50 场的英雄，可调整展示门槛。横轴 = 该英雄选用当前符文的次数 ÷ 该英雄全部同品质符文总选用次数，包含当前符文；同局同符文去重，不同符文分别计次，分母不受图表门槛影响。箭头起点为英雄总体胜率（包含当前符文对局），头像中心为选用当前符文后的胜率，两端均与上方卡片采用相同平滑算法。头像保持真实坐标；重叠时可缩放或点按选择附近英雄。纵轴自动覆盖全部起终点，筛选后范围可能变化。',
          )
        }}
      </p>
      <p>
        {{
          t(
            '胜率为该英雄选择当前符文的胜率；Δ胜率 = 该胜率 − 同版本该英雄全部流派的平均胜率。两者统一使用该英雄当前版本全部出场的固定基准 b =（总胜场 + 1）÷（总场数 + 2），胜率 =（胜场 + 50 × b）÷（场数 + 50），与英雄详情的符文卡片及筛选按钮一致。差值以未四舍五入的数值计算。例如 60% − 50% 显示 +10.0%，表示高出 10 个百分点，并不代表符文带来的因果收益。',
          )
        }}
      </p>
      <p>
        {{
          t(
            '包含未分类流派的有效出场，与本页顶部及图表的可分类样本范围不同。默认按胜率降序；可点击 Δ胜率、选用率、场次排序。卡片选用率 = 该英雄选择当前符文的场次 ÷ 同版本该英雄全部出场；场次为选择当前符文的英雄出场数。选用率与场次按数值降序排列；小于等于',
          )
        }}{{ RUNE_HERO_MIN_GAMES
        }}{{
          t(
            '场标记 *，在胜率及 Δ胜率排序时排在末尾。悬浮英雄头像可查看样本数、基准胜率。零记录英雄不显示。',
          )
        }}
      </p>
      <p v-if="heroMeta">
        Mayhem · queue {{ heroMeta.queue }} · {{ heroMeta.patch }} · {{ heroMeta.region }} ·
        {{ heroMeta.source }} · {{ heroMeta.from }}{{ t('至') }}{{ heroMeta.cutoff
        }}{{ t('。与当前符文榜单使用同一统计快照。') }}
      </p>
      <h3 :id="panelId + '-synergy-notes'" tabindex="-1">{{ t('联动统计口径') }}</h3>
      <p>
        {{
          t(
            '当前符文记为 A，搭配符文或装备记为 B。对每位英雄分别计算 A+B 的组合胜率和选择 A 的基准胜率，再按该英雄在 A+B 共同出场中的占比加权。综合 Δ胜率 = 两个加权胜率之差，以百分点计；基准包含组合本身，不是未选 B 的对照组，也不是直接减去本页顶部的符文总体胜率。',
          )
        }}
      </p>
      <p>{{ t('各英雄的两个胜率均沿用英雄统计的固定基准和 50 场先验平滑。') }}</p>
      <p>
        {{
          t(
            '符文联动包含所有有效英雄出场及未分类流派；装备联动的组合与基准均仅使用装备记录完整的出场，按终局持有装备统计，不区分购买顺序。同一英雄出场内相同符文、装备去重，A 不与自身组合。场次为共同出场的人次，不是去重对局数；共同选用率 = 共同出场次数 ÷ 选择 A 的有效出场次数（装备联动仅含装备记录完整者）。',
          )
        }}
      </p>
      <p>
        {{ t('默认按组合胜率降序，可点击胜率、综合 Δ 和场次排序。少于') }}{{ RUNE_SYNERGY_MIN_GAMES
        }}{{
          t(
            '场标记 *，在胜率及 Δ 排序时置于末尾；零记录不显示。英雄构成校正不能消除玩家水平、其它符文、选次、对局时长及装备成型等偏差，联动只描述历史关联，不代表因果收益。',
          )
        }}
      </p>
      <p v-if="synergyMeta">
        Mayhem · queue {{ synergyMeta.queue }} · {{ synergyMeta.patch }} ·
        {{ synergyMeta.region }} · {{ synergyMeta.source }} · {{ synergyMeta.from }}{{ t('至')
        }}{{ synergyMeta.cutoff
        }}{{ t('。与当前榜单使用同一统计快照，样本范围与顶部可分类流派统计不同。') }}
      </p>
    </DetailMethod>
  </section>
</template>
<style scoped>
.rune-detail :deep(.champion-patch-version li) {
  font-size: 14px;
  line-height: 1.8;
}
.rune-description-warning {
  margin: 8px 0 0;
  color: var(--win-negative-3);
  font-size: 12px;
  line-height: 1.6;
}
.rune-description-warning span {
  margin-right: 4px;
}
.rune-detail-overview .rune-description :deep(.detail-section-content) {
  height: auto;
}
.rune-detail-actions {
  flex: 0 1 400px;
  min-width: 0;
  align-items: flex-end;
}
.rune-detail-search {
  flex: 1;
  min-width: 0;
}
.rune-detail-search :deep(input) {
  min-width: 0;
  width: 0;
}
.rune-detail-search :deep(.search-hint img:nth-of-type(2)) {
  width: 28px;
  height: 28px;
  flex-basis: 28px;
}
.rune-detail-card-groups {
  min-width: 0;
}
.rune-detail-overview {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
  align-items: start;
}
.rune-detail-overview .rune-chart-module {
  width: 100%;
}
/* Eight 23.8px body lines, text padding/border (33px), and tabs (46.8px). */
.rune-detail-overview {
  --rune-overview-height: calc(9 * 23.8px + 56px);
}
.rune-detail-overview :deep(.detail-section-content) {
  height: var(--rune-overview-height);
  box-sizing: content-box;
}
.rune-detail-overview :deep(.rune-description-panel) {
  display: flex;
  flex-direction: column;
  height: var(--rune-overview-height);
}
.rune-detail-overview :deep(.rune-description-tabs) {
  flex-shrink: 0;
}
.rune-detail-overview :deep(.rune-description-content) {
  flex: 1;
  min-height: 0;
}
.rune-detail-overview :deep(.rune-description-sizer) {
  display: none;
}
.rune-detail-overview :deep(.rune-description-text) {
  min-height: 0;
}
.rune-statistics-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.rune-statistics-content :deep(.rune-chart-scroll) {
  flex: 1;
  min-height: 0;
}
.rune-statistics-content :deep(.rune-pick-chart) {
  height: 100%;
  min-height: 0;
  max-height: none;
  aspect-ratio: auto;
  overflow: hidden;
}
.rune-detail .build-detail-heading {
  flex-wrap: wrap;
  align-items: flex-end;
}
.rune-detail .build-detail-title h2 {
  line-height: 1.35;
}
@media (max-width: 700px) {
  .rune-detail-search {
    display: none;
  }
  .rune-detail .build-detail-heading {
    flex-wrap: nowrap;
    align-items: flex-end;
    gap: 8px;
    padding-bottom: 12px;
  }
  .rune-detail .build-detail-heading:has(.build-detail-close) {
    padding-right: 0;
  }
  .rune-detail .build-detail-title {
    flex: 0 1 auto;
    min-width: 0;
  }
  .rune-detail-summary {
    flex: 1 0 auto;
    justify-content: flex-start;
    margin-left: 20px;
  }
  .rune-detail-actions {
    display: contents;
  }
  .rune-detail-search {
    display: none;
  }
  .rune-detail .build-detail-heading .build-detail-close {
    position: static;
    align-self: flex-end;
    width: 36px;
    height: 36px;
    margin: 0;
  }
  .rune-detail-card-groups :deep(.hero-detail-tabs) {
    margin-top: 0;
  }
  .rune-detail-card-groups :deep(.hero-detail-tabs button) {
    padding-top: 0;
  }
  .rune-detail-overview {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
  }
}
</style>
