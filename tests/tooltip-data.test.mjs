import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadTS } from './load-ts.mjs'
const { loadDescription, loadTooltipCatalogue } = await loadTS('../src/data/tooltipData.ts')
const { locale } = await loadTS('../src/i18n/locale.ts')
const payload = patch => ({
  schema: 1,
  patch,
  locales: Object.fromEntries(
    ['zh-CN', 'zh-TW', 'ja-JP', 'en-US'].map(lang => [
      lang,
      {
        items: { 1: { name: lang + ' item', description: '10 power' } },
        augments: { 2: { name: 'augment', description: 'Arena must never leak' } },
      },
    ]),
  ),
})

test('tooltip catalogue skips empty versions and loads once a version is available', async () => {
  const original = globalThis.fetch,
    urls = []
  try {
    globalThis.fetch = async url => {
      urls.push(url)
      return {
        ok: true,
        json: async () => ({ patch: '16.19', queue: 2400, items: {}, augments: {} }),
      }
    }
    await assert.rejects(loadTooltipCatalogue(''), /版本/)
    await assert.rejects(loadTooltipCatalogue('  '), /版本/)
    assert.deepEqual(urls, [])
    assert.equal((await loadTooltipCatalogue('16.19')).patch, '16.19')
    await loadTooltipCatalogue('16.19')
    assert.deepEqual(urls, ['/tooltip-catalogues/16.19.json?v=item-stats-v3'])
  } finally {
    globalThis.fetch = original
  }
})
test('localized item descriptions cache by patch, reject wrong scope, and never substitute Arena', async () => {
  const original = globalThis.fetch
  let calls = 0
  try {
    globalThis.fetch = async url => {
      calls++
      return { ok: true, json: async () => payload(url.split('/').pop().replace('.json', '')) }
    }
    locale.value = 'en-US'
    assert.equal((await loadDescription('16.18', 'items', '1')).name, 'en-US item')
    assert.equal(await loadDescription('16.18', 'augments', '2'), null)
    assert.equal(await loadDescription('16.18', 'items', 'missing'), null)
    locale.value = 'ja-JP'
    assert.equal((await loadDescription('16.18', 'items', '1')).name, 'ja-JP item')
    assert.equal(calls, 1)
    await loadDescription('16.19', 'items', '1')
    assert.equal(calls, 2)
    globalThis.fetch = async () => ({ ok: true, json: async () => payload('wrong') })
    await assert.rejects(loadDescription('16.20', 'items', '1'), /版本/)
    globalThis.fetch = async () => ({ ok: true, json: async () => payload('16.20') })
    assert.equal((await loadDescription('16.20', 'items', '1')).name, 'ja-JP item')
  } finally {
    globalThis.fetch = original
  }
})
