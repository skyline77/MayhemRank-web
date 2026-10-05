import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadTS } from './load-ts.mjs'
const { runeSuggestions } = await loadTS('../src/boards/augments/runeSuggestions.ts')
const rune = (id, name, extra = {}) => ({
  id,
  name,
  column: '黄金',
  rarity: '黄金',
  winRate: 0.51,
  games: 100,
  lowSample: false,
  ...extra,
})
const entries = [rune('1', '亮出你的剑'), rune('2', '剑舞')]
const index = {
  augments: { 1: ['亮剑', 'liangjian', 'Draw Your Sword'] },
  augmentInitials: { 1: ['lj', 'lcndj'] },
}
test('Chinese, aliases, pinyin, initials and available English aliases share normalized matching', () => {
  for (const query of ['亮出', '亮剑', 'liangjian', 'L J', 'ｌｊ', 'Draw Your Sword'])
    assert.equal(runeSuggestions(entries, query, index)[0].id, '1', query)
  for (const query of ['', '，', '不存在'])
    assert.deepEqual(runeSuggestions(entries, query, index), [])
  assert.equal(runeSuggestions(entries, '亮出', null)[0].id, '1')
})
test('ranking includes every eligible match for scrolling and does not mutate board data', () => {
  const values = Array.from({ length: 8 }, (_, i) => rune(String(i), '剑' + i))
  const original = JSON.stringify(values)
  assert.deepEqual(
    runeSuggestions([...values].reverse(), '剑', null).map(e => e.id),
    ['0', '1', '2', '3', '4', '5', '6', '7'],
  )
  assert.equal(JSON.stringify(values), original)
  assert.deepEqual(
    runeSuggestions(
      [
        rune('1', '剑', { lowSample: true }),
        rune('2', '剑', { winRate: NaN }),
        rune('3', '剑', { column: '未知' }),
      ],
      '剑',
      null,
    ),
    [],
  )
  assert.deepEqual(
    runeSuggestions(entries, '剑', index).map(e => e.id),
    ['2', '1'],
  )
})
