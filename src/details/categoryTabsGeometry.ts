// 手机详情分类 tab 的纯几何计算：卡片网格列数与间距、下划线位置、文字高亮裁切。

/** tab 文字相对 tab 栏左边缘的横向范围 */
export interface TabTextBound {
  left: number
  width: number
}

const cardWidth = 76

/**
 * 76px 卡片网格：列数按 82px（卡宽 + 最小间距）估算；
 * 两侧各占两个间距，即 总宽 = 卡宽 × 列数 + 间距 × (列数 + 3)。
 */
export function cardGrid(width: number) {
  const columns = Math.max(1, Math.floor((width + 6) / 82))
  const gap = Math.max(0, (width - columns * cardWidth) / (columns + 3))
  return { columns, gap }
}

/** 分类内容区的 CSS 变量：网格列数与间距、分页按钮对齐 tab 文字的内缩、组合卡片宽度。 */
export function categoryGridVars(width: number, bounds: TabTextBound[]) {
  const { columns, gap } = cardGrid(width)
  const last = bounds.at(-1)
  return {
    '--mobile-columns': String(columns),
    '--mobile-card-gap': gap + 'px',
    '--tab-left': '0px',
    '--tab-width': '28px',
    // 上一页按钮左边对齐第二个 tab 文字，下一页按钮右边对齐最后一个 tab 文字
    '--pager-start-inset': Math.max(0, (bounds[1]?.left ?? width / 5) - width / 5) + 'px',
    '--pager-end-inset': Math.max(0, width - ((last?.left ?? width) + (last?.width ?? 0))) + 'px',
    '--mobile-pair-width': (width - 5 * gap) / 2 + 'px',
  } as Record<string, string>
}

/**
 * 下划线按滚动进度（0 = 第一个 tab，1 = 第二个……）在相邻 tab 文字范围之间线性插值。
 */
export function indicatorSpan(bounds: TabTextBound[], progress: number) {
  const clamped = Math.max(0, Math.min(bounds.length - 1, progress))
  const index = Math.floor(clamped),
    fraction = clamped - index
  const from = bounds[index]!,
    to = bounds[Math.min(index + 1, bounds.length - 1)]!
  return {
    left: from.left + (to.left - from.left) * fraction,
    width: from.width + (to.width - from.width) * fraction,
  }
}

/** 黄色高亮文字只显示与下划线重叠的部分，可覆盖半个字。 */
export function highlightClip(text: TabTextBound, span: { left: number; width: number }) {
  const start = Math.max(0, Math.min(text.width, span.left - text.left))
  const end = Math.max(start, Math.min(text.width, span.left + span.width - text.left))
  return `inset(0 ${text.width - end}px 0 ${start}px)`
}
