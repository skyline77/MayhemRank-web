<script setup lang="ts">
import { t, message } from '@/i18n/i18n'
import { gameName, roleName } from '@/i18n/gameLocalization'
import { formatCount } from '@/stats/formatCount'

import { computed, ref, watch, onMounted, onUpdated, onUnmounted } from 'vue'
import DetailLink from '@/details/DetailLink.vue'
import RoleChoiceContent from './RoleChoiceContent.vue'
import { loadBuildDetail, type DetailCell } from '@/details/buildDetails'
import { buildDetailUrl } from '@/app/detailLink'
import { type BuildEntry } from '@/boards/heroes/buildBoard'
import { augmentIcon } from '@/data/augmentIcons'
import { winRateColor } from '@/stats/winRateColor'
import type { HeroFilter, HeroFilterAction } from './heroFilter'
const props = defineProps<{
  hero: { name: string; icon: string; winRate?: number; games?: number }
  selectionGames?: number
  state: HeroFilter
  roles: readonly BuildEntry[]
  patch: string
  selectionWinRate?: number
  unformedStats?: { games: number; total: number } | null
  otherStats?: { games: number; heroGames: number; winRate: number } | null
}>()
const emit = defineEmits<{ change: [action: HeroFilterAction] }>()
const roleItems = ref<Record<string, DetailCell[]>>({})
const failedIcons = ref<Set<string>>(new Set())
watch(
  () => [props.patch, props.roles[0]?.championId, props.roles[0]?.snapshotId],
  async (_scope, _previous, onCleanup) => {
    let active = true
    onCleanup(() => {
      active = false
    })
    roleItems.value = {}
    failedIcons.value = new Set()
    const first = props.roles[0]
    if (!first || props.roles.every(role => role.nameItems)) return
    try {
      const detail = await loadBuildDetail(first.championId, props.patch, first.snapshotId)
      if (active)
        roleItems.value = Object.fromEntries(
          Object.entries(detail.roles).map(([role, row]) => [role, row.groups.items || []]),
        )
    } catch {
      /* Retain the readable name if matching item metadata is unavailable. */
    }
  },
  { immediate: true },
)
function iconsFor(option: BuildEntry) {
  if (option.nameItems) return option.nameItems.filter(item => !failedIcons.value.has(item.icon))
  const items = roleItems.value[option.role] || []
  const exact = items.find(item => item.name === option.label)
  const matches = exact
    ? [exact]
    : items
        .filter(item => option.label.includes(item.name))
        .sort((a, b) => option.label.indexOf(a.name) - option.label.indexOf(b.name))
  return matches.filter(item => item.icon && !failedIcons.value.has(item.icon))
}
function iconSlots(option: BuildEntry) {
  const icons = iconsFor(option)
  const names = option.nameItems?.map(item => item.name) || option.label.split('＋')
  return names.map((name, index) => ({
    name,
    icon: icons.find(item => item.name === name)?.icon,
    key: index,
  }))
}
const roleIconWidth = computed(
  () =>
    Math.max(
      1,
      ...props.roles.map(option => option.nameItems?.length || option.label.split('＋').length),
    ) *
      32 -
    4,
)
const selection = computed(() => props.state.item || props.state.rune)
const selectionKind = computed(() => (props.state.item ? '装备' : '符文'))
function clearSelection() {
  if (props.state.item) emit('change', { type: 'item', item: props.state.item })
  else if (props.state.rune) emit('change', { type: 'rune', rune: props.state.rune })
}
const mobileMenu = ref<HTMLDetailsElement | null>(null)
function mobileIconSlots(option: BuildEntry) {
  return [{ key: -1, name: props.hero.name, icon: props.hero.icon }, ...iconSlots(option)]
}
const runeSlots = computed(() =>
  props.state.rune
    ? [
        { key: 0, name: props.hero.name, icon: props.hero.icon },
        {
          key: 1,
          rune: true,
          name: gameName('augments', props.state.rune.id, props.patch, props.state.rune.name),
          icon: augmentIcon(props.state.rune.id, props.patch, props.state.rune.icon),
        },
      ]
    : [],
)
const runePickRate = computed(() =>
  props.hero.games && props.selectionGames !== undefined
    ? props.selectionGames / props.hero.games
    : 0,
)
const activeRole = computed(() => props.roles.find(role => role.role === props.state.role))
let menuAnimation: Animation | null = null,
  menuTargetOpen = false
