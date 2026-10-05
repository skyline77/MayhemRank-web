import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadTS } from './load-ts.mjs'
const { formatCount } = await loadTS('../src/stats/formatCount.ts')
test('weighted counts round only for display, with grouping and unavailable values', () => {
  assert.equal(formatCount(463.833), '464')
  assert.equal(formatCount(463.4), '463')
  assert.equal(formatCount(999.5), '1,000')
  assert.equal(formatCount(123456.5), '123,457')
  assert.equal(formatCount(0), '0')
  assert.equal(formatCount(undefined), '—')
  assert.equal(formatCount(NaN), '—')
})
