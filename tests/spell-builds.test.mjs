import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'
const js = ts.transpile(readFileSync(new URL('../src/spellBuilds.ts', import.meta.url), 'utf8'), {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ES2022,
})
const { loadSpellBuilds, visibleSpellPairs, orderedSpellIcons } = await import(
  'data:text/javascript;base64,' + Buffer.from(js).toString('base64')
)
test('spell pairs cache one payload, reject scope mismatch and permit retry', async () => {
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => {
    calls++
    return {
      ok: true,
      json: async () => ({
        meta: { queue: 2400, patch: '16.18' },
        champions: { 1: { roles: [] } },
      }),
    }
  }
  try {
    const [a, b] = await Promise.all([loadSpellBuilds('16.18'), loadSpellBuilds('16.18')])
    assert.equal(calls, 1)
    assert.equal(a, b)
    await assert.rejects(loadSpellBuilds('16.19'), /版本/)
    await loadSpellBuilds('16.18')
    assert.equal(calls, 2)
  } finally {
    globalThis.fetch = original
  }
})

test('website shows all pairs strictly above 0.5 percent before rounding', () => {
  const pairs = [
    ...Array.from({ length: 7 }, (_, i) => ({ id: String(i), pickRate: 0.1 })),
    { id: 'just-above', pickRate: 0.005001 },
    { id: 'boundary', pickRate: 0.005 },
    { id: 'below', pickRate: 0.00499 },
  ]
  assert.equal(visibleSpellPairs(pairs).length, 8)
  assert.equal(visibleSpellPairs(pairs).at(-1).id, 'just-above')
})

test('fills three highest-usage pairs without duplicates or invented records', () => {
  const pairs = [
    { id: 'rare', pickRate: 0.001 },
    { id: 'common', pickRate: 0.98 },
    { id: 'boundary', pickRate: 0.005 },
    { id: 'second', pickRate: 0.014 },
  ]
  assert.deepEqual(
    visibleSpellPairs(pairs).map(p => p.id),
    ['common', 'second', 'boundary'],
  )
  assert.equal(pairs[0].id, 'rare')
  assert.deepEqual(
    visibleSpellPairs([
      { id: 'a', pickRate: 0.998 },
      { id: 'b', pickRate: 0.002 },
    ]).map(p => p.id),
    ['a', 'b'],
  )
  assert.equal(visibleSpellPairs([{ id: 'a', pickRate: 1 }]).length, 1)
  assert.deepEqual(visibleSpellPairs([]), [])
  assert.deepEqual(
    visibleSpellPairs([
      { id: 'a', pickRate: 0.994 },
      { id: 'b', pickRate: 0.003 },
      { id: 'c', pickRate: 0.002 },
      { id: 'd', pickRate: 0.001 },
    ]).map(p => p.id),
    ['a', 'b', 'c'],
  )
})

test('spell icons follow display priority without changing pair data', () => {
  const priority = [4, 32, 6, 21, 1, 7, 13]
  for (let i = 0; i < priority.length; i++)
    for (let j = i + 1; j < priority.length; j++) {
      const pair = { spellIds: [priority[j], priority[i]], icons: ['lower', 'upper'] }
      assert.deepEqual(orderedSpellIcons(pair), [
        { id: priority[i], icon: 'upper' },
        { id: priority[j], icon: 'lower' },
      ])
      assert.deepEqual(pair, { spellIds: [priority[j], priority[i]], icons: ['lower', 'upper'] })
    }
  assert.deepEqual(orderedSpellIcons({ spellIds: [99, 4], icons: [null, 'flash'] }), [
    { id: 4, icon: 'flash' },
    { id: 99, icon: null },
  ])
  assert.deepEqual(orderedSpellIcons({ spellIds: [99, 98], icons: ['a', 'b'] }), [
    { id: 99, icon: 'a' },
    { id: 98, icon: 'b' },
  ])
})
