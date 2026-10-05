import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { loadTS } from './load-ts.mjs'
const { loadRuneDescriptions, matchingRuneTranslation } = await loadTS(
  '../src/details/rune/runeDescriptions.ts',
)
const catalogue = name =>
  JSON.parse(readFileSync(new URL('../public/rune-descriptions/' + name, import.meta.url), 'utf8'))
const en = catalogue('wiki-en-20260925.json')
const zh = catalogue('wiki-zh-CN-20260925.json')
function numbers(text) {
  const result = {}
  for (const value of text.match(/\d+(?:,\d{3})*(?:\.\d+)?/g) || [])
    result[value] = (result[value] || 0) + 1
  return result
}
test('all captured Wiki excerpts have source-aligned Chinese translations with preserved numbers and paragraphs', () => {
  assert.equal(Object.keys(en.entries).length, 222)
  assert.deepEqual(Object.keys(zh.entries).sort(), Object.keys(en.entries).sort())
  assert.equal(zh.locale, 'zh_CN')
  assert.equal(zh.queue, en.queue)
  assert.equal(zh.scope, en.scope)
  assert.equal(zh.source.captureSha256, en.source.captureSha256)
  assert.equal(zh.source.license, en.source.license)
  assert.equal(zh.source.url, en.source.url)
  assert.equal(zh.source.translation.official, false)
  for (const [id, original] of Object.entries(en.entries)) {
    const translated = zh.entries[id]
    assert.match(translated.description, /[\u4e00-\u9fff]/, id)
    assert.equal(translated.sourceDescription, original.description, id)
    assert.equal(translated.anchor, original.anchor, id)
    assert.deepEqual(
      numbers(translated.description),
      numbers(original.description),
      id + ' numeric values',
    )
    assert.equal(
      translated.description.split('\n\n').length,
      original.description.split('\n\n').length,
      id + ' paragraphs',
    )
    if (original.description.includes('disabled')) assert.match(translated.description, /禁用/, id)
  }
})
test('missing or stale translations never stand in for current Wiki text', () => {
  const original = en.entries['1058'],
    translation = zh.entries['1058']
  assert.equal(matchingRuneTranslation(original, translation), translation)
  assert.equal(
    matchingRuneTranslation(
      { ...original, description: original.description + ' Updated.' },
      translation,
    ),
    undefined,
  )
  assert.equal(matchingRuneTranslation(original), undefined)
  assert.equal(matchingRuneTranslation(undefined, translation), undefined)
  assert.equal(matchingRuneTranslation(original, { ...translation, description: ' ' }), undefined)
})
test('catalogues cache independently, deduplicate simultaneous requests and allow retries after invalid data', async () => {
  const originalFetch = globalThis.fetch
  const requests = []
  let failEnglish = true
  globalThis.fetch = async url => {
    requests.push(url)
    if (url.includes('wiki-en'))
      return { ok: true, json: async () => (failEnglish ? { ...en, locale: 'zh_CN' } : en) }
    return { ok: true, json: async () => zh }
  }
  try {
    const first = loadRuneDescriptions('en_US')
    assert.equal(loadRuneDescriptions('en_US'), first)
    const translated = loadRuneDescriptions('zh_CN')
    assert.equal(loadRuneDescriptions('zh_CN'), translated)
    await assert.rejects(first, /格式不匹配/)
    assert.equal(await translated, zh)
    failEnglish = false
    assert.equal(await loadRuneDescriptions(), en)
    assert.equal(await loadRuneDescriptions('zh_CN'), zh)
    assert.equal(requests.length, 3)
  } finally {
    globalThis.fetch = originalFetch
  }
})
