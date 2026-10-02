# TECH_DESIGN.md ·「每日日记」技术设计

> v2｜2026-09-28｜依据 PRD.md v2 重写；v1（纯前端版）见提交历史 c56cbfb
> 一句话：MVP 用最少的零件保住「数据不出浏览器」；云同步升级路线（React/Vite + CloudBase 云函数 + PostgreSQL）已完整设计好，随时可切换。

## 0. 待确认问题与临时假设

| # | 问题 | 临时假设（可在确认后推翻） |
|---|---|---|
| Q1 | PRD 明确「数据不上传、无账号」，而后端路线必然上云。默认推荐哪条？ | MVP 保持纯前端（路线 A）；路线 C 作为升级设计文档化，切换时同步修订 PRD（隐私说明、F5、§8） |
| Q2 | 昨天已入库 v1，本版如何处理？ | v2 全量替换；v1 在 git 历史 c56cbfb，可随时找回 |
| Q3 | CloudBase 是否已注册并开通环境？ | 假设未开通：环境变量均为占位符，本文档不触发任何仓库外操作 |
| Q4 | 本版是否立即 commit + push？ | 先不入库，等你确认后按收尾流程提交 |

## 1. 选型比较（零基础视角，每层 2–3 套）

### 1.1 前端

| 候选 | 对零基础友好 | 与本项目匹配 | 主要代价 |
|---|---|---|---|
| 原生 HTML/CSS/JS | ★★★ 每个零件可一句话讲清 | MVP 仅两个视图，完全够用 | 视图和状态变多后要手工管理 DOM |
| React + Vite | ★★ 需学组件/JSX/npm/构建 | 状态集中在组件里，做云同步版时结构化优势明显 | 一整套工具链新概念 + 构建步骤 |
| Vue + Vite | ★★ 模板语法更接近 HTML | 同 React | 同样需要构建链 |

### 1.2 后端

| 候选 | 优势 | 代价 / 风险 |
|---|---|---|
| 无后端（localStorage） | 零运维、零成本，PRD「隐私默认」直接成立 | 数据锁死在单个浏览器，换设备/清缓存即失 |
| CloudBase Node.js 云函数（示范路线） | 免运维（不用管服务器/HTTPS）、按量付费、与 CloudBase 静态托管同生态、国内访问好 | 厂商锁定；**与 PRD「不上传服务器」直接冲突**，采用须改需求 |
| 自建 Node.js + Express | 自由度最高，学到真实服务器知识 | 零基础要自己管部署、HTTPS、安全补丁，成本最高 |

### 1.3 数据库

| 候选 | 优势 | 代价 / 风险 |
|---|---|---|
| localStorage（当数据库用） | 浏览器自带，同步 API 简单 | 上限约 5MB、只能存字符串、不能跨设备 |
| CloudBase PostgreSQL（示范路线） | 真关系型，SQL 通用、将来换平台迁移性最好 | 必须有后端配合；有付费额度门槛 |
| CloudBase 文档型数据库 | JSON 结构与现有数据模型最像 | 关系查询与约束弱于 SQL |

### 1.4 部署

| 候选 | 优势 | 代价 / 风险 |
|---|---|---|
| GitHub Pages | 仓库已存在，push 即上线，零成本 | 仅静态；国内访问速度一般 |
| CloudBase 静态网站托管（示范路线） | CDN 加速，与云函数/PostgreSQL 一条链路打通 | 需开通云账号，与路线 A 无关 |
| Vercel / Netlify | 部署体验极佳 | 国内访问不稳定 |

## 2. 推荐默认路线与取舍

**默认（MVP）＝路线 A：原生 HTML/CSS/JS + localStorage + GitHub Pages。**
**升级路线（登录 + 云同步上线时）＝路线 C：React/Vite + CloudBase Node.js 云函数 + CloudBase PostgreSQL + CloudBase 静态托管。**

取舍说明：

1. **路线 A 赢在「与 PRD 完全咬合」**：无后端 → 无账号 → 无上传，隐私理念是「天然成立」而不是「承诺做到」；且零件最少，符合 30 天学习计划的节奏。
2. **路线 C 的能力 A 也有，但当前用不上**：云函数和 PostgreSQL 解决的是「跨设备共享数据 + 并发 + 鉴权」，而 MVP 明确不支持多设备实时同步（PRD §2）。
3. **路线 C 的隐性成本不是技术，是需求变更**：一旦上云，「日记只保存在此浏览器，不会上传」这句页面文案和 F5 三条验收标准全部要改，还需要引入登录（PRD 把登录列在后续第 9 项）。
4. **因此切换时点是「后续功能第 9 项（登录 + 云同步）立项时」**，本文档第 4–9 章已按路线 C 把数据模型、API、迁移方案写好，届时可直接施工。

