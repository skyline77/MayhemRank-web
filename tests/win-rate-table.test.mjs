import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadTS } from './load-ts.mjs'
const { winRateRows, winRateStrips } = await loadTS('../src/boards/winRateTable.ts')
const columns = ['棱彩', '黄金', '白银']
const entry = (id, wr, column = '黄金', extra = {}) => ({
  id,
  winRate: wr,
  column,
  games: 500,
  interval: [0.4, 0.6],
  lowSample: false,
  ...extra,
})
test('rune and hero tables share exact boundaries, low-sample exclusions and ordering', () => {
  const rows = winRateRows(
    [
      entry('a', 0.5),
      entry('b', 0.51999),
      entry('c', 0.52),
      entry('d', 0.58),
      entry('e', 1, '白银'),
      entry('tiny', 0.99, '棱彩', { lowSample: true }),
    ],
    columns,
  )
  assert.deepEqual(
    rows.map(r => r.lower),
    [98, 58, 52, 50],
  )
  assert.deepEqual(
    rows.at(-1).cells[1].map(e => e.id),
    ['b', 'a'],
  )
  assert.equal(rows[0].cells[2][0].id, 'e')
  assert.equal(rows[0].cells.length, 3)
})
test('three columns split into stable strips without dropping or duplicating runes', () => {
  const entries = columns.flatMap((column, c) =>
    Array.from({ length: 9 - c }, (_, i) => entry(c + ':' + i, 0.55 - i / 10000, column)),
  )
  const rows = winRateRows(entries, columns),
    strips = winRateStrips(rows, [4, 4, 4])
  assert.deepEqual(
    strips.map(s => s.cells.map(c => c.length)),
    [
      [4, 4, 4],
      [4, 4, 3],
      [1, 0, 0],
    ],
  )
  assert.equal(new Set(strips.flatMap(s => s.cells.flat()).map(e => e.id)).size, entries.length)
  assert.deepEqual(
    strips.map(s => s.last),
    [false, false, true],
  )
})
test('empty and invalid input cannot create phantom bands', () => {
  assert.deepEqual(winRateRows([], columns), [])
  assert.deepEqual(
    winRateRows([entry('bad', NaN), entry('bad2', -0.1), entry('unknown', 0.5, 'other')], columns),
    [],
  )
  assert.throws(() => winRateStrips([{ lower: 50, upper: 52, cells: [[]] }], [0]))
})
