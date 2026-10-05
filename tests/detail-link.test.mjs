import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'
const js = ts.transpile(readFileSync(new URL('../src/detailLink.ts', import.meta.url), 'utf8'), {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ES2022,
})
const { buildDetailUrl, runeDetailUrl, isInlineActivation, boardLink } = await import(
  'data:text/javascript;base64,' + Buffer.from(js).toString('base64')
)
test('only ordinary primary clicks use inline details', () => {
  const plain = { button: 0, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }
  assert.equal(isInlineActivation(plain), true)
  for (const key of ['ctrlKey', 'metaKey', 'shiftKey', 'altKey'])
    assert.equal(isInlineActivation({ ...plain, [key]: true }), false)
  for (const button of [1, 2]) assert.equal(isInlineActivation({ ...plain, button }), false)
})
test('detail URLs retain the exact champion and role for native tab opening', () => {
  const url = new URL(buildDetailUrl(67, '远程暴击'), 'http://localhost')
  assert.equal(url.searchParams.get('page'), 'heroes')
  assert.equal(url.searchParams.get('champion'), '67')
  assert.equal(url.searchParams.get('role'), '远程暴击')
})

test('rune-to-hero links preserve champion, patch and rune without applying a role or opening rune detail', () => {
  const url = new URL(buildDetailUrl(25, '面具AP', '16.19', '1234'), 'http://localhost')
  assert.equal(url.searchParams.get('champion'), '25')
  assert.equal(url.searchParams.get('augment'), '1234')
  assert.equal(url.searchParams.get('patch'), '16.19')
  assert.equal(url.searchParams.has('role'), false)
  assert.equal(url.searchParams.has('rune'), false)
  const cleared = new URL(buildDetailUrl(25, '面具AP', '16.19'), 'http://localhost')
  assert.equal(cleared.searchParams.has('augment'), false)
  assert.equal(cleared.searchParams.get('role'), '面具AP')
})

test('rune links retain the exact rune identity and selected patch independently of the board', () => {
  for (const id of ['1234', 'variant/Q & W']) {
    const url = new URL(runeDetailUrl(id, '16.18'), 'http://localhost')
    assert.equal(url.searchParams.get('page'), 'augments')
    assert.equal(url.searchParams.get('rune'), id)
    assert.equal(url.searchParams.get('patch'), '16.18')
    assert.equal(url.searchParams.has('champion'), false)
  }
  assert.equal(new URL(runeDetailUrl('1234'), 'http://localhost').searchParams.has('patch'), false)
})

test('legacy and current deep links resolve to the matching board with filters intact', () => {
  assert.deepEqual(boardLink('?champion=120&role=&patch=16.19'), {
    page: 'heroes',
    champion: 120,
    rune: '',
    role: '',
    augment: '',
  })
  assert.deepEqual(boardLink('?rune=1134&patch=16.19'), {
    page: 'augments',
    champion: null,
    rune: '1134',
    role: '',
    augment: '',
  })
  assert.equal(boardLink(runeDetailUrl('1134', '16.19').split('?')[1]).page, 'augments')
  const hero = boardLink(buildDetailUrl(25, '', '16.19', '2063').split('?')[1])
  assert.equal(hero.champion, 25)
  assert.equal(hero.augment, '2063')
  assert.equal(hero.page, 'heroes')
  assert.equal(boardLink('?page=combos').page, 'combos')
  assert.equal(boardLink('?champion=bad&page=augments').champion, null)
  assert.equal(boardLink('?page=heroes&rune=1134').page, 'augments')
})
