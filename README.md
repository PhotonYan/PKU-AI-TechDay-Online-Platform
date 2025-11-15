# 科技节在线平台

FastAPI + React 实现的“报销系统 / 成果展示 / 志愿者管理”一体化平台，集成角色权限、投票日志、CSV 导入导出、文件上传与 Docker 部署。

- 默认管理员：`admin@techday.local` / `AdminPass123`
- 关键路径：`backend/uploads/`（附件存储）、`sample-data/papers.csv`（论文导入示例）

## 1. 快速开始

### 后端
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload  # http://127.0.0.1:8000
```
> 默认使用 SQLite `backend/techday.db`。启动脚本会自动建表、补齐缺失列和管理员账号。  
> Swagger: `http://127.0.0.1:8000/docs`

### 前端
```bash
cd client
npm install
npm run dev  # http://127.0.0.1:5173
```
Vite dev server 代理 `/api` 与 `/uploads` 到后端，支持热更新；`npm run build` 产物位于 `client/dist/`。

### Docker
```bash
docker compose build
docker compose up -d
```
Compose 方案包含 `backend` + `frontend`(nginx) + `postgres`。访问 `http://localhost:8080`。

## 2. 功能概览

| 模块 | 亮点能力 |
| --- | --- |
| **志愿者系统** | 报名表收集学号/学院/志愿方向/服务时段/计票意愿；登录后查看多组织职责（管理员可分配多个工作组）。 |
| **报销系统** | 志愿者只能选择自身工作组、编辑自己的记录；管理员可审核、导出 CSV、删除任意申请。上传附件保存在 `/uploads/reimbursements/*`。 |
| **成果展示 Table** | 公开浏览；管理员/具模板权限者可在列表直接编辑“创/欢/不”三项投票，后端记录修改日志，详情页展示最近 50 条历史。 |
| **后台管理** | 管理组织、角色模板、投票展示开关、人员多组织分配、计票权限；一键导出当前人员配置 CSV。 |
| **奖项管理 / 审阅者** | 新增“审阅者”角色与邀请码注册机制，管理员维护邀请码及奖项列表；审阅者在“奖项管理”页仅能查看自身方向、为通过论文填写推荐/信心度；管理员可查看全部方向、基于推荐记录为作品配置多个奖项标签并筛选。 |
| **新闻公告系统** | `/news` 页加载 `client/src/assets/posts/*.md` 中的 Markdown，支持 YAML frontmatter（title/date/category/tags/summary/visibility/authors/published）、GFM、数学公式、角色可见范围；具发布权限的用户在 `/news/manage` / `/news/editor/:slug` 在线编辑/预览。 |
| **数据库管理** | `/admin/database` 受二次密码保护（默认 `admindatabase`），列出 SQLite 表、查看/编辑/删除/新增行，支持整表删除以及 CSV 覆盖/追加导入。 |

更多架构细节见 `docs/ARCHITECTURE.md`。

### 角色指南

- [docs/ROLE_ADMIN.md](docs/ROLE_ADMIN.md)：管理员后台、参展管理、数据库工具、奖项面板、常见审批流程。
- [docs/ROLE_VOLUNTEER.md](docs/ROLE_VOLUNTEER.md)：志愿者报名、个人信息、报销、修改密码。
- [docs/ROLE_AUTHOR.md](docs/ROLE_AUTHOR.md)：作者注册、投稿管理、附件上传与修改。
- [docs/ROLE_REVIEWER.md](docs/ROLE_REVIEWER.md)：审阅者邀请码流程、奖项推荐与筛选规则。

## 3. 主要 API

| 路径 | 说明 |
| --- | --- |
| `/api/auth/register|login|me` | JWT 注册/登录/自检 |
| `/api/volunteers/register|me` | 报名 + 个人资料（含多组织职责） |
| `/api/reimbursements` | GET/POST/PUT/DELETE（权限自动限制）；管理员用 `POST /{id}/review` 审核、`GET /export/csv` 导出 |
| `/api/papers` | GET 列表/详情、POST CSV 导入（首列 `序号`）、PATCH votes |
| `/api/admin/organizations|roles|users` | 管理组织/模板/人员，多组织分配、计票开关、CSV 导出 |
| `/api/admin/settings/votes` | 控制投票展示与排序、指定可编辑模板 |

