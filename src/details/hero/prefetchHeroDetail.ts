// 在头像被按下（pointerdown）时提前请求英雄详情所需的数据。
// 各读取函数都按地址缓存请求，点击后详情组件会直接复用这些请求，
// 数据通常能在展开动画开始前到达，避免动画中途再整体重绘一次。
import type { BuildEntry } from '@/boards/heroes/buildBoard'
import { loadHeroDetail } from './heroCohorts'
import { loadHeroRunePairs } from './heroRunePairs'

const ignore = () => {
  /* 预取失败不提示；读取函数已清除失败的缓存，展开时会正常重试并显示错误。 */
}

export function prefetchHeroDetail(entry: BuildEntry, patch: string) {
  // 与 BuildDetail 首次加载相同的筛选：当前流派（按英雄模式时为全部出场）与全部出场
  void loadHeroDetail(entry, patch, { role: entry.role, rune: null }).catch(ignore)
  void loadHeroDetail(entry, patch, { role: null, rune: null }).catch(ignore)
  // 标题与流派选择器中的“未归类”统计
  if (entry.snapshotId) {
    void loadHeroDetail(entry, patch, { role: 'other', rune: null }).catch(ignore)
    void loadHeroRunePairs(entry.championId, patch, entry.snapshotId).catch(ignore)
  }
}
