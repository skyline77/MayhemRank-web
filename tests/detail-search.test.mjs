import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { loadTS } from './load-ts.mjs'
const { locale } = await loadTS('../src/i18n/locale.ts')
locale.value = 'zh-CN'
const { filterDetailGroups, loadDetailSearch } = await loadTS('../src/details/detailSearch.ts')
const index = JSON.parse(
  readFileSync(new URL('../public/search-catalogues/16.18.json', import.meta.url), 'utf8'),
)
const find = (kind, name) =>
  Object.entries(index[kind]).find(([, values]) => values.includes(name))[0]
const item = find('items', '心之钢'),
  augment = find('augments', '秘术冲拳')
const groups = {
  items: [{ id: item, name: '心之钢', games: 100 }],
  kPrismatic: [{ id: augment, name: '秘术冲拳', games: 30 }],
  kGold: [],
  kSilver: [],
}
test('detail search supports Chinese and partial pinyin, excludes English, while preserving all four groups', () => {
  for (const query of ['心之钢', 'xinzhigang', 'xinzhi']) {
    const result = filterDetailGroups(groups, query, index)
    assert.deepEqual(Object.keys(result), Object.keys(groups))
    assert.equal(result.items[0], groups.items[0])
    assert.equal(result.kPrismatic.length, 0)
  }
  for (const query of ['秘术', 'mishuchongquan', 'chongquan'])
    assert.equal(filterDetailGroups(groups, query, index).kPrismatic[0], groups.kPrismatic[0])
  for (const query of ['Heartsteel', 'HEART STEEL', 'Mystic Punch', 'mystic'])
    assert.deepEqual(
      Object.values(filterDetailGroups(groups, query, index)).map(cells => cells.length),
      [0, 0, 0, 0],
    )
  const empty = filterDetailGroups(groups, 'doesnotexist', index)
  assert.deepEqual(
    Object.values(empty).map(cells => cells.length),
    [0, 0, 0, 0],
  )
  assert.deepEqual(filterDetailGroups(groups, '', index), groups)
  assert.equal(groups.items.length, 1)
})
test('search catalogue requests are cached and reject wrong statistical scope', async () => {
  const original = globalThis.fetch
  let calls = 0
  try {
    globalThis.fetch = async () => {
      calls++
      return { ok: true, json: async () => index }
    }
    await Promise.all([loadDetailSearch('16.18'), loadDetailSearch('16.18')])
    assert.equal(calls, 1)
    await assert.rejects(loadDetailSearch('16.19'), /版本/)
    await assert.rejects(loadDetailSearch('16.19'), /版本/)
    assert.equal(calls, 3)
  } finally {
    globalThis.fetch = original
  }
})

test('both patch catalogues used by the rune board contain Chinese and pinyin aliases only', async () => {
  const { matchesSearch } = await loadTS('../src/search/search.ts')
  for (const patch of ['16.18', '16.19']) {
    const catalogue = JSON.parse(
      readFileSync(
        new URL('../public/search-catalogues/' + patch + '.json', import.meta.url),
        'utf8',
      ),
    )
    const punch = Object.values(catalogue.augments).find(values => values.includes('秘术冲拳'))
    assert.equal(matchesSearch(punch, 'mystic'), false)
    assert.equal(matchesSearch(punch, 'chongquan'), true)
    assert.equal(matchesSearch(punch, '秘术'), true)
  }
})

test('boots reuse item Chinese and pinyin aliases while preserving empty rows', () => {
  const boots = [{ id: '3006', name: '狂战士胫甲' }]
  for (const query of ['狂战士', 'kuangzhanshi']) {
    const filtered = filterDetailGroups({ ...groups, boots }, query, index)
    assert.equal(filtered.boots[0], boots[0])
    assert.equal(filtered.items.length, 0)
    assert.ok('kGold' in filtered)
  }
  assert.equal(filterDetailGroups({ boots }, '不存在', index).boots.length, 0)
})

test('no-shoes statistics match Chinese and pinyin without a catalogue item', () => {
  const groups = { boots: [{ id: '-1', name: '无鞋', noBoots: true }], items: [] }
  for (const query of ['无鞋', 'wuxie', '光脚', 'guangjiao'])
    assert.equal(filterDetailGroups(groups, query, null).boots.length, 1)
  assert.equal(filterDetailGroups(groups, '水银', null).boots.length, 0)
})

