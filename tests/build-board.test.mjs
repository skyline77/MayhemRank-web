import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { loadTS } from './load-ts.mjs'
const { buildRows, buildStrips, columns, columnCapacities, championWinRates } = await loadTS(
  '../src/boards/heroes/buildBoard.ts',
)
const entry = (id, winRate, column = 'AP输出', extra = {}) => ({
  id,
  winRate,
  column,
  name: '茂凯',
  role: 'AP',
  interval: [0.4, 0.6],
  games: 500,
  lowSample: false,
  ...extra,
})
test('two-point bands include lower boundary and omit all empty rows', () => {
  const rows = buildRows([entry('a', 0.5), entry('b', 0.51999), entry('c', 0.52), entry('d', 0.58)])
  assert.deepEqual(
    rows.map(r => r.lower),
    [58, 52, 50],
  )
  assert.equal(rows[2].cells[columns.indexOf('AP输出')].length, 2)
  assert.equal(rows[1].cells[columns.indexOf('AP输出')][0].id, 'c')
  assert.equal(rows[0].cells.length, 6)
  assert.equal(rows[0].cells[0].length, 0)
})
test('same hero can occur in multiple columns with distinct statistics', () => {
  const rows = buildRows([entry('57:AP', 0.48), entry('57:tank', 0.53, '坦克', { role: '坦克' })])
  assert.equal(rows[0].cells[0][0].id, '57:tank')
  assert.equal(rows[1].cells[columns.indexOf('AP输出')][0].id, '57:AP')
  assert.deepEqual(columns, ['坦克', '战士', '刺客', 'AD输出', 'AP输出', '辅助'])
})
test('search prunes empty bands and leaves labels and order intact', () => {
  const values = [
    entry('low', 0.501),
    entry('high', 0.517),
    entry('other', 0.55, '战士', { name: '格温', role: 'AP战士' }),
  ]
  assert.deepEqual(
    buildRows(values, '茂凯')[0].cells[columns.indexOf('AP输出')].map(e => e.id),
    ['high', 'low'],
  )
  assert.equal(buildRows(values, '格温')[0].cells[columns.indexOf('战士')][0].id, 'other')
  assert.equal(buildRows(values, '不存在').length, 0)
  assert.equal(buildRows([entry('tiny', 0.8, '辅助', { lowSample: true })]).length, 0)
})

const { default: championSearch } = await loadTS('../src/data/championSearch.ts')
test('all board heroes have Chinese names, titles and pinyin', () => {
  const snapshot = JSON.parse(
    readFileSync(
      new URL('../../python/src/team_site/snapshots/build_roles_16_18.json', import.meta.url),
      'utf8',
    ),
  )
  for (const hero of snapshot.champions) assert.ok(championSearch[hero.id]?.length >= 3, hero.name)
})
test('search matches Chinese titles and pinyin, excluding English names and codes', () => {
  const mao = [
    entry('57:AP', 0.49, 'AP输出', { searchTerms: championSearch[57] }),
    entry('57:tank', 0.5, '坦克', { searchTerms: championSearch[57] }),
  ]
  for (const query of ['茂凯', '扭曲树精', 'maokai', ' MAOKAI ', 'Ｍａｏｋａｉ']) {
    assert.equal(buildRows(mao, query).flatMap(r => r.cells.flat()).length, 2, query)
  }
  const monkey = [entry('62', 0.5, '战士', { name: '孙悟空', searchTerms: championSearch[62] })]
  for (const query of ['齐天大圣', 'Wukong', 'sunwukong'])
    assert.equal(buildRows(monkey, query).length, 1, query)
  const cho = [entry('31', 0.5, '坦克', { name: '科加斯', searchTerms: championSearch[31] })]
  for (const query of ["Cho'Gath", 'cho gath', 'chogath'])
    assert.equal(buildRows(cho, query).length, 0, query)
  for (const query of ['MonkeyKing', 'monkey king'])
    assert.equal(buildRows(monkey, query).length, 0, query)
  assert.equal(buildRows(mao, 'Twisted Treant').length, 0)
  assert.equal(buildRows(mao, 'Wukong').length, 0)
})

