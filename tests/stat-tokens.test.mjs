import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { loadTS } from './load-ts.mjs'
const { tokenizeStats, statDefinitions, localizedStatAliases } = await loadTS(
  '../src/stats/statTokens.ts',
)

test('Taiwanese and Japanese stat vocabulary maps to stable stat keys without changing source text', () => {
  for (const [locale, stats] of Object.entries(localizedStatAliases)) {
    for (const [key, aliases] of Object.entries(stats))
      for (const alias of aliases) {
        const tokens = tokenizeStats(alias, locale)
        assert.deepEqual(tokens, [{ text: alias, stat: key }], locale + ': ' + alias)
      }
  }
  assert.equal(tokenizeStats('魔力', 'zh-TW')[0].stat, 'mana')
  assert.equal(tokenizeStats('魔力', 'ja-JP')[0].stat, 'ap')
  assert.deepEqual(
    tokenizeStats('攻撃力60\n物理防御 50\nスキルヘイスト15', 'ja-JP')
      .filter(t => t.stat)
      .map(t => t.text),
    ['攻撃力60', '物理防御 50', 'スキルヘイスト15'],
  )
  assert.deepEqual(tokenizeStats('攻撃力60増加', 'ja-JP'), [
    { text: '攻撃力', stat: 'ad' },
    { text: '60増加' },
  ])
  assert.deepEqual(
    tokenizeStats('魔法防御貫通、マナ自動回復', 'ja-JP')
      .filter(t => t.stat)
      .map(t => t.stat),
    ['magicPen', 'manaRegen'],
  )
})

test('real localized Death’s Dance descriptions highlight all three stats in both supported patches', () => {
  for (const patch of ['16.18', '16.19']) {
    const catalogue = JSON.parse(
      readFileSync(new URL('../public/localization/' + patch + '.json', import.meta.url)),
    )
    for (const [locale, data] of Object.entries(catalogue.locales)) {
      const source = data.items['6333'].description.split('\n\n')[0]
      const tokens = tokenizeStats(source, locale)
      assert.equal(tokens.map(t => t.text).join(''), source)
      assert.deepEqual(
        tokens.filter(t => t.stat).map(t => t.stat),
        ['ad', 'armor', 'haste'],
        patch + ' ' + locale,
      )
      for (const item of Object.values(data.items))
        assert.equal(
          tokenizeStats(item.description || '', locale)
            .map(t => t.text)
            .join(''),
          item.description || '',
        )
    }
  }
})
test('scaling formulas preserve all original text and classify attributes', () => {
  const source = '250 – 750 (based on level) (+ 100% AP) (+ 75% bonus AD); gain 100 ability haste.'
  const tokens = tokenizeStats(source)
  assert.equal(tokens.map(t => t.text).join(''), source)
  assert.deepEqual(
    tokens.filter(t => t.stat),
    [
      { text: '+ 100% AP', stat: 'ap', prefix: '+ 100% ' },
      { text: 'AD', stat: 'ad' },
      { text: ' 100 ability haste', stat: 'haste', prefix: ' 100 ' },
    ],
  )
})
test('longer attributes win over their shorter component words', () => {
  const tokens = tokenizeStats(
    '20% armor penetration, 30% magic resistance, 1000% base health regeneration, 15% heal and shield power.',
  )
  assert.deepEqual(
    tokens.filter(t => t.stat).map(t => t.stat),
    ['armorPen', 'magicResist', 'healthRegen', 'healPower'],
  )
})
test('plain words and rarity are not mistaken for stats', () => {
  const tokens = tokenizeStats(
    'ADAPt grants a Gold-tier augment. Gain gold 250; adaptive force and AP apply.',
  )
  assert.deepEqual(
    tokens.filter(t => t.stat).map(t => t.stat),
    ['gold', 'adaptive', 'ap'],
  )
  assert.equal(
    tokenizeStats('Shadow Runner, APocalypse, shadow.').some(t => t.stat),
    false,
  )
})
test('all imported descriptions retain exact text and use available icons', () => {
  const data = JSON.parse(
    readFileSync(new URL('../public/rune-descriptions/wiki-en-20260925.json', import.meta.url)),
  )
  for (const row of Object.values(data.entries))
    assert.equal(
      tokenizeStats(row.description)
        .map(t => t.text)
        .join(''),
      row.description,
    )
  for (const stat of Object.values(statDefinitions))
    assert.ok(
      existsSync(new URL('../public/stat-icons/' + stat.icon + '.webp', import.meta.url)),
      stat.icon,
    )
})