function setMobileMenu(open: boolean) {
  const menu = mobileMenu.value,
    panel = menu?.querySelector<HTMLElement>('.mobile-role-options')
  if (!menu || !panel || (menuTargetOpen === open && menu.open === open)) return
  menuTargetOpen = open
  const previous = menu.open ? getComputedStyle(panel) : null
  const start = {
    opacity: previous?.opacity || '0',
    transform:
      previous?.transform === 'none'
        ? 'translateY(0px)'
        : previous?.transform || 'translateY(-8px)',
  }
  menuAnimation?.cancel()
  menuAnimation = null
  if (matchMedia('(prefers-reduced-motion:reduce)').matches) {
    menu.open = open
    return
  }
  menu.open = true
  const animation = panel.animate(
    [
      start,
      { opacity: open ? '1' : '0', transform: open ? 'translateY(0px)' : 'translateY(-8px)' },
    ],
    { duration: open ? 200 : 160, easing: 'cubic-bezier(.2,0,0,1)', fill: 'both' },
  )
  menuAnimation = animation
  animation.onfinish = () => {
    if (menuAnimation !== animation) return
    menu.open = open
    animation.cancel()
    menuAnimation = null
  }
}
function closeMobileMenu() {
  setMobileMenu(false)
}
function escapeMobileMenu() {
  closeMobileMenu()
  mobileMenu.value?.querySelector('summary')?.focus()
}
onUnmounted(() => menuAnimation?.cancel())
function chooseMobileRole(role: string) {
  closeMobileMenu()
  if (role) {
    if (role !== props.state.role) emit('change', { type: 'role', role })
  } else if (props.state.role) emit('change', { type: 'role', role: props.state.role })
  else if (selection.value) clearSelection()
}
function outsideMobileMenu(event: PointerEvent) {
  if (!mobileMenu.value?.contains(event.target as Node)) closeMobileMenu()
}
watch(() => [props.patch, props.roles[0]?.championId], closeMobileMenu)
onMounted(() => document.addEventListener('pointerdown', outsideMobileMenu))
onUnmounted(() => document.removeEventListener('pointerdown', outsideMobileMenu))
const rolePicker = ref<HTMLElement | null>(null)
const roleHighlight = ref<HTMLElement | null>(null)
let highlightFrame = 0,
  highlightReady = false
function syncRoleHighlight() {
  const picker = rolePicker.value,
    highlight = roleHighlight.value
  if (!picker || !highlight) return
  const selected = picker.querySelector<HTMLElement>('.role-choice[aria-current="true"]')
  if (!selected) {
    highlight.style.opacity = '0'
    return
  }
  // Coordinates belong to the scroll content, so the border follows horizontal
  // scrolling without a second scroll animation or affecting button layout.
  if (!highlightReady) highlight.style.transition = 'none'
  const selectedBox = selected.getBoundingClientRect(),
    pickerBox = picker.getBoundingClientRect()
  highlight.style.transform = `translate(${selectedBox.left - pickerBox.left + picker.scrollLeft}px,${selectedBox.top - pickerBox.top + picker.scrollTop}px)`
  highlight.style.width = selectedBox.width + 'px'
  highlight.style.height = selectedBox.height + 'px'
  highlight.style.opacity = '1'
  if (!highlightReady) {
    cancelAnimationFrame(highlightFrame)
    highlightFrame = requestAnimationFrame(() => {
      highlightReady = true
      highlight.style.removeProperty('transition')
    })
  }
}
const scrollLeft = ref(0),
  scrollLimit = ref(0),
  scrollThumb = ref(24)
