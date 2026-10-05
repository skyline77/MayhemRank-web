import assert from 'node:assert/strict'
import { test } from 'node:test'
import { gzipSync } from 'node:zlib'
import { loadTS } from './load-ts.mjs'
const { loadHeroDetail } = await loadTS('../src/details/hero/heroCohorts.ts')
const entry = { championId: 10, snapshotId: 'generation-a' }
const filter = { role: null, rune: { id: '7' } }
const value = (patch = '16.19', generation = 'generation-a', aid = '7') => ({
  meta: { queue: 2400, patch, snapshotId: generation },
  championId: 10,
  augmentId: aid,
  summary: { games: 20 },
  detail: { games: 20 },
  spells: { games: 20 },
})
// 符文/装备筛选数据包：{ ID: 单个筛选的内容 }，以 gzip 返回
const bundle = content => ({
  ok: true,
  arrayBuffer: async () => gzipSync(JSON.stringify(content)),
})

test('rune filters share one bundle per hero, patch and generation', async () => {
  const original = global.fetch,
    urls = []
  global.fetch = async url => {
    urls.push(url)
    const [, gen, patch] = url.match(/snapshots\/([^/]+)\/([^/]+)/)
    return bundle({ 7: value(patch, gen, '7'), 8: value(patch, gen, '8') })
  }
  try {
    const [a, b] = await Promise.all([
      loadHeroDetail(entry, '16.19', filter),
      loadHeroDetail(entry, '16.19', filter),
    ])
    assert.equal(a, b)
    assert.equal(urls.length, 1)
    assert.match(
      urls[0],
      /\/snapshots\/generation-a\/16\.19\/hero-cohorts\/10\/augments\.json\.gz$/,
    )
    // 同一数据包中的另一个符文不再请求
    assert.equal(
      (await loadHeroDetail(entry, '16.19', { role: null, rune: { id: '8' } })).augmentId,
      '8',
    )
    assert.equal(urls.length, 1)
    await loadHeroDetail(entry, '16.18', filter)
    await loadHeroDetail({ ...entry, snapshotId: 'generation-b' }, '16.19', filter)
    assert.equal(urls.length, 3)
  } finally {
    global.fetch = original
  }
})
test('rejects mismatched scope and removes failed requests so retry can succeed', async () => {
  const original = global.fetch,
    e = { ...entry, snapshotId: 'generation-retry' }
  let calls = 0
  global.fetch = async () => {
    calls++
    return bundle({ 7: value('16.19', 'generation-retry', calls === 1 ? '8' : '7') })
  }
  try {
    await assert.rejects(loadHeroDetail(e, '16.19', filter), /不一致/)
    await loadHeroDetail(e, '16.19', filter)
    assert.equal(calls, 2)
  } finally {
    global.fetch = original
  }
})
test('a condition missing from the bundle reports no data without refetching the bundle', async () => {
  const original = global.fetch,
    e = { ...entry, snapshotId: 'generation-missing' }
  let calls = 0
  global.fetch = async () => {
    calls++
    return bundle({ 7: value('16.19', 'generation-missing') })
  }
  try {
    for (let i = 0; i < 2; i++)
      await assert.rejects(loadHeroDetail(e, '16.19', { role: null, rune: { id: '99' } }), /暂无/)
    assert.equal(calls, 1)
  } finally {
    global.fetch = original
  }
})
test('all appearances use their own shard; absent data does not become zero win rate', async () => {
  const original = global.fetch,
    e = { ...entry, snapshotId: 'generation-empty' }
  global.fetch = async url => {
    assert.match(url, /all.json$/)
    return { ok: false, status: 404 }
  }
  try {
    await assert.rejects(loadHeroDetail(e, '16.19', { role: null, rune: null }), /暂无/)
  } finally {
    global.fetch = original
  }
})

test('equipment and no-boots filters use the item bundle and validate item identity', async () => {
  const original = global.fetch,
    urls = [],
    e = { ...entry, snapshotId: 'items' }
  let wrong = true
  global.fetch = async url => {
    urls.push(url)
    const item = iid => ({ ...value('16.19', 'items', null), itemId: wrong ? 'wrong' : iid })
    return bundle({ 7: item('7'), '-1': item('-1') })
  }
  try {
    const itemFilter = { role: null, rune: null, item: { id: '7' } }
    await assert.rejects(loadHeroDetail(e, '16.19', itemFilter), /不一致/)
    wrong = false
    const [a, b] = await Promise.all([
      loadHeroDetail(e, '16.19', itemFilter),
      loadHeroDetail(e, '16.19', itemFilter),
    ])
    assert.equal(a, b)
    assert.equal(urls.length, 2)
    assert.match(urls[1], /hero-cohorts\/10\/items\.json\.gz$/)
    assert.equal(
      (await loadHeroDetail(e, '16.19', { role: null, rune: null, item: { id: '-1' } })).itemId,
      '-1',
    )
    assert.equal(urls.length, 2)
    await assert.rejects(loadHeroDetail(e, '16.19', { ...itemFilter, rune: { id: '7' } }), /同时/)
  } finally {
    global.fetch = original
  }
})

test('other loads a separate unclassified cohort and rejects an all-appearances response', async () => {
  const original = global.fetch,
    e = { ...entry, snapshotId: 'other-test' }
  let wrong = true
  global.fetch = async url => {
    assert.equal(url, `/snapshots/other-test/16.19/hero-unclassified/${e.championId}.json`)
    return {
      ok: true,
      json: async () => ({
        ...value('16.19', 'other-test', null),
        meta: {
          queue: 2400,
          patch: '16.19',
          snapshotId: 'other-test',
          scope: wrong ? 'all-valid-appearances' : 'unclassified-appearances',
        },
      }),
    }
  }
  try {
    await assert.rejects(loadHeroDetail(e, '16.19', { role: 'other', rune: null }), /不一致/)
    wrong = false
    const result = await loadHeroDetail(e, '16.19', { role: 'other', rune: null })
    assert.equal(result.summary.games, 20)
  } finally {
    global.fetch = original
  }
})
