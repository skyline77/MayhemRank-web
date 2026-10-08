// 英雄详情的统计分组：桌面按行展示，手机按 tab 切换。

/** 桌面统计行：三种品质的海克斯与常见装备 */
export const statGroups = [
  { id: 'kPrismatic', name: '棱彩海克斯', label: '棱彩', css: 'prismatic' },
  { id: 'kGold', name: '黄金海克斯', label: '黄金', css: 'gold' },
  { id: 'kSilver', name: '白银海克斯', label: '白银', css: 'silver' },
  { id: 'items', name: '常见装备', label: '装备', css: 'items' },
]

export const bootsGroup = { id: 'boots', name: '鞋子', label: '鞋子', css: 'items' }

/** 手机 tab 顺序：装备、棱彩、黄金、白银、组合（装备在首位，打开详情默认显示装备） */
export const mobileTabs = [
  ...statGroups.slice(3).map(group => ({ id: group.id, label: group.label, css: group.css })),
  ...statGroups.slice(0, 3).map(group => ({ id: group.id, label: group.label, css: group.css })),
  { id: 'pairs', label: '组合', css: 'pairs' },
]
