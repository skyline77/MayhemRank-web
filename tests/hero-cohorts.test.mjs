import assert from 'node:assert/strict'
import { test } from 'node:test'
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
test('fetches only requested shard, shares concurrent requests, isolates generation and patch', async () => {
  const original = global.fetch,
    urls = []
  global.fetch = async url => {
    urls.push(url)
    const [, gen, patch] = url.match(/snapshots\/([^/]+)\/([^/]+)/)
    return { ok: true, json: async () => value(patch, gen) }
  }
  try {
    const [a, b] = await Promise.all([
      loadHeroDetail(entry, '16.19', filter),
      loadHeroDetail(entry, '16.19', filter),
    ])
    assert.equal(a, b)
    assert.equal(urls.length, 1)
    assert.match(urls[0], /hero-cohorts\/10\/augments\/7.json$/)
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
  global.fetch = async () => ({
    ok: true,
    json: async () => {
      calls++
      return value('16.19', 'generation-retry', calls === 1 ? '8' : '7')
    },
  })
  try {
    await assert.rejects(loadHeroDetail(e, '16.19', filter), /不一致/)
    await loadHeroDetail(e, '16.19', filter)
    assert.equal(calls, 2)
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

test('equipment and no-boots requests use separate shards and validate item identity', async () => {
  const original = global.fetch,
    urls = [],
    e = { ...entry, snapshotId: 'items' }
  let wrong = true
  global.fetch = async url => {
    urls.push(url)
    const iid = url.match(/items\/(-?\d+)\.json$/)?.[1]
    return {
      ok: true,
      json: async () => ({ ...value('16.19', 'items', null), itemId: wrong ? 'wrong' : iid }),
    }
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
    assert.match(urls[1], /items\/7.json$/)
    await loadHeroDetail(e, '16.19', { role: null, rune: null, item: { id: '-1' } })
    assert.match(urls[2], /items\/-1.json$/)
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
    assert.match(url, /^\/api\/hero-unclassified\?/)
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
