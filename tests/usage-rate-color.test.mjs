import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadTS } from './load-ts.mjs'
const { usageRateColor } = await loadTS('../src/usageRateColor.ts')
test('zero through half a percent, missing and invalid usage retain muted text', () => {
  for (const value of [0, 0.001, 0.00499, 0.005, -0.1, null, undefined, NaN, Infinity])
    assert.equal(usageRateColor(value), 'var(--muted)')
})
test('usage interpolates continuously to full yellow at five percent and then caps', () => {
  for (const [value, strength] of [
    [0.005001, 0.002222],
    [0.0095, 10],
    [0.014, 20],
    [0.0275, 50],
    [0.0455, 90],
    [0.05, 100],
    [0.5, 100],
  ])
    assert.equal(
      usageRateColor(value),
      `color-mix(in oklab, var(--muted), var(--usage-yellow) ${strength}%)`,
    )
})
