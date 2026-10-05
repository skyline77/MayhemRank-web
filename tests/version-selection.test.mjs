import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadTS } from './load-ts.mjs'
const { dataPatch, resolveVersion } = await loadTS('../src/versionSelection.ts')
const manifest = {
  generation: 'new',
  defaultPatch: '16.19',
  patches: [{ patch: '16.18' }, { patch: '16.19' }],
  comparisons: [{ id: '16.18旧', patch: '16.18', generation: 'old' }],
}
test('retired comparison metadata cannot advertise a legacy generation', () => {
  const old = resolveVersion(manifest, '16.18旧'),
    current = resolveVersion(manifest, '16.18')
  assert.deepEqual(
    old.options.map(p => p.patch),
    ['16.19', '16.18'],
  )
  assert.equal(old.selected.patch, '16.19')
  assert.equal(old.manifest.generation, 'new')
  assert.equal(current.selected.patch, '16.18')
  assert.equal(current.manifest.generation, 'new')
  assert.equal(dataPatch('16.18'), '16.18')
})

test('a missing verified comparison is not advertised or silently interpreted as old data', () => {
  const value = resolveVersion({ ...manifest, comparisons: [] }, '16.18旧')
  assert.equal(value.selected.patch, '16.19')
  assert.equal(value.options.length, 2)
})
test('detail links use the requested patch even from a retired comparison URL', async () => {
  const old = globalThis.location
  try {
    globalThis.location = { search: '?patch=16.18%E6%97%A7' }
    const { buildDetailUrl, runeDetailUrl } = await loadTS('../src/detailLink.ts')
    assert.equal(
      new URL(buildDetailUrl(4, 'AP', '16.18'), 'http://localhost').searchParams.get('patch'),
      '16.18',
    )
    assert.equal(
      new URL(runeDetailUrl('7', '16.18'), 'http://localhost').searchParams.get('patch'),
      '16.18',
    )
    assert.equal(
      new URL(buildDetailUrl(4, 'AP', '16.19'), 'http://localhost').searchParams.get('patch'),
      '16.19',
    )
  } finally {
    globalThis.location = old
  }
})