let scrollObserver: ResizeObserver | undefined
function syncRoleScroll() {
  const el = rolePicker.value
  if (!el) return
  syncRoleHighlight()
  scrollLimit.value = Math.max(0, el.scrollWidth - el.clientWidth)
  scrollLeft.value = el.scrollLeft
  scrollThumb.value = Math.max(24, (el.clientWidth * el.clientWidth) / Math.max(1, el.scrollWidth))
}
function moveRoleScroll(event: Event) {
  if (rolePicker.value)
    rolePicker.value.scrollLeft = Number((event.target as HTMLInputElement).value)
}
onMounted(() => {
  scrollObserver = new ResizeObserver(syncRoleScroll)
  if (rolePicker.value) scrollObserver.observe(rolePicker.value)
  syncRoleScroll()
})
onUpdated(syncRoleScroll)
onUnmounted(() => {
  scrollObserver?.disconnect()
  cancelAnimationFrame(highlightFrame)
})
const pct = (v: number) => (v * 100).toFixed(1) + '%'
</script>
<template>
  <div
    class="hero-filter-controls"
    :class="{
      'has-previous-roles': scrollLeft > 1,
      'has-more-roles': scrollLimit - scrollLeft > 1,
    }"
  >
    <div
      ref="rolePicker"
      class="build-role-picker"
      :style="{ '--role-icons-width': roleIconWidth + 'px' }"
      @scroll="syncRoleScroll"
      role="group"
      :aria-label="t('筛选英雄出场')"
    >
      <details
        ref="mobileMenu"
        class="mobile-role-menu"
        @keydown.esc.stop.prevent="escapeMobileMenu"
      >
        <summary
          @click.prevent="setMobileMenu(!menuTargetOpen)"
          :aria-label="activeRole ? t('选择英雄流派') : t('全部出场，选择英雄流派')"
        >
          <RoleChoiceContent
            v-if="state.rune"
            show-win-label
            :slots="runeSlots"
            :games="selectionGames"
            :win-rate="selectionWinRate"
            :pick-rate="runePickRate"
          /><RoleChoiceContent
            show-win-label
            v-else-if="activeRole"
            :games="selectionGames ?? activeRole.games"
            :slots="mobileIconSlots(activeRole)"
            :win-rate="activeRole.winRate"
            :pick-rate="activeRole.pickRate"
            @icon-error="failedIcons.add($event)"
          /><RoleChoiceContent
            show-win-label
            v-else
            :games="hero.games"
            :slots="[{ key: 0, name: hero.name, icon: hero.icon }]"
            :win-rate="hero.winRate"
            :pick-rate="1"
            usage-text="100%"
          /><svg
            class="mobile-role-chevron"
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m4 6 4 4 4-4" />
          </svg>
        </summary>
        <div class="mobile-role-options" role="group" :aria-label="t('英雄流派')">
          <button
            type="button"
            :aria-pressed="!state.role && !state.rune"
            :aria-label="t('全部出场')"
            @click="chooseMobileRole('')"
          >
            <RoleChoiceContent
              show-win-label
              :games="hero.games"
              :slots="[{ key: 0, name: hero.name, icon: hero.icon }]"
              :win-rate="hero.winRate"
              :pick-rate="1"
              usage-text="100%"
            />
          </button>
          <button
            v-if="state.rune"
            type="button"
            aria-pressed="true"
            :aria-label="gameName('augments', state.rune.id, patch, state.rune.name)"
            @click="closeMobileMenu()"
          >
            <RoleChoiceContent
              show-win-label
              :slots="runeSlots"
              :games="selectionGames"
              :win-rate="selectionWinRate"
              :pick-rate="runePickRate"
            />
          </button>
          <button
            v-for="option in roles"
            :key="option.id"
            type="button"
            :aria-pressed="state.role === option.role"
            :aria-label="
              message('{p0}，胜率 {p1}，使用率 {p2}', {
                p0: roleName(option, patch),
                p1: pct(option.winRate),
                p2: pct(option.pickRate),
              })
            "
            @click="chooseMobileRole(option.role)"
          >
            <RoleChoiceContent
              show-win-label
              :games="option.games"
              :slots="mobileIconSlots(option)"
              :win-rate="option.winRate"
              :pick-rate="option.pickRate"
              @icon-error="failedIcons.add($event)"
            />
          </button>
        </div>
      </details>
      <span ref="roleHighlight" class="role-selection-border" aria-hidden="true"></span>
      <DetailLink
        v-for="option in roles"
        :key="option.id"
        :href="buildDetailUrl(option.championId, option.role, patch)"
        :aria-current="state.role === option.role ? 'true' : undefined"
        class="filter-choice role-choice"
        :class="{ 'is-selected': state.role === option.role }"
        :title="
          roleName(option, patch) +
          ' · ' +
          (state.role === option.role ? t('再次点击，取消流派筛选') : t('筛选该流派'))
        "
        :aria-label="
          message('{p0}，使用率 {p1}，胜率 {p2}', {
            p0: roleName(option, patch),
            p1: pct(option.pickRate),
            p2: pct(option.winRate),
          })
        "
        @activate="emit('change', { type: 'role', role: option.role })"
      >
        <RoleChoiceContent
          :slots="iconSlots(option)"
          :win-rate="option.winRate"
          :pick-rate="option.pickRate"
          :usage-title="
            option.heroGames
              ? message('流派出场率：{p0} / {p1}{p2}', {
                  p0: formatCount(option.games),
                  p1: formatCount(option.eligibleGames ?? option.heroGames),
                  p2:
                    option.eligibleGames === undefined
                      ? t(' 次英雄全部出场')
                      : t(' 次至少2件成装的出场'),
                })
              : undefined
          "
          @icon-error="failedIcons.add($event)"
        />
      </DetailLink>
      <button
        v-if="selection"
        class="filter-choice is-selected selected-rune"
        :class="{ 'mobile-rune-selection': !!state.rune }"
        type="button"
        :aria-label="
          message('取消{p0}筛选：{p1}{p2}', {
            p0: selectionKind,
            p1: gameName(state.item ? 'items' : 'augments', selection.id, patch, selection.name),
            p2:
              selectionWinRate === undefined
                ? ''
                : message('，胜率 {p0}', { p0: pct(selectionWinRate) }),
          })
        "
        @click="clearSelection"
      >
        <span class="role-item-icons" aria-hidden="true"
          ><span class="role-item-slot"
            ><img
              v-if="selection.icon"
              :src="state.item ? selection.icon : augmentIcon(selection.id, patch, selection.icon)"
              alt=""
              width="28"
              height="28" /><span v-else class="role-item-placeholder"></span></span></span
        ><span class="role-choice-stats"
          ><strong
            class="role-choice-win"
            :style="{
              color: selectionWinRate === undefined ? undefined : winRateColor(selectionWinRate),
            }"
            >{{ selectionWinRate === undefined ? '—' : pct(selectionWinRate) }}</strong
          ><small
            class="selected-rune-name"
            :title="
              gameName(state.item ? 'items' : 'augments', selection.id, patch, selection.name)
            "
            >{{
              gameName(state.item ? 'items' : 'augments', selection.id, patch, selection.name)
            }}</small
          ></span
        >
      </button>
    </div>
    <input
      v-if="scrollLimit > 0"
      class="role-scrollbar"
      type="range"
      min="0"
      :max="scrollLimit"
      :value="scrollLeft"
      :style="{ '--scroll-thumb-width': scrollThumb + 'px' }"
      :aria-label="t('横向滚动流派按钮')"
      @input="moveRoleScroll"
    />
  </div>
