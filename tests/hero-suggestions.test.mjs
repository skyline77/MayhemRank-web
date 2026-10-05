import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadTS } from './load-ts.mjs'
const { locale } = await loadTS('../src/i18n/locale.ts')
locale.value = 'zh-CN'
const { heroSuggestions, suggestionScore, moveSuggestion } = await loadTS(
  '../src/boards/heroes/heroSuggestions.ts',
)
const hero = (championId, name, extra = {}) => ({
  championId,
  id: String(championId),
  name,
  role: '坦克',
  column: '坦克',
  pickRate: 1,
  games: 100,
  winRate: 0.51,
  interval: [0.4, 0.6],
  lowSample: false,
  ...extra,
})
test('match shape ranks exact before prefix before substring, then name/title and spelling/initials', () => {
  assert.ok(suggestionScore([['ys', 5]], 'ys') < suggestionScore([['ysabc', 0]], 'ys'))
  assert.ok(suggestionScore([['ysabc', 5]], 'ys') < suggestionScore([['aaysabc', 0]], 'ys'))
  assert.ok(suggestionScore([['yasuo', 1]], 'ya') < suggestionScore([['yasuo', 4]], 'ya'))
  assert.ok(suggestionScore([['yasuo', 1]], 'ya') < suggestionScore([['yasuo', 2]], 'ya'))
  assert.equal(suggestionScore([['jfjh', 5]], 'jh'), 25)
  assert.equal(suggestionScore([['jfjh', 5]], 'jfh'), Infinity)
})
test('uses Chinese, full pinyin and initials, including partial normalized searches', () => {
  const entries = [hero(157, '亚索'), hero(57, '茂凯')]
  for (const query of ['亚索', '疾风剑豪', 'yasuo', 'ys', 'jfjh', 'jf', 'jh', 'ＪＦＪＨ', 'Y S'])
    assert.equal(heroSuggestions(entries, query)[0].championId, 157, query)
  for (const query of ['', '，', '没有这个英雄'])
    assert.deepEqual(heroSuggestions(entries, query), [])
})
test('keeps all matches after deduplicating and opens the most used eligible role rather than the highest win rate', () => {
  const tank = hero(57, '茂凯', { id: 'tank', pickRate: 0.8, games: 800, winRate: 0.48 })
  const ap = hero(57, '茂凯', {
    id: 'ap',
    role: 'AP',
    column: 'AP输出',
    pickRate: 0.2,
    games: 200,
    winRate: 0.7,
  })
  assert.deepEqual(heroSuggestions([ap, tank], 'mk'), [tank])
  assert.deepEqual(heroSuggestions([ap, tank], 'AP'), [tank])
  const values = Array.from({ length: 8 }, (_, i) => hero(10000 + i, '搜索英雄' + i))
  const snapshot = JSON.stringify(values)
  assert.deepEqual(
    heroSuggestions(values, '搜索').map(e => e.championId),
    [10000, 10001, 10002, 10003, 10004, 10005, 10006, 10007],
  )
  assert.deepEqual(
    heroSuggestions([...values].reverse(), '搜索').map(e => e.championId),
    [10000, 10001, 10002, 10003, 10004, 10005, 10006, 10007],
  )
  assert.equal(JSON.stringify(values), snapshot)
  assert.deepEqual(
    heroSuggestions(
      [hero(157, '亚索', { lowSample: true }), hero(57, '茂凯', { winRate: NaN })],
      '亚索',
    ),
    [],
  )
})
test('four arrows navigate the same candidate list with wraparound', () => {
  assert.equal(moveSuggestion(4, 'ArrowDown', 8), 5)
  assert.equal(moveSuggestion(5, 'ArrowDown', 8), 6)
  assert.equal(moveSuggestion(7, 'ArrowDown', 8), 0)
  assert.equal(moveSuggestion(0, 'ArrowRight', 5), 1)
  assert.equal(moveSuggestion(0, 'ArrowDown', 5), 1)
  assert.equal(moveSuggestion(0, 'ArrowLeft', 5), 4)
  assert.equal(moveSuggestion(0, 'ArrowUp', 5), 4)
  assert.equal(moveSuggestion(4, 'ArrowRight', 5), 0)
  assert.equal(moveSuggestion(0, 'ArrowRight', 1), 0)
  assert.equal(moveSuggestion(0, 'ArrowRight', 0), -1)
})