test('header role filter is exact, combines with search, and clears back to all builds', () => {
  const entries = [
    entry('57:tank', 0.5, '坦克', { searchTerms: championSearch[57] }),
    entry('57:AP', 0.49, 'AP输出', { searchTerms: championSearch[57] }),
    entry('other', 0.55, '坦克', { name: '奥恩' }),
  ]
  const visible = (query, role) =>
    buildRows(entries, query, role)
      .flatMap(r => r.cells.flat())
      .map(e => e.id)
  assert.deepEqual(visible('', '坦克'), ['other', '57:tank'])
  assert.deepEqual(visible('maokai', '坦克'), ['57:tank'])
  assert.deepEqual(visible('maokai', 'AP输出'), ['57:AP'])
  assert.deepEqual(visible('', '辅助'), [])
  assert.equal(visible('', '').length, 3)
  assert.deepEqual(
    buildRows(entries, '', '坦克').map(r => r.lower),
    [54, 50],
  )
})

test('visual strips preserve role capacity, ordering and every build without duplicates', () => {
  const entries = columns.flatMap((column, i) =>
    Array.from({ length: columnCapacities[i] + 1 }, (_, j) =>
      entry(`${i}:${j}`, 0.55 - j / 1000, column),
    ),
  )
  const strips = buildStrips(buildRows(entries))
  assert.equal(strips.length, 2)
  assert.deepEqual(
    strips[0].cells.map(cell => cell.length),
    [3, 3, 2, 3, 3, 2],
  )
  assert.deepEqual(
    strips[1].cells.map(cell => cell.length),
    [1, 1, 1, 1, 1, 1],
  )
  assert.deepEqual(
    strips.map(s => [s.key, s.last]),
    [
      ['54:0', false],
      ['54:1', true],
    ],
  )
  for (let i = 0; i < columns.length; i++)
    assert.deepEqual(
      strips.flatMap(s => s.cells[i]).map(e => e.id),
      entries.filter(e => e.column === columns[i]).map(e => e.id),
    )
  assert.equal(new Set(strips.flatMap(s => s.cells.flat()).map(e => e.id)).size, entries.length)
})

test('expansion anchor falls between Yi and Aurora, with stable band boundaries after filtering', () => {
  const entries = [
    entry('yi', 0.551, 'AD输出'),
    entry('kayle', 0.545, 'AD输出'),
    entry('viego', 0.542, 'AD输出'),
    entry('aurora', 0.541, 'AD输出'),
    entry('tank', 0.59, '坦克'),
  ]
  const strips = buildStrips(buildRows(entries))
  const index = strips.findIndex(s => s.cells.flat().some(e => e.id === 'yi'))
  assert.equal(strips[index].key, '54:0')
  assert.deepEqual(
    strips[index + 1].cells.flat().map(e => e.id),
    ['aurora'],
  )
  assert.equal(buildStrips(buildRows(entries, '', 'AD输出'))[0].key, '54:0')
  assert.deepEqual(buildStrips(buildRows(entries, 'no-match')), [])
})

test('pinyin searches names and titles with partial, full, spaced and uppercase input', () => {
  const heroes = [
    entry('kayle', 0.54, 'AP输出', { name: '凯尔', searchTerms: championSearch[10] }),
    entry('maokai', 0.51, '坦克', { searchTerms: championSearch[57] }),
  ]
  const ids = query =>
    buildRows(heroes, query)
      .flatMap(row => row.cells.flat())
      .map(e => e.id)
  for (const query of [
    'kaier',
    'ka',
    'tia',
    'KAI ER',
    "kai'er",
    'tianshi',
    'shenpantianshi',
    '审判天使',
  ])
    assert.ok(ids(query).includes('kayle'), query)
  for (const query of ['maokai', 'niuqushujing', '扭曲树精'])
    assert.ok(ids(query).includes('maokai'), query)
  assert.deepEqual(ids('kaier'), ['kayle'])
  assert.deepEqual(ids('notachampion'), [])
  assert.deepEqual(ids('Kayle'), [])
  const leblanc = [
    entry('leblanc', 0.5, '刺客', { name: '乐芙兰', searchTerms: championSearch[7] }),
  ]
  for (const query of ['lefulan', 'yuefulan']) assert.equal(buildRows(leblanc, query).length, 1)
})

