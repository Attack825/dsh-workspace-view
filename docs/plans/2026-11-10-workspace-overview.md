# 工作区总览（dsh-workspace-view）实现计划

> 设计稿：`docs/superpowers/specs/2026-11-10-workspace-overview-design.md`（已批准）

**Goal:** 在 DSH Web 客户端新增一个全宽「工作区总览」面板：跨工作区最近活动 + 可自建分组的工作区卡片，点卡片里的会话直接进入对话。

**Architecture:** 单个 client-side bundle，无 Host 逻辑。`client.js` 通过 `__ModuleLoader__.load` 注册一个 `sidebar.panellist` 图标和 `main` 面板（key 与包名相同）。页面数据全部来自槽位标准 props（`useWorkspaces` / `useSessions` / `useSessionStatus`），分组状态存在 localStorage。官方侧栏与对话页不改动。

**Tech Stack:** Cordis client plugin、React 18（模块表提供）、原生 CSS token、`node --test` 测纯逻辑。

---

## Task 1: 包骨架

**Files:**

- Create: `package.json`
- Create: `cordis.patch.yml`
- Create: `index.js`
- Create: `icon.svg`
- Create: `.gitignore`

**Steps:** 写 `package.json`（`dsh.bundle.patch`、`dsh.client`、`exports["./client"]`）；写 insert 一行的 patch；`index.js` 导出空 `apply`；图标为原创 grid SVG。

**Verify:** `node -e "JSON.parse(require('fs').readFileSync('package.json'))"` 通过；`node --check index.js` 通过。

## Task 2: 纯逻辑与测试

**Files:**

- Create: `lib/state.mjs`（分组状态规范化、增删改移、归组、折叠、搜索/推导辅助）
- Create: `test/state.test.mjs`

**Steps:** 先写测试（normalize 丢弃坏数据、建组自动去重命名、删除组把成员退回未分组、上移下移边界、assign 幂等、visibleSession 排除 subagent/blank/archived），`node --test test/state.test.mjs` 先红；再实现到绿。

**Verify:** `node --test test/state.test.mjs` 全绿。

## Task 3: client bundle 外壳

**Files:**

- Create: `client.js`

**Steps:** `__ModuleLoader__.load` 包住 factory；`require('react')`；注册 NS 的 zh/en 字典；`apply` 里注入样式、`slots.inject('sidebar.panellist')` 注册图标、`slots.inject('main')` 注册页面；组件先用占位标题。

**Verify:** `node --check client.js`；安装后 `cordis_inspect_query` 的 `main` 与 `sidebar.panellist` 出现该 id。

## Task 4: 页面数据推导

**Files:** Modify `client.js`

**Steps:** 由 `useWorkspaces` / `useSessions` / `useSessionStatus` + `lib/state.mjs` 推导卡片（标题、路径、最近活跃、可见会话、置顶优先、状态点）、跨工作区最近 5 条、搜索结果。

**Verify:** 页面显示真实工作区与真实会话标题；subagent 会话不出现。

## Task 5: 页面 UI

**Files:** Modify `client.js`

**Steps:** 工具栏（标题、搜索、新建分组）、最近活动区、分组 section（折叠头 + 网格）、工作区卡片（三段文字 + 3 条会话 + `+N`）、未分组投放区、骨架屏、空状态。

**Verify:** 1280/1920 宽度下布局正常；亮暗主题可读。

## Task 6: 分组交互与持久化

**Files:** Modify `client.js`

**Steps:** 新建/就地改名/删除/上移下移/折叠；卡片「⋯ → 移动到分组」；卡片拖到分组或未分组；分组抓手拖拽排序；全部写 localStorage，刷新保持。

**Verify:** 刷新后分组与折叠保持；清空 localStorage 回到全部未分组。

## Task 7: 安装与验收

**Steps:** `plugin_manager install_bundle`（本目录绝对路径）→ 读 `application`；检查 `main`/`sidebar.panellist` 注册；按设计稿 §11 清单逐条走一遍；修复观察到的问题。

**Verify:** 设计稿验收清单 13 条全部通过，或明确记录未验证项。
