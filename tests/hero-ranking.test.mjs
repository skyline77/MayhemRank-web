import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadTS } from './load-ts.mjs'
const { rankHeroes } = await loadTS('../src/heroRanking.ts')
test('same hero set, strongest eligible role, fixed columns and fallback', () => {
  const heroes = [
    { id: 'h1', championId: 1, column: '战士' },
    { id: 'h2', championId: 2, column: '坦克' },
  ]
  const roles = [
    { id: 'a', championId: 1, games: 100, winRate: 0.6, column: '战士' },
    { id: 'b', championId: 1, games: 200, winRate: 0.6, column: '战士' },
    { id: 'small', championId: 2, games: 20, winRate: 1, column: '刺客' },
  ]
  const mapping = { 1: '辅助', 2: 'AP输出' }
  const result = rankHeroes(heroes, roles, mapping, true, 50)
  assert.deepEqual(
    result.map(x => x.id),
    ['b', 'h2'],
  )
  assert.deepEqual(
    result.map(x => x.column),
    ['辅助', 'AP输出'],
  )
  assert.equal(result[1].roleFallback, true)
  assert.deepEqual(
    rankHeroes(heroes, roles, mapping, false, 50).map(x => x.championId),
    result.map(x => x.championId),
  )
  assert.equal(heroes[0].column, '战士')
})
