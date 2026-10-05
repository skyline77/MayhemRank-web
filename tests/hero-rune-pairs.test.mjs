import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTS } from './load-ts.mjs'
const { loadHeroRunePairs, matchesRunePair } = await loadTS('../src/heroRunePairs.ts')
const row = {
  id: '1-2',
  games: 100,
  runes: [
    { id: '1', name: '秘术冲拳' },
    { id: '2', name: '虚幻武器' },
  ],
}
test('either rune matches names, pinyin and initials', () => {
  const index = {
    augments: { 1: ['mishuchongquan'], 2: ['xuhuanwuqi'] },
    augmentInitials: { 1: ['mscq'], 2: ['xhwq'] },
  }
  for (const query of ['秘术', '虚幻', 'mishu', 'xuhuan', 'msc', 'hwq'])
    assert.equal(matchesRunePair(row, query, index), true)
  assert.equal(matchesRunePair(row, '不存在', index), false)
})
test('requests only one hero, caches the immutable scope, rejects another hero', async () => {
  let requests = []
  globalThis.fetch = async url => {
    requests.push(url)
    return {
      ok: true,
      json: async () => ({
        championId: 120,
        meta: {
          queue: 2400,
          patch: '16.19',
          snapshotId: 'gen',
          scope: 'all-valid-appearances',
          method: 'beta50-fixed-hero-baseline-v1',
          confidenceLevel: null,
          minimumGames: 100,
          combinationDefinition: 'same-hero-same-appearance-unordered-distinct-runes',
        },
        augmentGames: 800,
        entries: [row],
      }),
    }
  }
  await loadHeroRunePairs(120, '16.19', 'gen')
  await loadHeroRunePairs(120, '16.19', 'gen')
  assert.equal(requests.length, 1)
  assert.match(requests[0], /champion=120/)
  await assert.rejects(loadHeroRunePairs(10, '16.19', 'gen'), /范围不一致/)
})
