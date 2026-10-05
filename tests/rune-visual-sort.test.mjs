import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { loadTS } from './load-ts.mjs'
const { sortRuneVisualFamilies } = await loadTS('../src/runeVisualSort.ts')
const sort = (cells, reference = cells) => sortRuneVisualFamilies(cells, reference)
const config = JSON.parse(
  readFileSync(new URL('../src/runeVisualFamilies.json', import.meta.url), 'utf8'),
)
const [a, b, c] = config.families
  .filter(f => f.ids.length >= 2)
  .slice(0, 3)
  .map(f => f.ids)
const cell = (id, pickRate, games = 100, winRate = 0.5) => ({ id, pickRate, games, winRate })
test('highest individual usage orders families; repeated family is skipped and members stay descending', () => {
  const input = [
    cell(c[0], 0.1),
    cell(b[1], 0.11),
    cell(a[1], 0.01),
    cell(b[0], 0.12),
    cell(a[0], 0.137),
  ]
  const original = structuredClone(input)
  assert.deepEqual(
    sort(input).map(c => c.id),
    [a[0], a[1], b[0], b[1], c[0]],
  )
  assert.deepEqual(input, original)
})
test('filter changes determine family order; win rate and sample-floor flags do not override usage', () => {
  assert.deepEqual(
    sort([cell(a[0], 0.1, 1000, 0.99), cell(b[0], 0.2, 12, 0.1)]).map(c => c.id),
    [b[0], a[0]],
  )
  assert.deepEqual(
    sort([cell(a[0], 0.3), cell(b[0], 0.2)]).map(c => c.id),
    [a[0], b[0]],
  )
})
test('unknown icons stay independent and participate by usage; equal usage is deterministic', () => {
  const input = [cell('999999', 0.5, 10), cell(a[0], 0.3), cell('999998', 0.5, 10)]
  assert.deepEqual(
    sort(input).map(c => c.id),
    ['999998', '999999', a[0]],
  )
  assert.deepEqual(sort([...input].reverse()), sort(input))
  assert.deepEqual(sort([]), [])
})

test('role usage cannot change all-appearance ordering or overwrite displayed statistics', () => {
  const all = [cell(a[0], 0.5), cell(a[1], 0.1), cell(b[0], 0.4)]
  const role = [cell(b[0], 0.99), cell(a[1], 0.8), cell(a[0], 0.01)]
  assert.deepEqual(sort(role, all), [role[2], role[1], role[0]])
  assert.equal(sort(role, all)[0], role[2])
  assert.deepEqual(sort(role.slice(0, 2), all), [role[1], role[0]])
  const other = [cell(b[0], 0.01), cell(a[1], 0.2), cell(a[0], 0.9)]
  assert.deepEqual(
    sort(other, all).map(c => c.id),
    sort(role, all).map(c => c.id),
  )
  assert.deepEqual(
    sort([cell('999999', 1), cell(a[0], 0)], all).map(c => c.id),
    [a[0], '999999'],
  )
})
