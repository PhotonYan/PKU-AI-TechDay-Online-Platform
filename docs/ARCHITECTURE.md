# 科技节在线平台架构设计

## 1. 技术栈概览
- **前端**：Vite + React + TypeScript + React Router + TailwindCSS（纯前端静态资源，可由 nginx 托管）
- **后端**：FastAPI + SQLAlchemy + Pydantic + JWT（python-jose）+ Passlib
- **数据库**：PostgreSQL（开发阶段默认连接 SQLite，可通过环境变量切换）
- **对象存储**：本地 `uploads/` 目录（可通过 NFS/OSS 替换）
- **容器化**：Docker Compose（`nginx` + `backend` + `frontend` + `postgres`）

## 2. 模块与服务
| 层级 | 说明 |
| --- | --- |
| `frontend` | 负责路由、鉴权状态管理、三大模块 UI。与后端通过 REST API 交互 |
| `backend`  | FastAPI 提供鉴权、权限校验、CRUD、文件上传、CSV 导入、操作日志 |
| `postgres` | 持久化数据；可在开发态用 SQLite 免安装 |
| `nginx`    | 反向代理 `/api` 到后端，提供前端静态资源，托管上传文件 |

## 3. 数据库 Schema
```text
users                (id, email, password_hash, name, college, grade, volunteer_tracks, availability_slots,
                      role, organization_id, role_template_id, created_at)
organizations        (id, name, responsibility)
role_templates       (id, name, can_edit_vote_data)
reimbursements       (id, project_name, organization, content, quantity, amount, invoice_company,
                      file_path, status, applicant_id, created_at, updated_at, admin_note)
papers               (id, title, author, abstract, direction, contact, venue,
                      vote_innovation, vote_impact, vote_feasibility, created_by)
paper_vote_logs      (id, paper_id, user_id, field_name, old_value, new_value, created_at)
site_settings        (id, show_vote_data, vote_sort_enabled, vote_edit_role_template_id)
```
> `volunteer_tracks` 使用 `,` 分隔（志愿 I/II/III），`availability_slots` 存储 JSON 字符串（如 `["13:00","14:00"]`）。

## 4. 权限矩阵
| 能力 | 志愿者 | 管理员 | 角色模板（可配置） |
| --- | --- | --- | --- |
| 报销 CRUD 自身 | ✅ | 查看全部、审核 | ✅（若赋予） |
| CSV 上传/论文 CRUD | ❌ | ✅ | ❌ |
| 修改投票三项数据 | ❌ | ✅ | ✅（模板 `can_edit_vote_data=true`） |
| 志愿者组织分配 | 只读 | ✅ | ❌ |

## 5. API 总览
`/api/auth/register`、`/api/auth/login`、`/api/auth/me`
`/api/reimbursements`：GET/POST（志愿者=自己的，管理员=全部）、PATCH/DELETE（受状态限制）、`/{id}/review`
`/api/papers`：公共 GET 列表/详情（支持 `sort=innovation|impact|feasibility` 与展示开关）；POST CSV 导入；PATCH vote
`/api/volunteers/me`：查看个人信息；`/api/admin/users`：列表/更新志愿者组织
`/api/settings/votes`：管理员配置投票展示与可编辑模板

## 6. 前端路由
| Path | 说明 |
| --- | --- |
| `/` | Table 列表（公开）
| `/papers/:id` | 论文详情页
| `/login` | 登录页
| `/reimbursements` | 报销列表 + 表单
| `/admin/reimbursements/:id` | 审核页
| `/volunteer/register` | 志愿者报名表
| `/volunteer/profile` | 个人信息页
| `/admin/settings` | CSV 上传、投票设置、组织管理

## 7. 日志与审计
- Reimbursement 更新写入 `updated_at`，管理员操作可写 `admin_note`
- 投票修改写入 `paper_vote_logs`（字段、旧值、新值、操作者）

## 8. 部署流程（概要）
1. `docker compose build`
2. `docker compose up -d`
3. nginx 暴露 80 端口：`/` 前端静态资源，`/api` -> backend，`/uploads` 静态文件
4. 默认管理员：`admin@techday.local` / `AdminPass123`（启动时若不存在自动创建）

详见根目录 `README.md` 获取运行/测试/镜像打包说明。
