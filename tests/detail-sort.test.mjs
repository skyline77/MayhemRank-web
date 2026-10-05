import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadTS } from './load-ts.mjs'
const { sortDetailCells } = await loadTS('../src/detailSort.ts')
const { visibleSpellPairs } = await loadTS('../src/spellBuilds.ts')
const cell = (id, pickRate, winRate, games = 100) => ({ id, pickRate, winRate, games })

test('sorts unrounded rates descending without mutating cached input; ties are stable', () => {
  const cells = [
    cell('popular', 0.8, 0.54),
    cell('winner', 0.1, 0.59004),
    cell('near', 0.2, 0.59001),
    cell('tie-b', 0.2, 0.54),
    cell('tie-a', 0.2, 0.54),
  ]
  const original = cells.map(c => c.id)
  assert.deepEqual(
    sortDetailCells(cells, 'winRate').map(c => c.id),
    ['winner', 'near', 'popular', 'tie-a', 'tie-b'],
  )
  assert.deepEqual(
    sortDetailCells(cells, 'winRateAsc').map(c => c.id),
    ['popular', 'tie-a', 'tie-b', 'near', 'winner'],
  )
  assert.deepEqual(
    sortDetailCells(cells, 'pickRate').map(c => c.id),
    ['popular', 'near', 'tie-a', 'tie-b', 'winner'],
  )
  assert.deepEqual(
    cells.map(c => c.id),
    original,
  )
  assert.deepEqual(sortDetailCells([], 'winRate'), [])
})

test('spell sorting cannot add excluded pairs or change the minimum-three membership', () => {
  const pairs = [
    cell('a', 0.9, 0.5),
    cell('b', 0.09, 0.6),
    cell('c', 0.004, 0.7),
    cell('excluded', 0.003, 1),
  ]
  const shown = visibleSpellPairs(pairs)
  assert.deepEqual(
    sortDetailCells(shown, 'winRate').map(c => c.id),
    ['c', 'b', 'a'],
  )
  assert.deepEqual(
    sortDetailCells(shown, 'winRateAsc').map(c => c.id),
    ['a', 'b', 'c'],
  )
  assert.deepEqual(
    sortDetailCells(shown, 'pickRate').map(c => c.id),
    ['a', 'b', 'c'],
  )
  assert.equal(
    sortDetailCells(shown, 'winRate').some(c => c.id === 'excluded'),
    false,
  )
})

test('hero delta sorting uses full precision and keeps small samples last in both directions', () => {
  const cells = [
    { ...cell('low', 0.1, 0.99, 19), delta: 0.49 },
    { ...cell('a', 0.5, 0.6, 20), delta: 0.10004 },
    { ...cell('b', 0.5, 0.7, 80), delta: 0.10001 },
  ]
  assert.deepEqual(
    sortDetailCells(cells, 'winRate', true).map(c => c.id),
    ['b', 'a', 'low'],
  )
  assert.deepEqual(
    sortDetailCells(cells, 'winRateAsc', true).map(c => c.id),
    ['a', 'b', 'low'],
  )
  assert.deepEqual(
    sortDetailCells(cells, 'delta', true).map(c => c.id),
    ['a', 'b', 'low'],
  )
  assert.deepEqual(
    sortDetailCells(cells, 'deltaAsc', true).map(c => c.id),
    ['b', 'a', 'low'],
  )
  assert.deepEqual(
    sortDetailCells(cells, 'winRate').map(c => c.id),
    ['low', 'b', 'a'],
  )
})

test('hero pick rate and game count sort descending even for small samples', () => {
  const cells = [
    cell('many', 0.2, 0.5, 1200),
    cell('few', 0.9, 0.5, 5),
    cell('near', 0.90001, 0.5, 19),
    cell('tie', 0.2, 0.5, 1200),
  ]
  assert.deepEqual(
    sortDetailCells(cells, 'pickRate', true).map(c => c.id),
    ['near', 'few', 'many', 'tie'],
  )
  assert.deepEqual(
    sortDetailCells(cells, 'games', true).map(c => c.id),
    ['many', 'tie', 'near', 'few'],
  )
  assert.deepEqual(
    cells.map(c => c.id),
    ['many', 'few', 'near', 'tie'],
  )
})

