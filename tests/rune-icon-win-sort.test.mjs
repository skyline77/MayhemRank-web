import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { loadTS } from './load-ts.mjs'
const { sortRuneFamiliesByWinRate: sort } = await loadTS('../src/details/rune/runeVisualSort.ts')
const { families } = JSON.parse(
  readFileSync(new URL('../src/details/rune/runeVisualFamilies.json', import.meta.url)),
)
const [a, b] = families.filter(f => f.ids.length > 1).map(f => f.ids)
const cell = (id, winRate, games = 100) => ({ id, winRate, games, pickRate: 0.01 })
test('family order uses best eligible win rate and keeps members together without mutation', () => {
  const input = [cell(a[1], 0.51), cell(b[0], 0.6), cell(a[0], 0.7), cell(b[1], 0.55)],
    before = structuredClone(input)
  assert.deepEqual(
    sort(input).map(c => c.id),
    [a[0], a[1], b[0], b[1]],
  )
  assert.deepEqual(input, before)
})
test('low sample outliers do not promote a family', () => {
  const input = [cell(a[0], 0.99, 3), cell(a[1], 0.51), cell(b[0], 0.6)]
  assert.deepEqual(
    sort(input).map(c => c.id),
    [b[0], a[1], a[0]],
  )
})
