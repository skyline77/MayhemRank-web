import { message } from './i18n'
import { formatCount } from './formatCount'
import type { RuneHero } from './runeHeroes'
export const DEFAULT_RUNE_HERO_MIN_GAMES = 50
export type ChartHero = RuneHero & { sameRaritySelections: number; sameRarityPickRate: number }
export function chartHeroes(
  entries: readonly RuneHero[],
  minimum = DEFAULT_RUNE_HERO_MIN_GAMES,
): ChartHero[] {
  return entries
    .filter(
      (e): e is ChartHero =>
        e.games >= minimum &&
        Number.isInteger(e.sameRaritySelections) &&
        e.sameRaritySelections! >= e.games &&
        Number.isFinite(e.sameRarityPickRate) &&
        Math.abs(e.games / e.sameRaritySelections! - e.sameRarityPickRate!) < 1e-10,
    )
    .sort((a, b) => a.sameRarityPickRate - b.sameRarityPickRate || Number(a.id) - Number(b.id))
}
export function heroChartBounds(entries: readonly ChartHero[]) {
  const rates = entries.flatMap(e => [e.baseline.winRate, e.winRate])
  return {
    xMax: Math.min(
      1,
      Math.max(
        0.05,
        Math.ceil(((Math.max(0, ...entries.map(e => e.sameRarityPickRate)) + 0.015) * 100) / 5) *
          0.05,
      ),
    ),
    yMin: Math.max(0, Math.floor((Math.min(0.5, ...rates) - 0.025) * 20) / 20),
    yMax: Math.min(1, Math.ceil((Math.max(0.5, ...rates) + 0.025) * 20) / 20),
  }
}
export function overlappingHeroes(
  points: readonly (readonly number[])[],
  index: number,
  distance = 36,
) {
  const origin = points[index]
  if (!origin) return []
  return points
    .map((p, i) => ({ p, i }))
    .filter(
      ({ p }) =>
        Math.abs(p[0]! - origin[0]!) <= distance && Math.abs(p[1]! - origin[1]!) <= distance,
    )
    .map(({ i }) => i)
}
export function heroArrowDescription(hero: ChartHero) {
  const pct = (n: number) => (n * 100).toFixed(1) + '%'
  return message(
    '{p0}：同品质选用率 {p1}（{p2} / {p3} 次）。总体胜率 {p4} → 选用后 {p5}；Δ胜率 {p6} 个百分点。',
    {
      p0: hero.name,
      p1: pct(hero.sameRarityPickRate),
      p2: formatCount(hero.games),
      p3: formatCount(hero.sameRaritySelections),
      p4: pct(hero.baseline.winRate),
      p5: pct(hero.winRate),
      p6: (hero.delta > 0 ? '+' : '') + (hero.delta * 100).toFixed(1),
    },
  )
}