test('rune hero ranking treats both 49 and 50 as low sample', () => {
  const cells = [
    { ...cell('below', 0.9, 0.9, 49), delta: 0.4 },
    { ...cell('boundary', 0.2, 0.6, 50), delta: 0.1 },
    { ...cell('large', 0.3, 0.7, 80), delta: 0.2 },
  ]
  assert.deepEqual(
    sortDetailCells(cells, 'winRate', 51).map(c => c.id),
    ['large', 'below', 'boundary'],
  )
  assert.deepEqual(
    sortDetailCells(cells, 'delta', 51).map(c => c.id),
    ['large', 'below', 'boundary'],
  )
  assert.deepEqual(
    sortDetailCells(cells, 'deltaAsc', 51).map(c => c.id),
    ['large', 'boundary', 'below'],
  )
  assert.deepEqual(
    sortDetailCells(cells, 'pickRate', 51).map(c => c.id),
    ['below', 'large', 'boundary'],
  )
  assert.deepEqual(
    sortDetailCells(cells, 'games', 51).map(c => c.id),
    ['large', 'boundary', 'below'],
  )
})

test('hero detail runes with at most 50 games stay last for either win-rate direction', () => {
  const cells = [
    cell('under', 0.8, 0.9, 49),
    cell('exactly50', 0.7, 0.8, 50),
    cell('exactly51', 0.2, 0.6, 51),
    cell('large', 0.3, 0.5, 100),
  ]
  assert.deepEqual(
    sortDetailCells(cells, 'winRate', 51).map(c => c.id),
    ['exactly51', 'large', 'under', 'exactly50'],
  )
  assert.deepEqual(
    sortDetailCells(cells, 'winRateAsc', 51).map(c => c.id),
    ['large', 'exactly51', 'exactly50', 'under'],
  )
  assert.deepEqual(
    sortDetailCells(cells, 'pickRate', 51).map(c => c.id),
    ['under', 'exactly50', 'large', 'exactly51'],
  )
  assert.deepEqual(
    sortDetailCells(cells, 'winRate', false).map(c => c.id),
    ['under', 'exactly50', 'exactly51', 'large'],
  )
})

test('runes below fifty retain order only for win-rate and delta sorting', () => {
  const rows = [
    cell('low-a', 0.8, 0.1, 49),
    cell('fifty', 0.1, 0.6, 50),
    cell('low-b', 0.9, 0.99, 10),
    cell('winner', 0.2, 0.8, 80),
  ]
  for (const sort of ['winRate'])
    assert.deepEqual(
      sortDetailCells(rows, sort, 50, true).map(c => c.id),
      ['winner', 'fifty', 'low-a', 'low-b'],
    )
  assert.deepEqual(
    sortDetailCells(rows, 'winRateAsc', 50, true).map(c => c.id),
    ['fifty', 'winner', 'low-a', 'low-b'],
  )
  assert.deepEqual(
    sortDetailCells(rows, 'pickRate', 50, true).map(c => c.id),
    ['low-b', 'low-a', 'winner', 'fifty'],
  )
  const deltas = rows.map(c => ({ ...c, delta: c.winRate - 0.5 }))
  assert.deepEqual(
    sortDetailCells(deltas, 'delta', 50, true).map(c => c.id),
    ['winner', 'fifty', 'low-a', 'low-b'],
  )
  assert.deepEqual(
    sortDetailCells(deltas, 'deltaAsc', 50, true).map(c => c.id),
    ['fifty', 'winner', 'low-a', 'low-b'],
  )
})
