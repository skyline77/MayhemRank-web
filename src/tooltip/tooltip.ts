import { shallowRef } from 'vue'
import type { TooltipSide } from './tooltipPosition'
export interface TipData {
  onFilter?: () => void
  id: string
  kind: 'items' | 'augments' | 'spells'
  name: string
  icon: string
  patch: string
  rarity?: string
  winRate: number
  pickRate: number
  games: number
  rawWinRate: number
  interval: number[]
  baseline: number
  context: string
  baselineLabel?: string
  wikiTranslation?: boolean
  preferredSide?: TooltipSide
  pickLabel?: string
  lowSample?: boolean
  heroIds?: string[]
  heroCount?: number
  statisticsNote?: string
  missingStatistics?: string
}
export const activeTip = shallowRef<{ anchor: HTMLElement; data: TipData; pinned: boolean } | null>(
  null,
)
let hideTimer: ReturnType<typeof setTimeout> | undefined
let showTimer: ReturnType<typeof setTimeout> | undefined
export function keepTip() {
  clearTimeout(hideTimer)
  clearTimeout(showTimer)
}
export function closeTip() {
  keepTip()
  activeTip.value = null
}
export function showTip(event: Event, data: TipData) {
  keepTip()
  const anchor = event.currentTarget as HTMLElement
  if (activeTip.value?.anchor === anchor) return
  // A different card gets its own dwell time; never display the previous card's data.
  activeTip.value = null
  const reveal = () => {
    if (anchor.isConnected) activeTip.value = { anchor, data, pinned: false }
  }
  if (event.type === 'mouseenter' || event.type === 'pointerenter')
    showTimer = setTimeout(reveal, 500)
  else reveal()
}
export function toggleTip(event: Event, data: TipData) {
  const anchor = event.currentTarget as HTMLElement
  if (activeTip.value?.anchor === anchor && activeTip.value.pinned) {
    closeTip()
    return
  }
  keepTip()
  activeTip.value = { anchor, data, pinned: true }
}
export function hideTip() {
  keepTip()
  if (!activeTip.value?.pinned) hideTimer = setTimeout(closeTip, 120)
}
