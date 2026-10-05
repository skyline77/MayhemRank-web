/** One vocabulary for inline game stats; icons reuse the local tooltip assets. */
export const statDefinitions = {
  ap: {
    icon: 'ap',
    label: 'Ability power · 法术强度',
    aliases: ['ability power', 'AP', '法术强度', '法強', '法術強度', '法强'],
  },
  ad: {
    icon: 'ad',
    label: 'Attack damage · 攻击力',
    aliases: ['attack damage', 'AD', '攻击力', '攻擊力'],
  },
  haste: {
    icon: 'cdr',
    label: 'Ability haste · 技能急速',
    aliases: [
      'basic ability haste',
      'ultimate haste',
      'summoner spell haste',
      'item haste',
      'ability haste',
      '技能急速',
      '技能加速',
    ],
  },
  cooldownReduction: {
    icon: 'cdr',
    label: 'Cooldown reduction · 冷却缩减',
    aliases: ['cooldown reduction', '冷却缩减', '冷卻縮減'],
  },
  attackSpeed: {
    icon: 'as',
    label: 'Attack speed · 攻击速度',
    aliases: ['attack speed', '攻击速度', '攻擊速度', '攻速'],
  },
  armor: { icon: 'ar', label: 'Armor · 护甲', aliases: ['armor', '护甲', '護甲'] },
  magicResist: {
    icon: 'mr',
    label: 'Magic resistance · 魔法抗性',
    aliases: ['magic resistance', 'magic resist', '魔法抗性', '魔法防御', '魔法防禦', '魔抗'],
  },
  health: { icon: 'hp', label: 'Health · 生命值', aliases: ['health', '生命值'] },
  mana: { icon: 'mana', label: 'Mana · 法力值', aliases: ['mana', '法力值', '魔力值', '法力'] },
  healthRegen: {
    icon: 'regen',
    label: 'Health regeneration · 生命回复',
    aliases: ['health regeneration', 'health regen', '生命回复', '生命回復'],
  },
  manaRegen: {
    icon: 'mgen',
    label: 'Mana regeneration · 法力回复',
    aliases: ['mana regeneration', 'mana regen', '法力回复', '法力回復', '魔力回復'],
  },
  moveSpeed: {
    icon: 'ms',
    label: 'Movement speed · 移动速度',
    aliases: ['movement speed', 'move speed', '移动速度', '移動速度', '移速'],
  },
  crit: {
    icon: 'crit',
    label: 'Critical strike chance · 暴击几率',
    aliases: ['critical strike chance', 'crit chance', '暴击几率', '暴击率', '暴擊機率', '暴擊率'],
  },
  critDamage: {
    icon: 'critx',
    label: 'Critical strike damage · 暴击伤害',
    aliases: ['critical strike damage', 'critical damage', '暴击伤害', '暴擊傷害'],
  },
  magicPen: {
    icon: 'mpen',
    label: 'Magic penetration · 法术穿透',
    aliases: ['magic penetration', '法术穿透', '法術穿透', '魔法穿透'],
  },
  armorPen: {
    icon: 'lethality',
    label: 'Armor penetration · 护甲穿透',
    aliases: ['armor penetration', '护甲穿透', '護甲穿透', '物理穿透'],
  },
  lethality: { icon: 'lethality', label: 'Lethality · 穿甲', aliases: ['lethality', '穿甲'] },
  lifeSteal: {
    icon: 'ls',
    label: 'Life steal · 生命偷取',
    aliases: ['life steal', 'lifesteal', '生命偷取'],
  },
  omnivamp: { icon: 'vamp', label: 'Omnivamp · 全能吸血', aliases: ['omnivamp', '全能吸血'] },
  tenacity: { icon: 'tenacity', label: 'Tenacity · 韧性', aliases: ['tenacity', '韧性', '韌性'] },
  healPower: {
    icon: 'heal',
    label: 'Heal and shield power · 治疗和护盾强度',
    aliases: [
      'heal and shield power',
      'healing and shielding power',
      '治疗和护盾强度',
      '治療和護盾強度',
      '治疗与护盾强度',
      '治療與護盾強度',
    ],
  },
  adaptive: {
    icon: 'adaptive',
    label: 'Adaptive force · 适应之力',
    aliases: ['adaptive force', '适应之力', '適應之力'],
  },
  gold: { icon: 'gold', label: 'Gold · 金币', aliases: ['gold', '金币', '金幣'] },
} as const
export type StatKey = keyof typeof statDefinitions
export interface StatTextToken {
  text: string
  stat?: StatKey
  prefix?: string
}
// 同形词必须按正文语言识别：台服「魔力」是 mana，日服「魔力」是 AP。
export const localizedStatAliases: Record<string, Partial<Record<StatKey, string[]>>> = {
  'zh-TW': {
    ap: ['魔法攻擊', '魔攻'],
    ad: ['物理攻擊', '物攻'],
    armor: ['物理防禦', '物防'],
    magicResist: ['魔防'],
    health: ['生命'],
    mana: ['魔力'],
    moveSpeed: ['跑速'],
    lifeSteal: ['普攻吸血'],
    lethality: ['物理致命'],
    healPower: ['治療及護盾強度'],
    adaptive: ['適性之力'],
    cooldownReduction: ['冷卻時間減免'],
    gold: ['金錢'],
  },
  'ja-JP': {
    ap: ['魔力'],
    ad: ['攻撃力'],
    haste: ['スキルヘイスト'],
    cooldownReduction: ['クールダウン短縮'],
    attackSpeed: ['攻撃速度'],
    armor: ['物理防御'],
    magicResist: ['魔法防御'],
    health: ['体力'],
    mana: ['マナ'],
    healthRegen: ['体力自動回復'],
    manaRegen: ['マナ自動回復'],
    moveSpeed: ['移動速度'],
    crit: ['クリティカル率'],
    critDamage: ['クリティカルダメージ'],
    magicPen: ['魔法防御貫通'],
    armorPen: ['物理防御貫通'],
    lethality: ['脅威'],
    lifeSteal: ['ライフスティール', 'ライフ スティール'],
    omnivamp: ['オムニヴァンプ'],
    tenacity: ['行動妨害耐性'],
    healPower: ['体力回復量とシールド量'],
    adaptive: ['アダプティブフォース'],
    gold: ['ゴールド'],
  },
}
function vocabulary(locale: string) {
  const terms = Object.entries(statDefinitions).flatMap(([key, definition]) =>
    [...definition.aliases, ...(localizedStatAliases[locale]?.[key as StatKey] || [])].map(
      alias => ({ key: key as StatKey, alias }),
    ),
  )
  const keys = new Map(terms.map(({ key, alias }) => [alias.toLowerCase(), key]))
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Identify names first, then include preceding stat qualifiers and numeric values.
  // Chinese names can touch other Chinese characters; English aliases need word boundaries.
  // Sort the raw aliases before escaping so compound attributes win over shorter names.
  const aliases = terms
    .map(t => t.alias)
    .sort((a, b) => b.length - a.length)
    .map(alias => {
      const escaped = escape(alias)
      return /[\u3400-\u9fff]/u.test(alias) ? escaped : '(?<![A-Za-z_])' + escaped + '(?![A-Za-z_])'
    })
    .join('|')
  const pattern = new RegExp('(' + aliases + ')', 'giu')
  return { keys, pattern }
}
const vocabularies = new Map<string, ReturnType<typeof vocabulary>>()
const numericPrefix =
  /[+−-]?[ \t]*(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?[%％]?(?:[ \t]*[–—~～-][ \t]*\d+(?:\.\d+)?[%％]?)?[ \t]*$/
const qualifierPrefix = /(?:(?:最大|额外|額外|基础|基礎)[ \t]*)+$/
export function tokenizeStats(text: string, locale = 'zh-CN'): StatTextToken[] {
  if (!vocabularies.has(locale)) vocabularies.set(locale, vocabulary(locale))
  const { keys, pattern } = vocabularies.get(locale)!
  const tokens: StatTextToken[] = []
  let end = 0
  for (const match of text.matchAll(pattern)) {
    const nameStart = match.index!
    const stat = keys.get(match[1]!.toLowerCase())!
    // Gold-tier is a rarity, not currency; leave the original words untouched.
    const rarity =
      stat === 'gold' && /^(?:[-–]tier|\s+tier)\b/i.test(text.slice(nameStart + match[0].length))
    const before = text.slice(end, nameStart)
    const qualifier = rarity ? '' : before.match(qualifierPrefix)?.[0] || ''
    const numeric = rarity
      ? ''
      : before.slice(0, before.length - qualifier.length).match(numericPrefix)?.[0] || ''
    const prefix = numeric + qualifier
    const start = nameStart - prefix.length
    // 日服纯属性行常把数字写在属性后；不吸收效果叙述中的后续数字。
    const suffix =
      locale === 'ja-JP' && !text.slice(text.lastIndexOf('\n', nameStart - 1) + 1, start).trim()
        ? text
            .slice(nameStart + match[0].length)
            .match(
              /^[ \t]*[+−-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?[%％]?(?=[ \t]*(?:\n|$))/,
            )?.[0] || ''
        : ''
    if (start > end) tokens.push({ text: text.slice(end, start) })
    tokens.push(
      rarity
        ? { text: match[0] }
        : prefix
          ? { text: prefix + match[0] + suffix, stat, prefix }
          : { text: match[0] + suffix, stat },
    )
    end = nameStart + match[0].length + suffix.length
  }
  if (end < text.length) tokens.push({ text: text.slice(end) })
  return tokens
}