## 3. 项目结构

### 路线 A（MVP，现行）

```
my-website/
├── index.html        # 唯一页面：列表视图 + 详情视图（切换显示，无路由库）
├── style.css         # 手机单列 + 桌面窄栏（flex + max-width）
├── app.js            # 全部逻辑：输入校验 / 渲染 / 读写 localStorage
├── data-flow.svg     # 数据流图（§6 引用）
├── PRD.md / TECH_DESIGN.md / research.md
```

无 package.json、无 node_modules、无构建命令——编辑文件后刷新浏览器即生效。

### 路线 C（升级时新建，结构预留）

```
my-website/
├── frontend/                 # React + Vite
│   ├── index.html
│   ├── src/
│   │   ├── main.jsx / App.jsx
│   │   ├── pages/            # ListView.jsx, DetailView.jsx（对应 PRD §5 两视图）
│   │   ├── components/       # DiaryItem, EmptyState, PrivacyNote…
│   │   └── lib/api.js        # 唯一的后端访问出口（方便换实现/做测试）
│   └── .env.example          # VITE_API_BASE_URL 占位
├── functions/                # CloudBase 云函数（Node.js）
│   ├── diaries/              # 日记 CRUD 一个函数（index.js + package.json）
│   └── migrate-from-local/   # 一次性迁移函数（见 §9）
└── docs/
```

## 4. 数据模型

### 4.1 路线 A：localStorage（键 `diary.entries`）

JSON 数组，元素与 PRD §6 五字段一一对应：

```json
{
  "id": "a1b2c3d4",
  "date": "2026-09-28",
  "text": "今天学会给 PRD 写验收标准",
  "favorite": false,
  "createdAt": "2026-09-28T22:30:00"
}
```

- `id`：`crypto.randomUUID()` 去横线，用户不可见，用于详情定位与收藏挂靠
- 写规则：读数组 → 头部插入 → 写回；读规则：按 `date` + `createdAt` 倒序渲染
- 同一天多条独立成条，按 `createdAt` 排序（对应 PRD §7）

### 4.2 路线 C：PostgreSQL 表结构

```sql
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT UNIQUE               -- 登录体系接入后绑定
);

CREATE TABLE diaries (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id),
  entry_date DATE NOT NULL,             -- 对应「日期」，记录所属日
  content    TEXT NOT NULL,             -- 应用层校验：btrim 后非空（PRD §7）
  favorite   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),   -- UTC 存储，展示转本地
  deleted_at TIMESTAMPTZ,               -- 软删除：支持「写错能删」+ 误删恢复
  CHECK (length(btrim(content)) > 0)
);

CREATE INDEX idx_diaries_user_date
  ON diaries (user_id, entry_date DESC, created_at DESC);
```

迁移映射：`text→content`、`date→entry_date`、`favorite→favorite`、`createdAt→created_at`、`id→id`（保留原值，见 §9）。

## 5. API 列表（路线 C；路线 A 无 API）

统一前缀 `/api`，JSON 请求/响应，鉴权中间件校验登录态（MVP 后接入）：

| 方法 | 路径 | 用途 | 请求体 | 成功响应 | 对应 PRD |
|---|---|---|---|---|---|
| GET | `/api/diaries?limit=20&cursor=…` | 列表，按日期+创建时间倒序，游标分页 | — | `200` 条目数组 | F2 |
| POST | `/api/diaries` | 写一条日记 | `{content, entryDate?}` | `201` 新条目 | F1 |
| GET | `/api/diaries/:id` | 单条详情 | — | `200` 条目 | F3 |
| PATCH | `/api/diaries/:id/favorite` | 收藏 / 取消 | `{favorite: true\|false}` | `200` 条目 | F4 |
| DELETE | `/api/diaries/:id` | 软删除（写 `deleted_at`） | — | `204` | 后续第一批 #2 |
| GET | `/api/health` | 健康检查（部署验证用） | — | `200 {ok:true}` | 运维 |

约定：条目 JSON 与 §4.2 字段同名转驼峰；列表空时返回 `[]`（前端据此显示「写下第一句吧」）。

## 6. 前后端数据流

**路线 A（现行，已画图 data-flow.svg）**：
你在输入框敲一句话 → 点保存 → JS 校验非空 → 组装条目（含 id/日期/时间）→ 读出 `diary.entries` 头部插入后写回 localStorage → 重新渲染列表。打开/刷新页面 = 从 localStorage 读出并渲染。**起点是你，终点是你这台设备的浏览器，全程不经过服务器。**