## 4. CSV 与样例
- **论文导入**：使用 `sample-data/papers.csv`，第一列必须是 `序号`（从 1 递增），其余列为 Title/Author/Abstract/期刊/方向/作者联系方式。
- **报销导出**：管理员在报销列表右上角点击“导出报销”，得到包含“项目名称,组织,金额,发票抬头公司,报销内容,数量,状态”的 `reimbursements.csv`。
- **人员导出**：后台“用户角色与组织”页提供“导出当前人员”，CSV 包含学号、志愿方向、计票意愿、可服务时段等字段。

## 5. 目录结构
```
.
├── backend/
│   ├── app/                # FastAPI 业务代码（routers/models/schemas/utils）
│   └── requirements.txt
├── client/                 # Vite + React + TS 前端
│   ├── src/pages           # login/reimbursements/papers/admin/volunteer
│   └── vite.config.ts      # /api 与 /uploads 代理
├── deploy/                 # nginx 配置 & Dockerfile
├── docs/ARCHITECTURE.md    # 架构说明
├── sample-data/papers.csv  # CSV 样例（含“序号”列）
└── docker-compose.yml
```

## 6. 开发提示
- 后端热更新依赖 `uvicorn --reload`，首次启动会自动执行 `ALTER TABLE`（例如 `student_id`、`sequence_no`）。若切换到 PostgreSQL，只需设置 `DATABASE_URL`。
- 前端登录状态存于 `localStorage.token`，调试时可清空；登录后点击导航栏用户名即可进入“个人信息”。
- 上传文件由 FastAPI 静态路由 `/uploads/*` 提供；Vite dev server 也代理 `/uploads`，因此开发模式下访问链接不会 404。
- 若需要更多 CSV 字段或权限调整，可按 `backend/app/routers/*.py` 中现有模式扩展。

## 7. 新闻公告 / Markdown 说明

- Markdown 文件放在 `client/src/assets/posts/`，命名建议 `YYYY-MM-slug.md`，示例见 `2025-01-opening.md`。
- 文件顶部使用 frontmatter，支持字段：
  ```yaml
  ---
  title: "科技节启动公告"           # 必填
  date: "2025-01-10"              # YYYY-MM-DD
  category: "公告"
  tags: ["科技节", "启动"]
  summary: "如未填写将自动截取正文"
  visibility:
    - public                      # 可选：public / authenticated / volunteer / author / reviewer / admin
  author: "TechDay Editorial"
  author_id: 1
  published: true                 # 草稿可设为 false
  ---
  ```
- 渲染链路：`gray-matter` 解析 frontmatter，`react-markdown + remark-gfm + remark-math + rehype-katex` 负责 Markdown、数学公式与内嵌 HTML，Tailwind Typography 提供 prose 样式。
- 角色可见范围：
  - 缺省或包含 `public` → 所有人可见；
  - 仅写 `authenticated` → 所有登录用户可见；
  - 写具体角色数组 → 仅这些角色（含管理员）可查看；
  - `visibility` 字段可配合 `can_publish_news` 权限控制新闻管理后台访问。
- Poster PDF 预览在 `PaperDetailPage` 中通过 `<iframe src="...#toolbar=0&navpanes=0&scrollbar=0&view=FitH&zoom=page-fit">` 加载，无浏览器工具栏、自动适配宽度。

---
这就是最新的“科技节在线平台”说明。如需具体接口说明或部署脚本，请结合 `docs/ARCHITECTURE.md` 与源码查看。*** End Patch


  Frontmatter 写法

  visibility:
    - volunteer       # 限志愿者
    - admin           # 允许管理员
  # 其它可选值：public, authenticated, author, reviewer

  - 缺省或包含 public → 所有人可见
  - 仅写 authenticated → 任何登录用户可见
  - 写角色数组 → 只对列出的角色开放
