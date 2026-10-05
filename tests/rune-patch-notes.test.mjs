import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { loadTS } from './load-ts.mjs'
const { recentPatches, coveredPatchLabel } = await loadTS('../src/patchNotes.ts')
const data = JSON.parse(
  readFileSync(new URL('../public/champion-patches/recent.json', import.meta.url), 'utf8'),
)
test('runes use the shared chronological filter without leaking later versions', () => {
  assert.deepEqual(
    recentPatches(data, 'rune', '2095', '16.19').map(p => p.patch),
    ['26.19', '26.18', '26.17', '26.14', '26.12'],
  )
  assert.deepEqual(
    recentPatches(data, 'rune', '2095', '16.18').map(p => p.patch),
    ['26.18', '26.17', '26.14', '26.12'],
  )
  assert.deepEqual(recentPatches(data, 'rune', 'unknown', '16.19'), [])
  assert.equal(coveredPatchLabel(data, '16.18'), '26.10–26.18')
})
test('champion and rune identities never share changes even when numeric IDs coincide', () => {
  const fixture = {
    schemaVersion: 1,
    sources: [],
    champions: { 1: [{ patch: '26.18', gamePatch: '16.18', changes: [{ text: 'hero' }] }] },
    runes: { 1: [{ patch: '26.18', gamePatch: '16.18', changes: [{ text: 'rune' }] }] },
  }
  assert.equal(recentPatches(fixture, 'champion', 1, '16.19')[0].changes[0].text, 'hero')
  assert.equal(recentPatches(fixture, 'rune', '1', '16.19')[0].changes[0].text, 'rune')
})