**路线 C（升级后）**：
React 页面加载 → `GET /api/diaries`（带登录态）→ 云函数校验身份 → 查询 PostgreSQL → 返回 JSON → 渲染列表。
写日记 → `POST /api/diaries` → 云函数校验（非空、长度、登录态）→ `INSERT` → 返回新条目 → 前端把它插到列表顶部（乐观更新，失败回滚并提示）。收藏 → `PATCH`；全程 HTTPS。

两条路线的**分界点只在「读写数据这一层」**（路线 C 里集中放在 `frontend/src/lib/api.js`）：UI 代码不感知数据到底来自 localStorage 还是 HTTP——这是切换成本低的关键。

## 7. 错误处理

| 场景 | 处理方式 | 用户可见反馈（对应 PRD §7） |
|---|---|---|
| 输入为空 / 纯空格 | A：保存按钮置灰；C：前端+云函数双重校验 | 「写点什么吧」，列表不变 |
| localStorage 不可用（隐私模式/被禁） | 启动时探测，失败则禁用写入口 | 「当前浏览器无法保存日记」，绝不伪装已保存 |
| localStorage 写入失败（约 5MB 满） | 捕获 `QuotaExceededError` | 明确提示保存失败，不静默丢内容 |
| 网络请求失败（仅 C） | 超时/失败 → 列表显示重试；写失败 → 内容保留在输入框 | 「网络不给力，重试一下」，内容不丢 |
| 401 / 404 / 429 / 500（仅 C） | api.js 统一转译为用户语言 | 「请先登录」/「这条日记不见了」/「操作太频繁」/「服务开小差了」 |
| 详情定位不到条目（A：id 失效） | 回退列表视图 | 空状态或列表，不白屏 |

原则：**任何失败都不伪装成成功**（PRD §7 硬条款）。

## 8. 环境变量

**路线 A：无任何环境变量**（这是选它的理由之一）。

**路线 C（`.env` 一律进 `.gitignore`，仓库只放 `.env.example`；30 天计划中 Day 23 才真正启用）**：

| 变量 | 所在位置 | 用途 | 示例（占位） |
|---|---|---|---|
| `VITE_API_BASE_URL` | frontend/.env | 云函数 HTTP 访问地址 | `https://<env-id>.service.tcloudbase.com/api` |
| `TCB_ENV` | 云函数侧环境变量 | CloudBase 环境 ID | `<your-env-id>` |
| `PG_HOST` / `PG_PORT` / `PG_DATABASE` / `PG_USER` / `PG_PASSWORD` | 云函数侧环境变量（**绝不进前端**——前端代码任何人都能看到） | PostgreSQL 连接信息 | `<your-db-…>` |

规则：前端 `.env` 只放「公开无所谓」的值；任何密钥只出现在云函数侧；`.gitignore` 从项目第一天就拦 `.env`。

## 9. 迁移注意事项（路线 A → 路线 C 切换清单）

1. **先做导出，再做迁移**：后续功能第一批 #1「导出备份」正好是迁移的数据来源（JSON 文件 → `migrate-from-local` 云函数批量 `INSERT`），顺序不能反。
2. **id 保留原值**：localStorage 的字符串 id 直接写入 PostgreSQL `id` 字段，收藏状态和旧链接不断链。
3. **时间字段**：本地 `createdAt` 是无时区本地时间；入库统一转 UTC（`TIMESTAMPTZ`），展示层再转浏览器本地——否则跨设备会出现「日期差一天」。
4. **日期归属**：`entry_date` 取「记录当时用户所在时区的日历日」，由客户端传给云函数，服务端不自行推断。
5. **行为对齐**：React 重写后逐条重跑 PRD §8 验收清单，特别是 375px 布局与空状态文案。
6. **文案与验收同步改**：上云后「日记只保存在此浏览器，不会上传」不再成立——PRD F5、§8、隐私说明需在切换提交中一并修订，避免文档与现实脱节。
7. **托管切换**：GitHub Pages → CloudBase 静态托管，注意旧域名重定向；本项目单页无路由，无 SPA fallback 风险。
8. **回退预案**：迁移后 localStorage 数据保留不清（只加 `migrated: true` 标记），出问题可回滚到路线 A。

## 附录 · 修订记录

| 日期 | 版本 | 修订 | 原因 |
|---|---|---|---|
| 2026-09-28 | v1 | 首版：纯前端 + localStorage 单路线 | Day 5 任务 |
| 2026-09-28 | v2 | 按新指令全量重写：三层选型比较、CloudBase 升级路线完整设计（结构/API/数据模型/错误处理/环境变量/迁移） | 用户新增后端与部署要求，待确认 Q1–Q4 |