test('rune board initials support substrings in both patches and detail search', async () => {
  const { matchesSearch } = await loadTS('../src/search/search.ts')
  for (const patch of ['16.18', '16.19']) {
    const catalogue = JSON.parse(
      readFileSync(
        new URL('../public/search-catalogues/' + patch + '.json', import.meta.url),
        'utf8',
      ),
    )
    assert.deepEqual(Object.keys(catalogue.augmentInitials), Object.keys(catalogue.augments))
    const [id, aliases] = Object.entries(catalogue.augments).find(([, values]) =>
      values.includes('风语者的祝福'),
    )
    const boardAliases = [...aliases, ...catalogue.augmentInitials[id]]
    for (const query of ['fyz', 'zf', 'fyzdzf', 'yzd', 'FYZ', 'ｚｆ', 'f y z', '风语', 'fengyuzhe'])
      assert.equal(matchesSearch(boardAliases, query), true, patch + ' ' + query)
    for (const query of ['fzzf', 'windspeakers', 'doesnotexist'])
      assert.equal(matchesSearch(boardAliases, query), false, query)
    assert.equal(matchesSearch(aliases, 'fyz'), false)
    assert.equal(
      filterDetailGroups({ kPrismatic: [{ id, name: '风语者的祝福' }] }, 'fyz', catalogue)
        .kPrismatic.length,
      1,
    )
  }
})

test('detail and rune suggestions share full and partial initials, including 回归基本功', async () => {
  const { runeSuggestions } = await loadTS('../src/boards/augments/runeSuggestions.ts')
  for (const patch of ['16.18', '16.19']) {
    const catalogue = JSON.parse(
      readFileSync(
        new URL('../public/search-catalogues/' + patch + '.json', import.meta.url),
        'utf8',
      ),
    )
    const [id] = Object.entries(catalogue.augments).find(([, values]) =>
      values.includes('回归基本功'),
    )
    const cell = {
      id,
      name: '回归基本功',
      column: '棱彩',
      winRate: 0.55,
      games: 100,
      lowSample: false,
    }
    for (const query of ['hgjbg', 'hg', 'jbg', 'HG', 'ｈｇ', 'h g', '回归', 'huiguijibengong']) {
      assert.equal(
        filterDetailGroups({ kPrismatic: [cell] }, query, catalogue).kPrismatic[0],
        cell,
        patch + ' ' + query,
      )
      assert.equal(runeSuggestions([cell], query, catalogue)[0], cell, patch + ' ' + query)
    }
    for (const query of ['hgbg', 'doesnotexist'])
      assert.equal(
        filterDetailGroups({ kPrismatic: [cell] }, query, catalogue).kPrismatic.length,
        0,
      )
    const steel = {
      id: Object.entries(catalogue.items).find(([, values]) => values.includes('心之钢'))[0],
      name: '心之钢',
    }
    const boots = { id: '3006', name: '狂战士胫甲' }
    assert.equal(filterDetailGroups({ items: [steel] }, 'xzg', catalogue).items[0], steel)
    assert.equal(filterDetailGroups({ boots: [boots] }, 'zsj', catalogue).boots[0], boots)
  }
})

test('rune detail filters match partial names, hero titles, pinyin and initials across all card kinds', async () => {
  const { matchesRuneDetailSearch } = await loadTS('../src/details/detailSearch.ts')
  const index = {
    items: { 1: ['shouhuzhehaojiao'] },
    augments: { 2: ['jurenshashou'] },
    itemInitials: { 1: ['shzhj'] },
    augmentInitials: { 2: ['jrss'] },
  }
  for (const query of ['巨人', '杀手', 'juren', 'JRSS', 'ｊｒｓｓ'])
    assert.equal(
      matchesRuneDetailSearch('augments', { id: '2', name: '巨人杀手' }, query, index),
      true,
    )
  for (const query of ['号角', 'shouhu', 'shzhj'])
    assert.equal(
      matchesRuneDetailSearch('items', { id: '1', name: '守护者号角' }, query, index),
      true,
    )
  for (const query of ['莫甘', '堕落', 'mogan', 'mgn'])
    assert.equal(
      matchesRuneDetailSearch('heroes', { id: '25', name: '莫甘娜' }, query, index),
      true,
    )
  assert.equal(
    matchesRuneDetailSearch('items', { id: '1', name: '守护者号角' }, '巨人', index),
    false,
  )
  assert.equal(matchesRuneDetailSearch('augments', { id: '2', name: '巨人杀手' }, '', null), true)
  assert.equal(
    matchesRuneDetailSearch('augments', { id: '2', name: '巨人杀手' }, '巨人', null),
    true,
  )
})