test('continuous Chinese descriptions decorate only the stat name, never its surrounding phrase', () => {
  assert.deepEqual(tokenizeStats('使你的总法术强度提升30%。'), [
    { text: '使你的总' },
    { text: '法术强度', stat: 'ap' },
    { text: '提升30%。' },
  ])
  const source = '获得55%额外攻击力，每100法术强度获得3.5%移动速度；最大生命值增加100–200。'
  const tokens = tokenizeStats(source)
  assert.equal(tokens.map(t => t.text).join(''), source)
  assert.deepEqual(
    tokens.filter(t => t.stat).map(t => t.text),
    ['55%额外攻击力', '100法术强度', '3.5%移动速度', '最大生命值'],
  )
})
test('Chinese compound attributes, traditional aliases and adjacent formula abbreviations remain distinct', () => {
  const source =
    '100%基础生命回复、20护甲穿透、30法术穿透、10法力回复；50法術強度、20攻擊力、5移動速度；(+55%AP)、100AD。'
  const tokens = tokenizeStats(source)
  assert.equal(tokens.map(t => t.text).join(''), source)
  assert.deepEqual(
    tokens.filter(t => t.stat).map(t => t.stat),
    ['healthRegen', 'armorPen', 'magicPen', 'manaRegen', 'ap', 'ad', 'moveSpeed', 'ap', 'ad'],
  )
  assert.deepEqual(
    tokenizeStats('冷却缩减与技能急速')
      .filter(t => t.stat)
      .map(t => t.stat),
    ['cooldownReduction', 'haste'],
  )
})
test('both tooltip catalogues preserve text and every supported stat row produces exactly one icon', () => {
  for (const patch of ['16.18', '16.19']) {
    const catalogue = JSON.parse(
      readFileSync(new URL('../public/tooltip-catalogues/' + patch + '.json', import.meta.url)),
    )
    for (const row of [...Object.values(catalogue.items), ...Object.values(catalogue.augments)]) {
      const source = row.description
      assert.equal(
        tokenizeStats(source)
          .map(t => t.text)
          .join(''),
        source,
      )
      for (const line of row.lines || []) {
        if (line.kind === 'stat' && line.icon)
          assert.equal(tokenizeStats(line.text).filter(t => t.stat).length, 1, line.text)
      }
    }
  }
})

test('preceding values share the stat color but following values and intervening words do not', () => {
  assert.deepEqual(tokenizeStats('你的雪球获得100技能急速。'), [
    { text: '你的雪球获得' },
    { text: '100技能急速', stat: 'haste', prefix: '100' },
    { text: '。' },
  ])
  for (const value of ['55%', '3.5%', '+20 ', '100–200 ', '1,000', '30％']) {
    assert.deepEqual(tokenizeStats(value + '法术强度'), [
      { text: value + '法术强度', stat: 'ap', prefix: value },
    ])
  }
  assert.deepEqual(tokenizeStats('法术强度提升30%'), [
    { text: '法术强度', stat: 'ap' },
    { text: '提升30%' },
  ])
  assert.deepEqual(tokenizeStats('持续5秒，获得技能急速'), [
    { text: '持续5秒，获得' },
    { text: '技能急速', stat: 'haste' },
  ])
})

test('maximum, bonus and base qualifiers join their stat color along with preceding values', () => {
  assert.deepEqual(tokenizeStats('获得2%最大法力值的额外攻击力。'), [
    { text: '获得' },
    { text: '2%最大法力值', stat: 'mana', prefix: '2%最大' },
    { text: '的' },
    { text: '额外攻击力', stat: 'ad', prefix: '额外' },
    { text: '。' },
  ])
  assert.deepEqual(tokenizeStats('100%基础生命回复'), [
    { text: '100%基础生命回复', stat: 'healthRegen', prefix: '100%基础' },
  ])
  for (const prefix of ['最大', '额外', '基础', '額外', '基礎', '50% 最大', '100%基础 ']) {
    assert.deepEqual(tokenizeStats(prefix + '生命值'), [
      { text: prefix + '生命值', stat: 'health', prefix },
    ])
  }
  assert.deepEqual(tokenizeStats('最大提升30%法术强度'), [
    { text: '最大提升' },
    { text: '30%法术强度', stat: 'ap', prefix: '30%' },
  ])
  assert.deepEqual(tokenizeStats('法术强度提升30%'), [
    { text: '法术强度', stat: 'ap' },
    { text: '提升30%' },
  ])
})
