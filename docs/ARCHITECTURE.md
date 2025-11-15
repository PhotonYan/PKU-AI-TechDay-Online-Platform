# 科技节在线平台架构设计

## 1. 技术栈概览
| 层次 | 技术 |
| --- | --- |
| 前端 | Vite + React + TypeScript + React Router + TailwindCSS |
| 后端 | FastAPI + SQLAlchemy + Pydantic + python-jose + Passlib |
| 数据库 | PostgreSQL（开发默认 SQLite，启动时自动建表与字段） |
| 对象存储 | 本地持久化卷 `data/uploads/`，通过受保护 API 提供 |
| 容器 | Docker Compose：`backend`(FastAPI) + `frontend`(Vite build) + `postgres` + `nginx` |

## 2. 模块划分
- **Auth & Volunteers**：JWT 登录、志愿者报名、个人信息展示。`users` 中记录志愿者偏好（多个工作组 `volunteer_tracks`、服务时段 `availability_slots`、计票意愿 `vote_counter_opt_in`、学号 `student_id`）。
- **Reimbursements**：志愿者仅能创建/编辑自己且组织从所属工作组下拉选择；管理员可审核、导出 CSV、强制删除任意记录。上传附件存磁盘。
- **Papers Table**：无需登录即可浏览。若管理员开启“展示投票”，则列表与详情显示三项投票数据；拥有投票权限者可在列表直接用 `创/欢/不` 输入，同时后端写 `paper_vote_logs`。
- **Admin Settings**：管理组织、角色模板、投票展示开关、用户多组织分配、导出人员 CSV。
- **News / Posts**：`client/src/assets/posts/*.md` 中的 Markdown 由 Vite 构建期读取，frontmatter 控制标题、摘要、可见范围；后端 `/api/posts` 系列接口负责 Markdown CRUD、权限、草稿发布，前端 `/news` 提供列表、详情、编辑与管理界面。

## 3. 数据库 Schema（关键字段）
```text
users (
  id, email, password_hash, name, college, grade, student_id,
  volunteer_tracks, availability_slots, role, organization_id,
  role_template_id, vote_counter_opt_in, created_at
)
organizations (id, name, responsibility)
role_templates (id, name, can_edit_vote_data)
reimbursements (
  id, project_name, organization, content, quantity, amount,
  invoice_company, file_path, status, admin_note,
  applicant_id, created_at, updated_at
)
papers (
  id, sequence_no, title, author, abstract, direction, contact,
  venue, vote_innovation, vote_impact, vote_feasibility, created_by
)
submissions (
  id, sequence_no, title, authors, contact, venue, track,
  direction_id, abstract, author_id, year,
  vote_innovation, vote_impact, vote_feasibility,
  archive_consent, publication_status, paper_url, poster_path,
  review_status, created_at, updated_at
)
paper_vote_logs (id, paper_id, user_id, field_name, old_value, new_value, created_at)
news posts (运行时存放于 `/data/posts`，frontmatter: title/date/category/tags/summary/visibility/author/published/content)
site_settings (id, show_vote_data, vote_sort_enabled, vote_edit_role_template_id)
```

> `volunteer_tracks` 以逗号分隔，一旦管理员在后台为某人勾选多个工作组，该人报销时即可下拉选择对应组织；无组织时自动回退为“未分配组织”。报销附件与 Poster 均写入 `/data/uploads`，通过授权 API 访问。

## 4. 权限矩阵
| 能力 | 志愿者 | 管理员 | 拥有 `can_edit_vote_data` 模板 |
| --- | --- | --- | --- |
| 报销 CRUD（本人） | ✅ | ✅（全部且可强制删除） | ✅ |
| 报销审核/导出 CSV | ❌ | ✅ | ❌ |
| 审核/导出人员 | ❌ | ✅ | ❌ |
| 论文投票编辑 | ❌ | ✅ | ✅ |
| 查看投票修改历史 | ❌ | ✅ | ✅ |

## 5. 主要接口
| 路径 | 说明 |
| --- | --- |
| `POST /api/auth/register` / `login` / `GET /me` | JWT 注册/登录/自检 |
| `POST /api/volunteers/register` | 志愿者报名（含学号、志愿方向、计票意愿） |
| `GET /api/volunteers/me` | 汇总个人信息 + 多组织职责 |
| `GET/POST/PUT/DELETE /api/reimbursements` | 报销列表、创建、编辑、删除（管理员可跨人删除） |
| `POST /api/reimbursements/{id}/review` | 管理员审核状态 |
| `GET /api/reimbursements/export/csv` | 管理员导出全部报销 |
| `GET/POST /api/papers` | 列表/导入 CSV（首列 `序号`） |
| `PATCH /api/papers/{id}/votes` | 更新投票并写入 `paper_vote_logs` |
| `GET /api/papers/{id}` | 详情 + 最近 50 条修改日志（权限可见） |
| `GET/POST/PUT /api/admin/organizations` | 定义工作组与职责 |
| `GET/POST /api/admin/roles` | 管理角色模板 |
| `GET/PUT /api/admin/settings/votes` | 投票展示开关与可编辑模板 |
| `GET/PUT/DELETE /api/admin/users/{id}` | 多组织分配、计票权限、删除用户 |
| `GET /api/admin/users/export` | 导出当前人员 CSV（含学号、志愿方向、时段、计票意愿） |

## 6. 前端路由
| Path | 描述 |
| --- | --- |
| `/` | 成果展示（公开，权限用户可就地改票） |
| `/papers/:id` | 论文详情 + 修改历史 |
| `/news` / `/news/:slug` | 新闻公告列表与 Markdown 详情（根据 frontmatter 权限过滤） |
| `/news/manage` | 管理员或具发布权限的用户可在此查看草稿、发布/删除 |
| `/news/editor/new` / `/news/editor/:slug` | 在线 Markdown 编辑（左编右看），填写 frontmatter 元数据 |
| `/login` | 登录入口，同时承载“注册为志愿者”按钮 |
| `/volunteer/register` | 志愿者报名表 |
| `/volunteer/profile` | 个人资料与组织职责 |
| `/reimbursements` | 报销列表 & 表单；管理员有审核/导出工具 |
| `/admin/settings` | 组织/模板/投票设置/人员管理/CSV 工具 |
| `/admin/exhibits` | 参展管理（按年份/Track 过滤、审核、重新编号） |
| `/awards` | 奖项管理（管理员和审阅者视图） |
| `/about` | 预留的 About 页面占位，可扩展菜单/说明 |

## 7. 日志与审计
- `paper_vote_logs`：记录字段名、旧值、新值、操作者、时间戳；详情页按倒序展示。
- 报销导出 CSV 包含中文状态，可用于线下留存；管理员审核写 `admin_note`。
- 启动脚本自动创建默认管理员及缺失列，避免多环境迁移遗漏。

## 8. 部署/运行
1. 本地开发：`uvicorn app.main:app --reload` + `npm run dev`。后端默认 SQLite，上传文件存 `data/uploads/`。
2. 生产：`docker compose build && docker compose up -d`，nginx 暴露 `http://localhost:8080`，由 `/api` 反代后端，前端通过 API 访问附件与 Markdown。
3. 默认账号：`admin@techday.local / AdminPass123`，首次启动自动写入。

更多运行细节与使用说明请参阅根目录 `README.md`。
