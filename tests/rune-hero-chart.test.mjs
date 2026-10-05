import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadTS } from './load-ts.mjs'
const { locale } = await loadTS('../src/i18n/locale.ts')
locale.value = 'zh-CN'
const { chartHeroes, heroChartBounds, overlappingHeroes, heroArrowDescription } = await loadTS(
  '../src/details/rune/runeHeroChart.ts',
)
const hero = (id, games, winRate = 0.6, baseline = 0.5) => ({
  id,
  name: '英雄' + id,
  icon: '/role-portraits/' + id + '.png',
  games,
  winRate,
  baseline: { games: 500, winRate: baseline },
  sameRaritySelections: 1000,
  sameRarityPickRate: games / 1000,
  delta: winRate - baseline,
  interval: [0.45, 0.65],
})
test('default fifty-game floor leaves the full rarity denominator unchanged', () => {
  const rows = [hero('1', 49), hero('2', 50), hero('3', 100)]
  assert.deepEqual(
    chartHeroes(rows).map(e => e.id),
    ['2', '3'],
  )
  assert.deepEqual(
    chartHeroes(rows, 100).map(e => e.id),
    ['3'],
  )
  assert.equal(chartHeroes(rows)[0].sameRarityPickRate, 0.05)
  assert.equal(rows[0].games, 49)
})
test('missing or contradictory rarity denominators never fall back to appearance pick rate', () => {
  assert.equal(
    chartHeroes([{ ...hero('1', 100), sameRaritySelections: undefined, pickRate: 0.2 }]).length,
    0,
  )
  assert.equal(chartHeroes([{ ...hero('1', 100), sameRarityPickRate: 0.5 }]).length, 0)
})
test('axes include both endpoints, padded to round ticks; description retains exact counts', () => {
  const entries = [hero('1', 50, 0.35, 0.7), hero('2', 700, 0.62, 0.55)]
  const bounds = heroChartBounds(entries)
  assert.ok(bounds.yMin < 0.35 && bounds.yMax > 0.7 && bounds.xMax > 0.7)
  assert.match(heroArrowDescription(entries[0]), /50 \/ 1,000/)
  assert.match(heroArrowDescription(entries[0]), /70.0% → 选用后 35.0%/)
})
test('overlap candidates use pixel distances and do not move the input coordinates', () => {
  const pixels = [
    [10, 20],
    [30, 30],
    [80, 20],
    [10, 80],
  ]
  assert.deepEqual(overlappingHeroes(pixels, 0), [0, 1])
  assert.deepEqual(overlappingHeroes(pixels, -1), [])
  assert.deepEqual(pixels[0], [10, 20])
})
