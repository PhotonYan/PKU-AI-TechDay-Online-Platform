# 科技节在线平台

完整实现“科技节在线平台”三大模块（报销系统 / 成果展示 Table / 志愿者系统），含角色权限、自定义角色模板、文件上传、CSV 导入、投票日志、Docker 部署。

> 默认管理员：`admin@techday.local` / `AdminPass123`

## 目录结构

```
.
├── backend/                # FastAPI 服务
│   ├── app/
│   │   ├── routers/        # auth / reimbursements / papers / volunteers / admin
│   │   ├── models.py       # SQLAlchemy schema（支持 PostgreSQL/SQLite）
│   │   ├── main.py         # FastAPI 入口 & 默认管理员种子
│   │   └── ...
│   └── requirements.txt
├── client/                 # Vite + React + TS 前端
│   ├── src/pages           # 三大模块及后台设置页面
│   └── ...
├── docs/ARCHITECTURE.md    # 架构 & 数据库设计
├── deploy/                 # nginx 配置 & Dockerfile
└── docker-compose.yml      # nginx + backend + postgres
```

## 数据库 Schema（摘要）

请查看 `docs/ARCHITECTURE.md` 获取表结构详情。主要表：

- `users`（含 role、role_template、志愿偏好/时段字段）
- `organizations`、`role_templates`
- `reimbursements`（含状态、上传票据路径）
- `papers` + `paper_vote_logs`
- `site_settings`（投票展示/排序控制）

## 后端运行

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

- 默认使用 SQLite `techday.db`，可通过 `DATABASE_URL` 指向 PostgreSQL。
- 上传文件保存到 `backend/uploads/`，由 FastAPI 静态路由 `/uploads/*` 暴露。
- API Swagger: `http://localhost:8000/docs`

## 前端运行

```bash
cd client
npm install
npm run dev          # http://localhost:5173
```

- Vite dev server 自动代理 `/api` 到 `http://localhost:8000`。
- 发布构建：`npm run build`（产物位于 `client/dist`，Docker 镜像会自动编译）。

## 主要接口（节选）

| 模块 | 方法 & 路径 | 说明 |
| --- | --- | --- |
| Auth | `POST /api/auth/login` | 表单登录，返回 JWT |
| Volunteers | `POST /api/volunteers/register` | 志愿者报名表（含志愿 I/II/III、时段） |
| Volunteers | `GET /api/volunteers/me` | 个人信息与组织职责（只读） |
| Reimbursements | `GET/POST /api/reimbursements` | 志愿者看自己的，管理员看全部；支持文件上传 |
| Reimbursements | `POST /api/reimbursements/{id}/review` | 管理员同意/拒绝/补资料 |
| Papers | `GET /api/papers` | 公开列表；若开启投票展示可按投票排序 |
| Papers | `POST /api/papers/import` | 管理员上传 CSV（Title, Author, Abstract, 期刊/会议, 方向, 作者联系方式） |
| Papers | `PATCH /api/papers/{id}/votes` | 管理员或拥有 `can_edit_vote_data` 模板的角色修改投票三项，并记录日志 |
| Admin | `GET/PUT /api/admin/settings/votes` | 控制是否展示投票 & 排序 & 哪个模板可编辑 |
| Admin | `GET/POST /api/admin/organizations` | 组织/职责字典 |
| Admin | `PUT /api/admin/users/{id}` | 修改任意用户组织 / 角色 / 角色模板 |

## Docker 部署

> 需要 Docker 及 Docker Compose

```bash
# 构建镜像
docker compose build

# 以后台模式运行
docker compose up -d

# 查看日志
docker compose logs -f
```

服务说明：

- `db`: PostgreSQL 15（数据卷 `db_data`）
- `backend`: FastAPI + Uvicorn（环境变量自动连接 db，卷 `uploads_data`）
- `nginx`: 构建并托管前端静态文件，同时反向代理 `/api` 到 backend，`/uploads` 直出票据文件
- 对外暴露 `http://localhost:8080`，其余内部网络互通

## 本地验证流程

1. 启动后端 (`uvicorn`) 与前端 (`npm run dev`) 或使用 Docker。
2. 使用管理员账户登录 `http://localhost:5173/login`。
3. 在“后台管理”导入论文 CSV、配置角色模板与组织。
4. 在“志愿者报名”页面提交表单，用新账号登录查看“个人信息”。
5. 在“报销管理”创建申请，上传发票文件；切换管理员审核后状态及备注。
6. 在“成果展示”验证投票展示/排序开关效果，并测试选定角色模板修改投票。

## 测试 / 质量

- FastAPI 自带 `/docs` 可调试所有接口。
- 关键模块（文件上传、CSV 导入、权限校验）已在代码中加入显式校验与错误信息。
- 可在本地用 SQLite 快速验证，再切换 `DATABASE_URL` 与 Docker Compose 连接 PostgreSQL。

更多架构细节、权限矩阵、字段解释请参阅 `docs/ARCHITECTURE.md`。
