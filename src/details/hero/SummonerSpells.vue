<script setup lang="ts">
import { t } from '@/i18n/i18n'
import { gameName } from '@/i18n/gameLocalization'

import { showTip, hideTip, toggleTip, type TipData } from '@/tooltip/tooltip'
import { computed } from 'vue'
import DetailStatRow from '@/details/DetailStatRow.vue'
import DetailCardList from '@/details/DetailCardList.vue'
import { visibleSpellPairs, orderedSpellIcons, type SpellScope } from './spellBuilds'
import BuildStatCard from '@/details/BuildStatCard.vue'
const props = defineProps<{
  showDelta?: boolean
  scope: SpellScope | null
  loading: boolean
  patch: string
  baseline: number
  locked?: boolean
}>()
const pairs = computed(() => visibleSpellPairs(props.scope?.row.pairs || []))
function spellTip(spell: { id: number; icon: string | null }): TipData {
  return {
    id: String(spell.id),
    kind: 'spells',
    name: gameName('spells', spell.id, props.patch),
    icon: spell.icon || '',
    patch: props.patch,
    winRate: 0,
    pickRate: 0,
    games: 0,
    rawWinRate: 0,
    interval: [],
    baseline: props.baseline,
    context: '',
    preferredSide: 'below',
  }
}
function revealSpell(event: Event, spell: { id: number; icon: string | null }) {
  if (event.type === 'mouseenter' && matchMedia('(hover:none)').matches) return
  showTip(event, spellTip(spell))
}
</script>
<template>
  <DetailStatRow
    :sync-win-rate-delta="showDelta"
    :locked="locked"
    :available-cells="scope?.row.pairs"
    class="spells"
    :label="t('召唤师\n技能')"
    :name="t('当前筛选范围召唤师技能组合')"
    :aria-busy="loading"
    :cells="pairs"
    v-slot="{ sortedCells, sortBy }"
  >
    <DetailCardList
      :item-count="sortedCells.length"
      :reset-key="sortBy"
      v-slot="{ pageItems }"
      :loading="loading"
      :aria-hidden="loading ? true : undefined"
      :class="{ 'is-empty': !loading && !sortedCells.length }"
      :tabindex="loading ? undefined : 0"
      :aria-label="t('召唤师技能组合，可左右滚动查看全部')"
    >
      <template v-if="loading"
        ><div v-for="i in 5" :key="i" class="build-stat-placeholder"></div
      ></template>
      <template v-else>
        <BuildStatCard
          :show-delta="showDelta"
          v-for="pair in pageItems(sortedCells, Infinity)"
          :key="pair.id"
          :cell="pair"
          group="spells"
          :patch="patch"
          :baseline="baseline"
          :sample-unit="t('场')"
        >
          <template #identity>
            <span class="spell-icons">
              <button
                type="button"
                v-for="spell in orderedSpellIcons(pair)"
                :key="spell.id"
                class="spell-tip-trigger"
                :aria-label="gameName('spells', spell.id, patch)"
                @mouseenter="revealSpell($event, spell)"
                @mouseleave="hideTip()"
                @focus="revealSpell($event, spell)"
                @blur="hideTip()"
                @click.stop="toggleTip($event, spellTip(spell))"
              >
                <img
                  v-if="spell.icon"
                  :src="spell.icon"
                  :alt="gameName('spells', spell.id, patch)"
                  width="32"
                  height="32"
                  loading="lazy"
                /><span v-else class="spell-missing-icon" aria-hidden="true">?</span>
              </button>
            </span>
          </template>
        </BuildStatCard>
        <p v-if="!sortedCells.length" class="build-detail-empty" role="status">
          {{ t('当前范围暂无有效召唤师技能记录。') }}
        </p>
      </template>
    </DetailCardList>
  </DetailStatRow>
</template>
<style scoped>
.spells {
  --rarity: var(--silver);
}
.spell-icons {
  display: grid;
  grid-template-rows: repeat(2, 32px);
  gap: 4px;
  align-content: center;
}
/* 技能图标只用于显示说明（触屏点按也显示），不是可跳转或筛选的操作，不用手指光标 */
.spell-tip-trigger {
  cursor: default;
  padding: 0;
  border: 0;
  background: transparent;
  width: 32px;
  height: 32px;
}
.spell-tip-trigger > img,
.spell-missing-icon {
  width: 32px;
  height: 32px;
  border-radius: 4px;
}
.spell-missing-icon {
  display: grid;
  place-items: center;
  background: var(--chip);
  color: var(--muted);
}
button {
  background: var(--chip);
  color: var(--text);
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  cursor: pointer;
}
button:focus-visible,
summary:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
</style>
