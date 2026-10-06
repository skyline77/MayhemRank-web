// UI 方案试用（ui/hero-board-themes 分支）：在原有深浅主题之上叠加一套配色与局部样式。
// 方案由地址参数 ?skin=a|b|off 或右下角切换器选择，记在本机；
// 方案均为深色（保留黑金招牌），切回原版时恢复用户原来的主题。
import { ref } from 'vue'

export const skins = [
  { id: '', label: '原版' },
  { id: 'a', label: 'A 精工·衬线' },
  { id: 'b', label: 'B 精工·无衬线' },
] as const
export type SkinId = (typeof skins)[number]['id']

const isSkin = (value: string | null): value is SkinId => skins.some(skin => skin.id === value)

function read(): SkinId {
  const param = new URLSearchParams(location.search).get('skin')
  if (param === 'off') return ''
  if (isSkin(param)) return param
  try {
    const saved = localStorage.getItem('team-skin')
    return isSkin(saved) ? saved : ''
  } catch {
    return ''
  }
}

export const skin = ref<SkinId>(read())

export function applySkin(next: SkinId) {
  skin.value = next
  const root = document.documentElement
  try {
    localStorage.setItem('team-skin', next)
  } catch {
    /* 隐私模式下不记忆 */
  }
  if (next) {
    root.dataset.skin = next
    root.dataset.theme = 'dark'
  } else {
    delete root.dataset.skin
    root.dataset.theme = localStorage.getItem('team-theme') || 'dark'
  }
}
