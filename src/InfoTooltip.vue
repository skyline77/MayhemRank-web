<script setup lang="ts">
import { t, message } from './i18n'
import { gameName } from './gameLocalization'
import { locale } from './locale'
import { formatCount } from './formatCount'
import RuneMiniChart from './RuneMiniChart.vue'
import { loadRuneBoard, type RuneEntry } from './augmentBoard'

import StatText from './StatText.vue'
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { activeTip, closeTip, hideTip, keepTip } from './tooltip'
import { loadDescription, type DescriptionEntry } from './tooltipData'
import { winRateDelta } from './buildDetails'
import { winRateColor } from './winRateColor'
import { augmentIcon, needsGoldTint } from './augmentIcons'
import { tooltipPosition } from './tooltipPosition'
import { runeDetailUrl } from './detailLink'
import { loadRuneDescriptions, matchingRuneTranslation } from './runeDescriptions'
const panel = ref<HTMLElement | null>(null)
const excerpt = ref<HTMLElement | null>(null),
  excerptOverflow = ref(false)
const description = ref<DescriptionEntry | null>(null),
  loading = ref(false),
  failed = ref(false)
const position = ref({
  left: '8px',
  top: '8px',
  maxHeight: 'calc(100dvh - 16px)',
  visibility: 'hidden' as 'hidden' | 'visible',
})
const data = computed(() => activeTip.value?.data)
const chartRune = ref<RuneEntry | null>(null)
watch(activeTip, async (value, _, onCleanup) => {
  let stale = false
  onCleanup(() => {
    stale = true
  })
  chartRune.value = null
  if (
    !value ||
    value.data.kind !== 'augments' ||
    !value.anchor.closest('.build-detail')?.querySelector('.hero-detail-heading')
  )
    return
  try {
    const board = await loadRuneBoard(value.data.patch)
    if (stale) return
    chartRune.value =
      board.entries.find(entry => entry.id === value.data.id && entry.slots?.length) || null
    await nextTick()
    if (!stale) place()
  } catch {
    /* A missing chart must not block the rune description. */
  }
})
const useWikiTranslation = computed(
  () => data.value?.kind === 'augments' && !!data.value.wikiTranslation,
)
const displayedDescription = computed(() => {
  const text = description.value?.description || ''
  return data.value?.kind === 'augments'
    ? text
        .split(/\r?\n/)
        .filter(line => line.trim())
        .join('\n')
    : text
})
const displayedLines = computed(() =>
  data.value?.kind === 'augments'
    ? description.value?.lines?.filter(line => line.text.trim())
    : description.value?.lines,
)
const pct = (value: number) => (value * 100).toFixed(1) + '%'
const detailHref = computed(() =>
  data.value?.kind === 'augments' ? runeDetailUrl(data.value.id, data.value.patch) : undefined,
)
let generation = 0,
  frame = 0
