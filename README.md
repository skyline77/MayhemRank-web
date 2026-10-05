# 海斗榜 Vue 前端

本目录已迁入 Vue + TypeScript + Vite 源码、公共素材和测试，入口为 src/main.ts → App.vue。生产构建输出 dist/，由 ../python 的服务统一提供页面、API 和快照。

执行 `pnpm install --frozen-lockfile`、`pnpm build`；日常修改用 `pnpm dev`，后端需先在 18767 启动。测试命令为 `pnpm test`。

不修改 dist 作为源码，不把快照复制到 public；游戏统计从 Python 的快照接口按需读取。public 中保留旧版本详情与技能回退数据，因为加载器仍引用它们。

参见 [运行和交接说明](../documents/frontend-handover.md)。
