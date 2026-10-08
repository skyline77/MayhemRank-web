// 详情把一个胜率区间截成上下两段时，上段末行加下内边距、下段首行加上内边距（board-strip-last / -first）。
// 收起时这些类名要等详情卸载后才去掉，两行间距会在最后一帧突然少约 20px。
// 收起一开始直接在 DOM 上给这两行加类名，由 CSS 把内边距随高度动画同步收回；
// 不经过 Vue 是为了避免整表重新渲染（约 12ms，收起首帧会跳过一大段高度）。
// Vue 在详情卸载后重写这两行的 class，这些类名随之消失；中途取消时由返回的函数移除。
export function markSplitClosing(
  panel: HTMLElement | null,
  { end, start }: { end: boolean; start: boolean },
): () => void {
  const marks: [Element, string][] = []
  const above = panel?.previousElementSibling,
    below = panel?.nextElementSibling
  if (end && above?.classList.contains('board-strip')) marks.push([above, 'is-split-closing-end'])
  if (start && below?.classList.contains('board-strip'))
    marks.push([below, 'is-split-closing-start'])
  for (const [row, name] of marks) row.classList.add(name)
  return () => marks.forEach(([row, name]) => row.classList.remove(name))
}
