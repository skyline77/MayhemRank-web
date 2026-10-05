# 共享样式归属与迁移规则

入口为 `src/style.css` → `styles/index.css`。组件专属样式仍保留在 Vue 的 scoped style 中。

本轮采用保序拆分：index.css 的导入顺序与旧 style.css 完全一致。文件间仍有历史覆盖关系，不得按字母排序导入、直接合并媒体查询或批量删除重复选择器。响应式整理应单独验证对应断点与主题。

| 文件 | 主要归属 |
| --- | --- |
| tokens.css | 深浅主题、颜色与公共尺寸变量 |
| base.css | 基础元素与键盘焦点 |
| layout.css | 页面宽度与基础布局 |
| details/base.css | 原始详情布局及早期响应式兼容规则 |
| boards/shared.css | 榜单、卡片及表格的基础规则 |
| details/cards.css | 详情卡片、装备、提示层与详情吸顶 |
| navigation.css | 搜索、版本选择、导航基础及早期海克斯列布局 |
| details/augments.css | 海克斯详情、统计语义与版本说明 |
| boards/responsive.css | 英雄与海克斯榜响应式几何 |
| navigation-controls.css | 导航后置规则与 BoardModeSwitch 的公共样式 |
| boards/interactions.css | 筛选、表头与卡片动画布局 |
| page-motion.css | 页面背景、导航状态与页面过渡 |
| boards/geometry.css | 后置卡片尺寸和移动端几何修正 |

这是第一轮迁移。混合职责的历史段落已明确标记，后续可在验证覆盖关系后进一步归并。新规则应加入对应模块，组件专属规则写在组件中，不在入口追加样式。

BoardModeSwitch 保留 hero-ranking-mode / ranking-mode-indicator 类名，使 Banner 和现有响应式规则继续生效。其通用样式暂存 navigation-controls.css。BoardPagination 自带 scoped 样式，父级仅负责摆放。
