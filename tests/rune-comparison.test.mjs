import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadTS } from './load-ts.mjs'
const { locale } = await loadTS('../src/locale.ts')
locale.value = 'zh-CN'
const { previousRunePatch, runePatchChange, runeCardTrend } = await loadTS(
  '../src/runeComparison.ts',
)
test('previous patch is numeric, earlier and handles missing history', () => {
  assert.equal(previousRunePatch('16.19', ['16.9', '16.18', '16.20']), '16.18')
  assert.equal(previousRunePatch('17.1', ['16.24', '16.9']), '16.24')
  assert.equal(previousRunePatch('16.18', ['16.18', '16.19']), undefined)
})
test('neutral threshold includes both one-point boundaries without negative zero', () => {
  for (const old of [0.49, 0.5, 0.51]) assert.equal(runePatchChange(0.5, old).color, 'var(--text)')
  assert.equal(runePatchChange(0.5, 0.50001).label, '±0.0%')
  assert.equal(runePatchChange(0.577, 0.581).label, '-0.4%')
})
test('increases beyond one point get progressively greener and saturate', () => {
  assert.match(runePatchChange(0.511, 0.5).color, /var\(--win-positive-3\) 2%/)
  assert.match(runePatchChange(0.53, 0.5).color, /var\(--win-positive-3\) 40%/)
  assert.match(runePatchChange(0.7, 0.5).color, /var\(--win-positive-3\) 100%/)
})

test('decreases beyond one point get progressively redder and saturate', () => {
  assert.match(runePatchChange(0.489, 0.5).color, /var\(--win-negative-3\) 2%/)
  assert.match(runePatchChange(0.47, 0.5).color, /var\(--win-negative-3\) 40%/)
  assert.match(runePatchChange(0.3, 0.5).color, /var\(--win-negative-3\) 100%/)
  assert.equal(runePatchChange(0.47, 0.5).label, '-3.0%')
})

test('card arrows use strict two and four point boundaries in both directions', () => {
  for (const current of [0.48, 0.5, 0.52]) assert.equal(runeCardTrend(current, 0.5), null)
  for (const [current, symbol, tone] of [
    [0.5201, '↑', 'up'],
    [0.54, '↑', 'up'],
    [0.5401, '↑↑', 'up-strong'],
    [0.4799, '↓', 'down'],
    [0.46, '↓', 'down'],
    [0.4599, '↓↓', 'down-strong'],
  ]) {
    assert.equal(runeCardTrend(current, 0.5).symbol, symbol)
    assert.equal(runeCardTrend(current, 0.5).tone, tone)
  }
})
test('new runes and missing or invalid history do not get arrows', () => {
  assert.equal(runeCardTrend(0.55), null)
  assert.equal(runeCardTrend(0.55, NaN), null)
  assert.equal(runeCardTrend(Infinity, 0.5), null)
})
