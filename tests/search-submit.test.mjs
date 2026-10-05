import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadTS } from './load-ts.mjs'
const { singleSearchCandidate, isSearchSubmit } = await loadTS('../src/search/search.ts')
const { buildRows } = await loadTS('../src/boards/heroes/buildBoard.ts')
const { winRateRows } = await loadTS('../src/boards/winRateTable.ts')
const hero = (id, extra = {}) => ({
  id,
  name: '茂凯',
  role: '坦克',
  column: '坦克',
  games: 100,
  winRate: 0.51,
  interval: [0.4, 0.6],
  lowSample: false,
  ...extra,
})
const cells = rows => rows.flatMap(row => row.cells.flat())

test('single-candidate helper rejects ambiguity and empty queries', () => {
  const tank = hero('tank'),
    ap = hero('ap', { role: 'AP', column: 'AP输出' })
  assert.equal(singleSearchCandidate(cells(buildRows([tank, ap], '茂凯')), '茂凯'), null)
  assert.equal(singleSearchCandidate(cells(buildRows([tank, ap], '茂凯', '坦克')), '茂凯'), tank)
  assert.equal(singleSearchCandidate(cells(buildRows([tank], '不存在')), '不存在'), null)
  for (const query of ['', '  ', '，']) assert.equal(singleSearchCandidate([tank], query), null)
})

test('rune Enter counts displayed rows, excluding below-floor records', () => {
  const rune = hero('rune', { name: '秘术冲拳', column: '棱彩' })
  const low = hero('low', { name: '秘术冲拳', column: '黄金', lowSample: true })
  assert.equal(
    singleSearchCandidate(cells(winRateRows([rune, low], ['棱彩', '黄金', '白银'])), '秘术'),
    rune,
  )
  assert.equal(
    singleSearchCandidate(cells(winRateRows([low], ['棱彩', '黄金', '白银'])), '秘术'),
    null,
  )
})

test('Enter ignores IME confirmation, held keys and modified shortcuts', () => {
  const event = {
    key: 'Enter',
    defaultPrevented: false,
    isComposing: false,
    keyCode: 13,
    repeat: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
  }
  assert.equal(isSearchSubmit(event), true)
  for (const change of [
    { isComposing: true },
    { keyCode: 229 },
    { repeat: true },
    { ctrlKey: true },
    { metaKey: true },
    { altKey: true },
    { shiftKey: true },
    { defaultPrevented: true },
    { key: 'Escape' },
  ])
    assert.equal(isSearchSubmit({ ...event, ...change }), false)
})
