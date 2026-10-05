import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadTS } from './load-ts.mjs'
const { runeChartPoints, runeChartTotal, runeChartOption, runePointDescription, runeRateRange } =
  await loadTS('../src/runeChart.ts')
const { locale } = await loadTS('../src/locale.ts')
locale.value = 'zh-CN'
const theme = {
  count: '#98bca8',
  rate: '#f5d780',
  text: '#9aa0a6',
  grid: '#333',
  surface: '#242930',
  font: 'sans-serif',
}
const point = (slot, games, winRate, lowSample = false) => ({
  slot,
  games,
  winRate,
  lowSample,
  wins: 0,
  interval: [0.4, 0.6],
})

test('only first four selections count toward the one-percent threshold', () => {
  const points = runeChartPoints([
    point(5, 900, 0.9),
    point(2, 1, 0.6, true),
    point(1, 98, 0.5),
    point(3, 1, 0.4, true),
  ])
  assert.deepEqual(
    points.map(p => p.slot),
    [1, 2, 3],
  )
  assert.equal(runeChartTotal(points), 100)
  const option = runeChartOption(points, 0.55, theme)
  assert.equal(option.series[1].data[1].value, 0.6)
  assert.equal(option.series[1].data[1].symbol, 'emptyCircle')
  assert.equal(option.series[1].markLine.data[0].yAxis, 0.55)
})

test('low share and zero records produce gaps without altering count data', () => {
  const points = [
    point(1, 100, 0.5),
    point(2, 1, 0.9, true),
    point(3, 0, null),
    point(4, 100, 0.51),
  ]
  const option = runeChartOption(points, 0.55, theme)
  assert.deepEqual(option.series[0].data, [100, 1, 0, 100])
  assert.equal(option.series[1].connectNulls, false)
  assert.deepEqual(option.series[1].data.slice(1, 3), [null, null])
  assert.equal(option.series[2].data[1], null)
  assert.match(runePointDescription(points[1], 201), /占比不足 1%/)
  assert.doesNotMatch(runePointDescription(points[1], 201), /区间|40.0%–60.0%/)
})

test('out-of-range data stay raw with boundary arrows; axes and baseline stay independent', () => {
  const option = runeChartOption([point(1, 100, 0.8), point(2, 100, 0.2)], 0.55, theme)
  assert.equal(option.yAxis[1].min, 0.45)
  assert.equal(option.yAxis[1].max, 0.65)
  assert.deepEqual(
    option.series[1].data.map(p => p.value),
    [0.8, 0.2],
  )
  assert.deepEqual(
    option.series[2].data.map(p => [p.value, p.symbol, p.symbolRotate]),
    [
      [0.65, 'triangle', 0],
      [0.45, 'triangle', 180],
    ],
  )
  assert.equal(option.series[1].markLine.data[0].yAxis, 0.55)
  const tooltip = option.tooltip.formatter([{ dataIndex: 0 }])
  assert.match(tooltip, /80.0%/)
})

test('empty data and version updates remove old series instead of inventing rates', () => {
  const empty = runeChartOption([], 0, theme)
  assert.ok(empty.yAxis[0].max > 0)
  assert.deepEqual(empty.series[1].data, [])
  assert.deepEqual(empty.series[1].markLine.data, [{ yAxis: 0 }])
  const missing = runeChartOption([point(1, 0, null)], 0.5, theme)
  assert.equal(missing.series[1].data[0], null)
})

test('rate range spans twenty points around the nearest five-percent baseline tick', () => {
  for (const [baseline, min, max] of [
    [0.52, 0.4, 0.6],
    [0.5249, 0.4, 0.6],
    [0.525, 0.45, 0.65],
    [0.53, 0.45, 0.65],
    [0.575, 0.5, 0.7],
    [0.47, 0.35, 0.55],
  ]) {
    assert.deepEqual(runeRateRange(baseline), { min, max })
    const option = runeChartOption([point(1, 100, baseline)], baseline, theme)
    assert.equal(option.yAxis[1].min, min)
    assert.equal(option.yAxis[1].max, max)
    assert.equal(option.series[1].markLine.data[0].yAxis, baseline)
  }
})

test('new boundaries retain exact endpoints and show arrows only beyond the range', () => {
  const option = runeChartOption(
    [point(1, 100, 0.4), point(2, 100, 0.6), point(3, 100, 0.399), point(4, 100, 0.601)],
    0.52,
    theme,
  )
  assert.deepEqual(
    option.series[1].data.map(p => p.symbol),
    ['circle', 'circle', 'none', 'none'],
  )
  assert.deepEqual(option.series[2].data.slice(0, 2), [null, null])
  assert.deepEqual(
    option.series[2].data.slice(2).map(p => [p.value, p.symbolRotate]),
    [
      [0.4, 180],
      [0.6, 0],
    ],
  )
})