function place() {
  const anchor = activeTip.value?.anchor,
    tip = panel.value
  if (!anchor || !tip) return
  if (!anchor.isConnected) {
    closeTip()
    return
  }
  // Keep the popup outside the entire card, including its result/usage rows.
  const a = (anchor.closest('.build-stat-card') || anchor).getBoundingClientRect()
  const vw = document.documentElement.clientWidth,
    vh = window.innerHeight
  if (a.bottom < 0 || a.top > vh || a.right < 0 || a.left > vw) {
    closeTip()
    return
  }
  const main = anchor.closest('main')?.getBoundingClientRect()
  const bounds = {
    left: Math.max(8, main?.left ?? 8),
    right: Math.min(vw - 8, main?.right ?? vw - 8),
  }
  tip.style.maxWidth = Math.max(0, bounds.right - bounds.left) + 'px'
  excerptOverflow.value =
    !!excerpt.value && excerpt.value.scrollHeight > excerpt.value.clientHeight + 1
  const r = tip.getBoundingClientRect()
  position.value = tooltipPosition(
    a,
    r.width,
    Math.max(r.height, tip.scrollHeight + 2),
    vw,
    vh,
    bounds,
    data.value?.preferredSide,
  )
}
function reposition() {
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(place)
}
function outside(event: Event) {
  const target = event.target as Node
  if (!panel.value?.contains(target) && !activeTip.value?.anchor.contains(target)) closeTip()
}
function escape(event: Event) {
  if ((event as KeyboardEvent).key === 'Escape' && activeTip.value) {
    event.preventDefault()
    event.stopPropagation()
    closeTip()
  }
}
watch(activeTip, async (value, previous) => {
  if (previous?.anchor !== value?.anchor) previous?.anchor.removeAttribute('aria-describedby')
  const token = ++generation
  if (!value) return
  value.anchor.setAttribute('aria-describedby', 'game-info-tooltip')
  description.value = null
  failed.value = false
  loading.value = true
  excerptOverflow.value = false
  position.value.visibility = 'hidden'
  await nextTick()
  place()
  try {
    let result: DescriptionEntry | null
    if (value.data.kind === 'augments' && value.data.wikiTranslation) {
      const [wiki, translated] = await Promise.all([
        loadRuneDescriptions(),
        loadRuneDescriptions('zh_CN'),
      ])
      const entry =
        locale.value === 'zh-CN'
          ? matchingRuneTranslation(wiki.entries[value.data.id], translated.entries[value.data.id])
          : wiki.entries[value.data.id]
      result = entry
        ? { name: entry.name, description: entry.description, unresolved: false }
        : null
    } else result = await loadDescription(value.data.patch, value.data.kind, value.data.id)
    if (token === generation) description.value = result
  } catch {
    if (token === generation) failed.value = true
  } finally {
    if (token === generation) {
      loading.value = false
      await nextTick()
      place()
    }
  }
})
watch(
  () => !!activeTip.value,
  open => {
    const method = open ? 'addEventListener' : 'removeEventListener'
    window[method]('scroll', reposition, true)
    window[method]('resize', reposition)
    document[method]('pointerdown', outside, true)
    document[method]('keydown', escape, true)
  },
)
function filterAndClose() {
  data.value?.onFilter?.()
  closeTip()
}
onUnmounted(() => {
  closeTip()
  cancelAnimationFrame(frame)
  window.removeEventListener('scroll', reposition, true)
  window.removeEventListener('resize', reposition)
  document.removeEventListener('pointerdown', outside, true)
  document.removeEventListener('keydown', escape, true)
})
</script>
<template>
  <Teleport to="body">
    <aside
      v-if="data"
      id="game-info-tooltip"
      ref="panel"
      class="game-info-tooltip"
      :class="{ 'has-mini-chart': chartRune?.slots }"
      :style="position"
      role="tooltip"
      @mouseenter="keepTip"
      @mouseleave="hideTip"
      @focusin="keepTip"
      @focusout="hideTip"
    >
      <header class="game-tip-heading" :class="{ 'is-spell': data.kind === 'spells' }">
        <component
          :is="detailHref ? 'a' : 'div'"
          class="game-tip-heading-content"
          :href="detailHref"
          :aria-label="
            detailHref
              ? message('{p0}，在海克斯榜查看详细', {
                  p0: gameName(data.kind, data.id, data.patch, data.name),
                })
              : undefined
          "
        >
          <img
            :src="
              data.kind === 'augments' ? augmentIcon(data.id, data.patch, data.icon) : data.icon
            "
            :class="{
              'augment-artwork': data.kind === 'augments',
              'augment-gold-fallback': needsGoldTint(data.id, data.patch, data.rarity || ''),
            }"
            alt=""
            width="48"
            height="48"
          />
          <div>
            <h3 :class="data.kind === 'augments' ? data.rarity : undefined">
              {{ gameName(data.kind, data.id, data.patch, data.name) }}
            </h3>
            <span v-if="data.kind === 'items' && description?.price != null" class="game-tip-price"
              ><img
                class="game-tip-gold-icon"
                src="/stat-icons/gold.webp"
                alt=""
                width="16"
                height="16"
              />{{ description.price.toLocaleString('zh-CN') }}{{ t('金') }}</span
            ><span v-else-if="detailHref" class="game-tip-detail"
              >{{ t('详细')
              }}<svg
                aria-hidden="true"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M14 3h7v7M21 3l-11 11M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"
                /></svg
            ></span>
          </div>
        </component>
        <button v-if="data.onFilter" type="button" class="game-tip-filter" @click="filterAndClose">
          {{ t('筛选') }}
        </button>
        <div v-if="data.kind === 'spells' && description" class="game-tip-spell-meta">
          <span v-if="description.cooldown"
            >{{
              locale === 'en-US'
                ? 'Base CD'
                : locale === 'ja-JP'
                  ? '基本クールダウン'
                  : locale === 'zh-TW'
                    ? '基礎冷卻'
                    : '基础冷却'
            }}
            {{ description.cooldown }}{{ locale === 'en-US' ? 's' : t('秒') }}</span
          ><small v-if="description.cost">{{ description.cost }}</small>
        </div>
      </header>
      <div class="game-tip-description" aria-live="polite">
        <small v-if="description && data.kind !== 'spells'">{{
          t(
            data.kind === 'items'
              ? '装备描述：Riot Data Dragon'
              : locale === 'zh-CN'
                ? 'Wiki 简中译文（非官方）'
                : 'Wiki 英文原文（社区）',
          )
        }}</small>
        <p v-if="loading">{{ t('正在读取说明……') }}</p>
        <div
          v-else-if="useWikiTranslation && description?.description"
          class="game-tip-wiki-summary"
        >
          <p
            :lang="locale === 'zh-CN' ? 'zh-CN' : 'en-US'"
            ref="excerpt"
            class="game-tip-wiki-excerpt"
          >
            <StatText :text="displayedDescription" :lang="locale === 'zh-CN' ? 'zh-CN' : 'en-US'" />
          </p>
          <a
            v-if="excerptOverflow"
            class="game-tip-wiki-more"
            :href="detailHref + '#rune-description'"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="
              message('{p0}，在新页面查看完整说明', {
                p0: gameName(data.kind, data.id, data.patch, data.name),
              })
            "
            >{{ t('... 详细')
            }}<svg
              aria-hidden="true"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M14 3h7v7M21 3l-11 11M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"
              /></svg
          ></a>
        </div>
        <template v-else-if="description?.description"
          ><template v-if="displayedLines?.length"
            ><p
              v-for="(line, index) in displayedLines"
              :key="index"
              :class="['game-tip-line', 'game-tip-line-' + line.kind]"
            >
              <StatText :text="line.text" /></p></template
          ><template v-else
            ><p v-for="(line, index) in displayedDescription.split('\n')" :key="index">
              <StatText :text="line" /></p></template
          ><small v-if="description.unresolved">{{
            t('部分数值或效果以游戏内说明为准。')
          }}</small></template
        >
        <p v-else>
          {{
            failed
              ? t('说明暂时无法读取，请稍后重新打开。')
              : useWikiTranslation
                ? t('暂无可用的 WIKI 中文译文。')
                : t('该版本暂无可用说明。')
          }}
        </p>
      </div>
      <div
        v-if="data.kind !== 'spells'"
        class="game-tip-summary"
        :class="{ 'with-chart': chartRune?.slots }"
      >
        <p v-if="data.missingStatistics" class="game-tip-statistics-note">
          {{ t(data.missingStatistics) }}
        </p>
        <dl v-else class="game-tip-stats">
          <div>
            <dt>{{ t('胜率：') }}</dt>
            <dd :style="{ color: winRateColor(data.winRate, data.baseline) }">
              <span class="game-tip-metric">{{ pct(data.winRate) }}</span>
            </dd>
          </div>
          <div>
            <dt>{{ t('Δ胜率') }}：</dt>
            <dd class="game-tip-delta">
              <span
                class="game-tip-metric"
                :style="{ color: winRateColor(data.winRate, data.baseline) }"
                >{{ winRateDelta(data.winRate, data.baseline) }}</span
              ><small v-if="data.baselineLabel" class="game-tip-baseline">{{
                message('较{baseline}', { baseline: data.baselineLabel })
              }}</small>
            </dd>
          </div>
          <div>
            <dt>{{ t(data.pickLabel) || t('使用率') }}：</dt>
            <dd>
              <span class="game-tip-metric">{{ pct(data.pickRate) }}</span
              ><span class="game-tip-stat-extra">({{ formatCount(data.games) }}{{ t('场)') }}</span>
            </dd>
          </div>
        </dl>
        <RuneMiniChart
          v-if="chartRune?.slots"
          :slots="chartRune.slots"
          :baseline="chartRune.winRate"
          :name="gameName('augments', chartRune.id, data.patch, chartRune.name)"
        />
      </div>
      <div
        v-if="data.heroIds?.length"
        class="game-tip-covered-heroes"
        :aria-label="t('共同出场最多的英雄，最多显示六位')"
      >
        <img
          v-for="id in data.heroIds.slice(0, 6)"
          :key="id"
          :src="'/role-portraits/' + id + '.png'"
          :alt="message('英雄 {p0}', { p0: id })"
          width="32"
          height="32"
          loading="lazy"
        />
        <span
          v-if="(data.heroCount ?? 0) > 6"
          class="game-tip-heroes-more"
          :aria-label="message('另有 {p0} 位英雄', { p0: (data.heroCount ?? 0) - 6 })"
          role="img"
          ><svg
            width="18"
            height="18"
            viewBox="0 0 48 48"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="m42,30c-3.312,0-6-2.688-6-6s2.688-6 6-6 6,2.688 6,6-2.688,6-6,6zm-18,0c-3.312,0-6-2.688-6-6s2.688-6 6-6 6,2.688 6,6-2.688,6-6,6zm-18,0c-3.312,0-6-2.688-6-6s2.688-6 6-6 6,2.688 6,6-2.688,6-6,6z"
            /></svg
        ></span>
      </div>
      <p v-if="data.statisticsNote" class="game-tip-statistics-note">{{ data.statisticsNote }}</p>
    </aside>
  </Teleport>
</template>
<style scoped>
.game-tip-heading.is-spell {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-strong);
}
.is-spell .game-tip-heading-content {
  flex: 1;
  min-width: 0;
}
.game-tip-spell-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 5px;
  font-size: 12px;
  color: var(--accent-text);
  font-variant-numeric: tabular-nums;
}
.game-tip-spell-meta small {
  color: var(--muted);
  font-size: 12px;
}

