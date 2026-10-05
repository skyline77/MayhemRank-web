import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadTS } from './load-ts.mjs'
const { winRateColor } = await loadTS('../src/winRateColor.ts')
const { winRateBandInk } = await loadTS('../src/winRateTable.ts')
const { runePatchChange, runeCardTrend } = await loadTS('../src/runeComparison.ts')
const strength = color => Number(color.match(/ ([\d.]+)%\)$/)?.[1] || 0)

test('inclusive one-point neutral interval works for arbitrary baselines', () => {
  for (const baseline of [0.5, 0.468, 0.59]) {
    for (const offset of [-0.01, -0.009, 0, 0.009, 0.01])
      assert.equal(winRateColor(baseline + offset, baseline), 'var(--text)')
    assert.match(winRateColor(baseline + 0.010001, baseline), /positive/)
    assert.match(winRateColor(baseline - 0.010001, baseline), /negative/)
  }
  assert.equal(winRateColor(0.53), winRateColor(0.53, 0.5))
})
test('one continuous symmetric scale follows distance from baseline and caps at six points', () => {
  let last = 0
  for (const delta of [0.011, 0.02, 0.03, 0.04, 0.05, 0.06]) {
    const positive = winRateColor(0.5 + delta),
      negative = winRateColor(0.5 - delta)
    assert.ok(strength(positive) > last)
    assert.equal(strength(positive), strength(negative))
    assert.equal(positive, winRateColor(0.59 + delta, 0.59))
    assert.equal(negative, winRateColor(0.468 - delta, 0.468))
    last = strength(positive)
  }
  assert.equal(last, 100)
  assert.equal(winRateColor(1), winRateColor(0.56))
  assert.equal(winRateColor(0), winRateColor(0.44))
})
test('color uses unrounded rates and invalid or absent values stay neutral', () => {
  assert.equal(winRateColor(0.51), 'var(--text)')
  assert.notEqual(winRateColor(0.5101), 'var(--text)')
  for (const value of [null, undefined, NaN, Infinity])
    assert.equal(winRateColor(value), 'var(--text)')
  assert.equal(winRateColor(0.55, NaN), 'var(--text)')
})
test('range labels and version comparisons delegate to the same scale', () => {
  assert.equal(winRateBandInk(52, 54), winRateColor(0.53))
  assert.equal(winRateBandInk(48, 50), 'var(--text)')
  assert.equal(winRateBandInk(50, 52), 'var(--text)')
  for (const [value, baseline] of [
    [0.55, 0.5],
    [0.48, 0.54],
    [0.51, 0.5],
    [0.5301, 0.5],
  ]) {
    assert.equal(runePatchChange(value, baseline).color, winRateColor(value, baseline))
    const arrow = runeCardTrend(value, baseline)
    if (arrow) assert.equal(arrow.color, winRateColor(value, baseline))
  }
})
