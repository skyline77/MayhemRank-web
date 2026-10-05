# 海斗榜 Vue 前端

本目录已迁入 Vue + TypeScript + Vite 源码、公共素材和测试，入口为 src/main.ts → App.vue。生产构建输出 dist/，本机由 ../python 的服务统一提供页面、API 和快照；香港服务器由 Nginx 提供静态页面并代理 Python 数据接口。

执行 `pnpm install --frozen-lockfile`、`pnpm build`；日常修改用 `pnpm dev`，后端需先在 18767 启动。测试命令为 `pnpm test`。

不修改 dist 作为源码，不把快照复制到 public；游戏统计从 Python 的快照接口按需读取。public 中保留旧版本详情与技能回退数据，因为加载器仍引用它们。

参见 [运行和交接说明](../documents/frontend-handover.md)、[组件与交互说明](../documents/frontend-components.md)。

## 代码检查与格式

| 命令                | 作用                                                      |
| ------------------- | --------------------------------------------------------- |
| `pnpm lint`         | ESLint（Vue、TypeScript 推荐规则，格式规则交给 Prettier） |
| `pnpm format`       | Prettier 格式化全部源码与测试                             |
| `pnpm format:check` | 只检查格式，不修改文件                                    |
| `pnpm build`        | `vue-tsc` 类型检查后构建                                  |
| `pnpm test`         | Node 内置测试运行 tests/*.test.mjs                        |

提交前应保证上述命令全部通过。格式约定见 `.prettierrc.json`：无分号、单引号、每行 100 字符。`vue/attributes-order` 规则已关闭，因为自动重排模板属性会改变 `v-bind` 对象与单独属性之间的覆盖关系。

模板中的事件处理只写单个表达式或函数名；需要多条语句时在 script 中写成具名函数。原因是 Prettier 会把以分号分隔的多条语句拆成多行，并去掉分号，Vue 编译器随后就无法识别。

## 源码目录（2026-10-05 起）

`src/` 按职责分目录。同目录引用使用 `./`，跨目录引用使用 `@/`（指向 `src/`，配置在 `vite.config.ts` 与 `tsconfig.json`）。资源 URL（`new URL(...)`、CSS `url(...)`）仍使用相对路径。

| 目录                                                 | 职责                                                                                                                        |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `app/`                                               | 应用外壳：站内路由（`useSiteRouting`）、浏览器历史与滚动恢复（`pageHistory`）、详情链接、全局快捷键、页面标题、导航尺寸测量 |
| `i18n/`                                              | 界面语言（`locale`、`i18n`、`messages.json`）与游戏名称本地化                                                               |
| `data/`                                              | 版本目录、快照资源、浮窗资料、近期改动等数据加载                                                                            |
| `navigation/`                                        | 顶部导航、版本与语言选择、Teleport 到导航的搜索                                                                             |
| `boards/`                                            | 榜单共用：胜率表 `WinRateTable`、条带计算 `boardStrips`、重排动画、横幅、分页、上一版本对比                                 |
| `boards/heroes/` `boards/augments/` `boards/combos/` | 英雄榜、海克斯榜、组合榜，各自的数据整理、搜索与说明文案                                                                    |
| `details/`                                           | 详情共用：展开与滚动动画（`detailScroll`）、统计行与卡片、手机分类 tab、桌面分类展开                                        |
| `details/hero/` `details/rune/`                      | 英雄详情与符文详情                                                                                                          |
| `search/`                                            | 搜索框与候选列表                                                                                                            |
| `tooltip/`                                           | 全局浮窗及其定位、正文读取                                                                                                  |
| `stats/`                                             | 数值格式与配色、属性词高亮                                                                                                  |
| `shared/`                                            | 与业务无关的通用工具（高度过渡、视口内检测、锁定顺序）                                                                      |
| `styles/`                                            | 全局样式，导入顺序与覆盖关系见 `styles/README.md`                                                                           |
| `generated/`                                         | 由数据工具生成的 JSON，不手工编辑                                                                                           |

组件中较长的独立逻辑放在同目录的 `useXxx.ts` 组合式函数中，纯计算放在普通 `.ts` 模块中，以便单独测试。例如英雄榜的流派图标在 `useRoleIcons`，统计说明文案在 `HeroBoardNotes.vue`。

## 测试说明

`tests/load-ts.mjs` 在不经过 Vite 的情况下加载源码：

- `loadTS(path)`：转译 TypeScript 模块，支持 `./` 与 `@/` 引用。
- `loadSFC(path)`：编译单文件组件，供服务端渲染测试使用。
- `scriptSetup(path)`、`stripImports(source)`：取出组件的 `<script setup>`，并按语法树去掉 import，让测试注入替身依赖。

部分测试会直接执行组件源码：`DetailCardList`、`BuildDetail`、`SearchBox`、`RuneHeroChart`、`BoardNavigation`。修改这些组件的 script 时，如果新增了外部依赖，需要同步在对应测试的注入环境中提供。

## 最近验证（2026-10-05）

可读性重构（分支 `refactor/vue-readability`）：前端 253 项测试、ESLint、Prettier 检查、类型检查与生产构建全部通过。在无头 Chrome 中对 41 个场景比较 DOM、布局、滚动位置、标题与 URL 快照，与重构前的构建一致；这些场景覆盖桌面与手机的三个榜单、详情开关、列筛选、分页、浮窗和浏览器后退。构建仍有混合导入和大 chunk 警告，与重构前相同。未部署线上。

此前的测试修复记录见[测试修复记录](../documents/reports/frontend-tests-2026-10-05.md)。