.game-tip-filter {
  display: none;
}
@media (max-width: 700px) {
  .game-tip-heading {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }
  .game-tip-heading-content {
    min-width: 0;
    flex: 1;
  }
  .game-tip-filter {
    display: block;
    flex: none;
    margin-left: auto;
    white-space: nowrap;
    padding: 6px 10px;
    border: 1px solid var(--accent);
    border-radius: 6px;
    background: var(--surface);
    color: var(--accent-text);
    font: inherit;
    cursor: pointer;
  }
  .game-tip-filter:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
}
.game-tip-covered-heroes {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
}
.game-tip-heroes-more {
  flex: none;
  display: flex;
  align-items: center;
  height: 32px;
  line-height: 1;
  color: var(--muted);
}
.game-tip-covered-heroes img {
  flex: none;
  width: 32px;
  height: 32px;
  border-radius: 4px;
  object-fit: cover;
}
.game-info-tooltip.has-mini-chart {
  width: 380px;
}
.game-tip-summary.with-chart {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(90px, 120px);
  align-items: center;
  gap: 8px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--border-strong);
}
.game-tip-summary.with-chart .game-tip-stats {
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
}
.game-tip-summary.with-chart .game-tip-stats > div {
  grid-template-columns: 4em minmax(0, 1fr);
}
.game-tip-stats dt {
  white-space: nowrap;
}
/* 数值共用固定列宽，flex 换行与 grid 布局都保持百分号右对齐。 */
.game-tip-stats .game-tip-metric {
  display: inline-block;
  width: 7.5ch;
  flex: 0 0 7.5ch;
  text-align: right;
}
.game-tip-stats dd.game-tip-delta {
  display: flex;
  flex-wrap: wrap;
  min-width: 0;
}
.game-tip-baseline {
  flex-basis: 100%;
  min-width: 0;
  color: var(--muted);
  font-size: 11px;
  font-weight: 400;
  line-height: 1.4;
  overflow-wrap: anywhere;
}
.game-tip-summary.with-chart .game-tip-stats dd {
  display: flex;
  flex-wrap: wrap;
  column-gap: 4px;
  row-gap: 0;
  align-items: center;
}
.game-tip-summary.with-chart :deep(.rune-mini-chart) {
  width: 100%;
  margin: 0;
}

.game-tip-wiki-summary {
  position: relative;
}
.game-tip-description .game-tip-wiki-excerpt {
  margin: 0;
}
.game-tip-wiki-more {
  position: absolute;
  right: 0;
  bottom: 0;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding-left: 6px;
  background: var(--card);
  color: var(--muted);
  text-decoration: none;
}
.game-tip-wiki-more:is(:hover, :focus-visible) {
  color: var(--accent-text);
}
.game-tip-wiki-more:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.game-tip-wiki-excerpt {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 5;
  line-clamp: 5;
  overflow: hidden;
  white-space: pre-line;
}
.game-tip-statistics-note {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
  margin: 10px 0 0;
}
@media (max-width: 700px), (hover: none) {
  .game-info-tooltip,
  .game-info-tooltip.has-mini-chart {
    width: 320px;
    padding: 12px;
    border-radius: 12px;
  }
  .game-info-tooltip.has-mini-chart {
    width: 380px;
  }
  .game-tip-summary.with-chart {
    grid-template-columns: minmax(0, 1fr) 120px;
    gap: 8px;
  }
  .game-tip-stats dd {
    display: flex;
    flex-wrap: wrap;
    column-gap: 4px;
  }
}
</style>