test('mobile merges roles without changing records, preserves sorted order and splits into pairs', () => {
  const values = columns.map((column, i) => entry(String(i), 0.54 + i * 0.001, column))
  const rows = buildRows(values, '', '', true)
  assert.deepEqual(
    rows[0].cells.map(cell => cell.map(e => e.id)),
    [
      ['5', '0'],
      ['2', '1'],
      ['4', '3'],
    ],
  )
  for (const cell of rows[0].cells)
    for (const item of cell)
      assert.equal(
        item,
        values.find(e => e.id === item.id),
      )
  const more = [...values, entry('extra', 0.55, '辅助')]
  const strips = buildStrips(buildRows(more, '', '', true), true)
  assert.deepEqual(
    strips.map(s => s.cells.map(c => c.length)),
    [
      [2, 2, 2],
      [1, 0, 0],
    ],
  )
  assert.equal(new Set(strips.flatMap(s => s.cells.flat()).map(e => e.id)).size, more.length)
  assert.deepEqual(
    buildRows(values, '', '坦辅', true)[0].cells.map(c => c.map(e => e.id)),
    [['5', '0'], [], []],
  )
  assert.equal(buildRows(values, '不存在', '坦辅', true).length, 0)
})

test('overall hero rates pool role counters, include small roles and smooth only once', () => {
  const values = [
    entry('one', 0.91, '坦克', { championId: 1, games: 10, wins: 9, lowSample: true }),
    entry('two', 0.11, 'AP输出', { championId: 1, games: 90, wins: 9 }),
    entry('other', 0.8, '战士', { championId: 2, games: 20, wins: 16 }),
  ]
  const totals = championWinRates(values)
  assert.deepEqual(totals.get(1), { games: 100, wins: 18, winRate: 19 / 102 })
  assert.equal(totals.get(2).winRate, 17 / 22)
  assert.equal(totals.has(3), false)
  assert.equal(championWinRates([]).size, 0)
  assert.equal(
    championWinRates([entry('empty', 0, '坦克', { championId: 1, games: 0, wins: 0 })]).size,
    0,
  )
})

test('hero board matches name/title initials and their contiguous substrings', () => {
  const heroes = [
    entry('yasuo', 0.54, 'AD输出', { name: '亚索', searchTerms: championSearch[157] }),
    entry('maokai', 0.51, '坦克', { searchTerms: championSearch[57] }),
  ]
  for (const compact of [false, true]) {
    const ids = query =>
      buildRows(heroes, query, '', compact)
        .flatMap(row => row.cells.flat())
        .map(e => e.id)
    for (const query of [
      'ys',
      'jfjh',
      'jf',
      'fj',
      'jh',
      'YS',
      'ＪＦＪＨ',
      'j f j h',
      '亚索',
      '疾风',
      'yasuo',
    ])
      assert.ok(ids(query).includes('yasuo'), query)
    assert.deepEqual(ids('jfh'), [], 'initials use substrings, not arbitrary skipped letters')
    assert.deepEqual(ids('mk'), ['maokai'])
  }
  const kayle = [entry('kayle', 0.54, 'AP输出', { name: '凯尔', searchTerms: championSearch[10] })]
  for (const query of ['ke', 'zyts', 'spts']) assert.equal(buildRows(kayle, query).length, 1, query)
  const leblanc = [
    entry('leblanc', 0.5, '刺客', { name: '乐芙兰', searchTerms: championSearch[7] }),
  ]
  for (const query of ['lfl', 'yfl']) assert.equal(buildRows(leblanc, query).length, 1, query)
})

test('old cached role-only boards retry without cache, not a disabled hero switch', async () => {
  const { fetchBoardPayload } = await loadTS('../src/boards/heroes/buildBoard.ts')
  const original = globalThis.fetch,
    calls = []
  const legacy = { meta: { patch: '16.19', snapshotId: 'generation' }, entries: [] }
  const current = { ...legacy, heroEntries: [{ id: '13:all' }] }
  globalThis.fetch = async (url, options) => {
    calls.push(options)
    return { ok: true, json: async () => (calls.length === 1 ? legacy : current) }
  }
  try {
    assert.equal(await fetchBoardPayload('/board', '16.19', 'generation'), current)
    assert.equal(calls.length, 2)
    assert.equal(calls[1].cache, 'no-store')
    globalThis.fetch = async () => ({ ok: true, json: async () => legacy })
    await assert.rejects(fetchBoardPayload('/board', '16.19', 'generation'), /英雄整体统计/)
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ ...current, meta: { patch: '16.18', snapshotId: 'generation' } }),
    })
    await assert.rejects(fetchBoardPayload('/board', '16.19', 'generation'), /版本不一致/)
  } finally {
    globalThis.fetch = original
  }
})