</template>
<style scoped>
.hero-filter-controls {
  position: relative;
  min-width: 0;
}
@media (min-width: 701px) {
  .hero-filter-controls::before,
  .hero-filter-controls::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    width: 20px;
    max-width: 25%;
    z-index: 2;
    pointer-events: none;
    opacity: 0;
    transition: opacity 120ms ease;
  }
  .hero-filter-controls::before {
    left: 0;
    background: linear-gradient(to right, var(--detail-edge-shadow), transparent);
  }
  .hero-filter-controls::after {
    right: 0;
    background: linear-gradient(to left, var(--detail-edge-shadow), transparent);
  }
  .hero-filter-controls.has-previous-roles::before,
  .hero-filter-controls.has-more-roles::after {
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .hero-filter-controls::before,
  .hero-filter-controls::after {
    transition: none;
  }
}
.mobile-role-menu {
  display: none;
}
.build-role-picker {
  position: relative;
  flex-wrap: nowrap;
  overflow-x: auto;
  max-width: 100%;
  padding-bottom: 0;
  scrollbar-width: none;
}
.build-role-picker::-webkit-scrollbar {
  display: none;
}
.role-scrollbar {
  position: absolute;
  left: 0;
  bottom: -7px;
  width: 100%;
  height: 6px;
  margin: 0;
  padding: 0;
  border: 0;
  appearance: none;
  background: transparent;
  opacity: 0;
  transition: opacity 0.15s;
  cursor: ew-resize;
  z-index: 1;
}
.hero-filter-controls:hover .role-scrollbar,
.hero-filter-controls:focus-within .role-scrollbar {
  opacity: 1;
}
.role-scrollbar::-webkit-slider-runnable-track {
  height: 6px;
  background: transparent;
}
.role-scrollbar::-webkit-slider-thumb {
  appearance: none;
  width: var(--scroll-thumb-width);
  height: 6px;
  border: 0;
  border-radius: 3px;
  background: var(--border-strong);
}
.role-scrollbar::-moz-range-track {
  height: 6px;
  background: transparent;
}
.role-scrollbar::-moz-range-thumb {
  width: var(--scroll-thumb-width);
  height: 6px;
  border: 0;
  border-radius: 3px;
  background: var(--border-strong);
}
.role-scrollbar:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
@media (hover: none) {
  .role-scrollbar {
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .role-scrollbar {
    transition: none;
  }
}
.role-item-icons {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: none;
  width: var(--role-icons-width);
}
.role-item-slot {
  display: block;
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
}
.role-item-placeholder {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 3px;
  background: var(--chip);
  border: 1px solid var(--border);
}
.role-item-icons img {
  display: block;
  width: 28px;
  height: 28px;
  object-fit: contain;
  border-radius: 3px;
}
.filter-choice {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex: 0 0 auto;
}
.role-choice {
  gap: 8px;
}
.build-role-picker .role-choice[aria-current='true'] {
  border-color: var(--border-strong);
}
.role-selection-border {
  position: absolute;
  left: 0;
  top: 0;
  pointer-events: none;
  z-index: 1;
  box-sizing: border-box;
  border: 1px solid var(--accent);
  border-radius: 6px;
  opacity: 0;
  transition:
    transform 220ms cubic-bezier(0.2, 0, 0, 1),
    width 220ms cubic-bezier(0.2, 0, 0, 1),
    height 220ms cubic-bezier(0.2, 0, 0, 1),
    opacity 140ms ease-out;
}
@media (prefers-reduced-motion: reduce) {
  .role-selection-border {
    transition: none;
  }
}
.role-choice-stats {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  flex: none;
  width: calc(4em + 6ch);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.role-choice-win {
  font-size: 16px;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}
.build-role-picker .role-choice-stats small {
  margin: 0;
  font-size: 12px;
  line-height: 1.2;
  color: var(--muted);
}
.selected-rune {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 6px 10px;
  border: 1px solid var(--accent);
  border-radius: 6px;
  background: var(--surface);
  color: var(--accent-text);
  font-size: 12px;
  cursor: pointer;
  min-width: 0;
  max-width: 200px;
}
.selected-rune-name {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.selected-rune img {
  flex: none;
  object-fit: contain;
}
button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
@media (max-width: 700px) {
  .build-role-picker .mobile-rune-selection {
    display: none !important;
  }
  .build-role-picker {
    align-items: stretch;
    flex-wrap: wrap;
    overflow: visible;
  }
  .build-role-picker .role-choice,
  .role-selection-border,
  .role-scrollbar {
    display: none !important;
  }
  .mobile-role-menu {
    display: block;
    position: relative;
    flex: 1 1 100%;
    min-width: 0;
    color: var(--text);
  }
  .mobile-role-menu summary,
  .mobile-role-options button {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 48px;
    width: 100%;
    padding: 8px 10px;
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    background: var(--surface);
    color: var(--text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .mobile-role-menu :deep(.role-item-icons) {
    width: auto;
    flex-shrink: 1;
    min-width: 0;
    flex-wrap: wrap;
  }
  .mobile-role-menu :deep(.role-choice-stats) {
    margin-left: auto;
    align-items: flex-end;
    text-align: right;
    width: auto;
  }
  .mobile-role-menu :deep(.role-item-slot) {
    flex-basis: 40px;
    width: 40px;
    height: 40px;
  }
  .mobile-role-menu :deep(.role-item-slot img) {
    width: 40px;
    height: 40px;
  }
  .mobile-role-menu :deep(.role-item-slot:not(:first-child)) {
    flex-basis: 32px;
    width: 32px;
    height: 32px;
  }
  .mobile-role-menu :deep(.role-item-slot:not(:first-child) img) {
    width: 32px;
    height: 32px;
  }
  .mobile-role-menu :deep(.role-item-slot.is-rune) {
    flex-basis: 40px;
    width: 40px;
    height: 40px;
  }
  .mobile-role-menu :deep(.role-item-slot.is-rune img) {
    width: 40px;
    height: 40px;
  }
  .mobile-role-menu summary {
    position: relative;
    list-style: none;
    padding-right: 36px;
  }
  .mobile-role-menu summary::-webkit-details-marker {
    display: none;
  }
  .mobile-role-menu summary:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .mobile-role-chevron {
    position: absolute;
    right: 10px;
    top: calc(50% - 8px);
    width: 16px;
    height: 16px;
    color: var(--muted);
    transform-origin: 50% 50%;
    pointer-events: none;
  }
  .mobile-role-menu[open] .mobile-role-chevron {
    transform: rotate(180deg);
  }
  .mobile-role-options {
    position: absolute;
    top: calc(100% + 4px);
    inset-inline: 0;
    z-index: 20;
    display: grid;
    gap: 4px;
    max-height: min(360px, 50dvh);
    overflow-y: auto;
    padding: 4px;
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    background: var(--card);
    box-shadow: var(--shadow);
  }
  .mobile-role-options button[aria-pressed='true'] {
    border-color: var(--accent);
  }
  .build-role-picker :is(a, .selected-rune) {
    display: flex;
    flex-direction: row;
    justify-content: center;
    min-width: 0;
    padding: 5px 8px;
    text-align: left;
    font-size: 12px;
  }
  .build-role-picker small {
    display: block;
    margin-left: 0;
    font-size: 9px;
    white-space: nowrap;
  }
}
</style>
