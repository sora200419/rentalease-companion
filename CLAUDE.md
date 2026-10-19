# CLAUDE.md

## 项目概述

- 在 FYP 基线（RentalEase 租赁平台：Next.js 16 + React 19 + Prisma 5 + PostgreSQL）上为黑客松新增 Move-Out Companion（押金扣款证据助手）。继承功能与新增功能的边界见 `docs/BASELINE.md`；改文档或提交材料时不要把继承功能写成新增。
- 三种运行模式，**互不共享业务状态**，由启动脚本设置 `COMPANION_OFFLINE_DEMO` / `COMPANION_RECORDS_MODE` 切换（不要写进 env 文件）：
  - `npm run dev`：继承应用，`localhost:3000`，NextAuth + Upstash + `DATABASE_URL`。
  - `npm run dev:companion`：离线演示 `/demo`、`/companion`，`127.0.0.1:3030`，无需任何 env 或数据库，状态存 `.companion-data/`、`.local-runtime/judge-sessions/`。
  - `npm run dev:records`：`/records`，`127.0.0.1:3031`，连 Supabase 开发库，依赖 `.env.records.local`（只存在于 owner 的开发机），构建目录是 `.next-records`。
- 新代码主要在 `src/lib/companion/`、`src/app/{demo,companion,records,guide}`、`src/app/api/{judge,companion,records,mcp}`；其余基本是继承代码。
- 开发约束：零花费。未经 owner 批准，不创建付费资源、不调用付费模型（见 `docs/DEVELOPMENT-SERVICES.md`）。

## 常用命令

以下命令均于 2026-10-19 在 Linux、Node 22.22.0、npm 10.9.4 下实际跑过。

- 安装：`npm ci`（postinstall 会执行 `prisma generate`）。不要用 `npm install` 重写 lockfile 后提交，尤其不要在 Windows 上，否则会丢掉其他平台的原生可选依赖；`tests/lockfile-platforms.test.mjs` 会拦截这种情况。
- 启动：`npm run dev:companion` → http://127.0.0.1:3030/demo。写请求会校验 Host/Origin，必须用 `127.0.0.1:3030`，不能用 `localhost`。`npm run dev` 不带 env 也能启动（`/login` 返回 200），但真正的功能需要 `.env`。
- 测试（无需数据库和密钥）：`npm test`（246 项，`tsc` 编译到临时目录后用 `node --test` 运行）、`npm run test:mcp`、`npm run test:db-config`。
- HTTP 测试需先在另一个终端运行 `npm run dev:companion`：`npm run test:demo:http`、`npm run test:companion:http`。
- 检查/构建：`npm run typecheck`、`npm run lint`（目前 0 错误、24 个继承警告；不要新增警告）、`npm run build`（`prisma generate && next build`，**不会**跑迁移）。
- Prisma 只读检查：`npm run db:validate`。Prisma CLI 只读取 `.env` 或 shell 环境变量，**不读 `.env.local`**；缺少 `DATABASE_URL` 时 validate 会直接报错，可以传占位值：`DATABASE_URL=postgresql://u:p@127.0.0.1:5432/x npm run db:validate`。`npx prisma migrate status` 需要一个可达的真实数据库（本次没有数据库可连，只验证到连接这一步）。

## 编码规范

- 金额一律用整数 sen（`integer-sen`）计算和存储，只在展示时换算成 MYR，不要引入浮点金额。
- `npm test` 只编译 `scripts/test-workflows.mjs` 里显式列出的文件（CommonJS，不带 tsconfig 的 paths）。新的被测模块要加进这个列表，并且这些文件及其依赖只能用相对导入，不能用 `@/`；新测试文件也要加进同一脚本的文件数组。
- 身份只能来自服务端已验证的会话（records 用 NextAuth，demo 用服务端会话或 MCP bearer token）。不要接受客户端传来的 actor ID、金额、来源文本或任意状态字段。
- 涉及数据库或密钥的脚本、路由，错误信息里不要输出原始 DB 错误、连接串或 CLI 输出（现有脚本有意吞掉这些内容），新代码沿用这个做法。
- Next.js 16 的中间件文件是 `src/proxy.ts`，不是 `middleware.ts`。离线和 records 模式靠它屏蔽继承的 API 和仪表盘；新增路由时要确认它在每种模式下是否应该可访问。

## 架构与业务约束

- AI（规则路由、Ollama、Bedrock）只读取和起草，不判定责任、不确认写入、不转账。MCP 只有 6 个只读工具，**不要**添加 confirm、支付、SQL 或 URL 类工具。
- 写入流程固定为：prepare（HMAC 签名、绑定 actor/tenancy/revision、有过期时间的预览，不写库）→ 人工明确确认 → 数据库函数在事务内做 revision 校验和幂等。调整后的金额在租客接受前不生效。
- 租户隔离靠服务端的所有权查询实现，**不是**按租户的 RLS。每次读取都要重新校验会话和 tenancy。`rentalease_reader` 角色不能直接写表，只能 EXECUTE 受审查的函数，函数内有 fixture 白名单，不要扩大。
- 所有模式只绑定 loopback 并校验 Host/Origin，都不适合公开部署。不要放宽这些检查，也不要用隧道暴露端点（见 `docs/MCP.md`、`docs/MCP-REMOTE-PLAN.md`）。
- 只使用合成数据。不要重置 Supabase 的 fixture A/B 来重复演示，测试要读取当前持久化的状态。`demo-assets/evidence/` 下的照片必须保持“AI 生成”标注。
- 不要提交或读取：`.env*`（`.env.example` 除外）、`.companion-data/`、`.local-runtime/`、`private-data/`、`uploads/`。发布前跑 `node scripts/audit-release.mjs --ref HEAD --history` 做凭据审计。

## 部署流程

- 本仓库没有托管部署，也不创建任何云资源。交付方式是 GitHub 公开仓库加 tag（如 `hackathon-submission-2026-10-02`），评审在本地运行 `npm ci && npm run dev:companion`。
- 应用迁移（只针对开发库）：先 `npm run db:validate`，再 `npm run db:deploy`（即 `prisma migrate deploy`）。build 不会附带迁移，迁移永远是单独、显式的一步。
- 修改 schema：在一次性的本地 Postgres 上运行 `npx prisma migrate dev --name <描述>` 生成迁移。**禁止**对 Supabase 开发库运行 `migrate dev`、`migrate reset` 或 `db push`（会重置数据或绕过迁移历史）。注意 `20260923000100` 及之后的迁移会 GRANT 给 `rentalease_reader`、`anon`、`authenticated` 三个角色，裸 Postgres（包括 shadow DB）需要先创建这些角色。
- 已应用的迁移不能修改或重命名，包括名字为空的 `20260411061512_` 和 `20260412052917_`。records 相关迁移是手写 SQL（SECURITY DEFINER 函数加授权），需要人工审查。迁移失败时先查看 `_prisma_migrations` 表，不要盲目重试或 reset。
- Supabase 一次性脚本：`db:initialize:supabase` 只允许对空库运行；`scripts/provision-records-access.mjs` 不要再次运行；`scripts/deploy-records-writes.mjs` 写死了唯一允许的待应用迁移名，新迁移不能直接复用它。种子数据用 `npm run db:seed:supabase`（upsert 的 update 分支为空，重复运行不会覆盖已有数据）；项目没有配置 `prisma db seed`。以上操作都需要 owner 明确批准。
- 环境变量（只列名称和用途，模板是 `.env.example`；Next 会读 `.env.local`，Prisma CLI 只读 `.env`）：
  - `DATABASE_URL`：Prisma 连接的开发库。`NEXTAUTH_URL` / `NEXTAUTH_SECRET`：继承应用的登录。
  - `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`：继承应用的登录和昂贵接口限流。
  - `GEMINI_API_KEY`：继承的合同 AI 功能。`CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET`：继承的图片上传（`CLOUD_NAME` 同时影响 build 时 `next/image` 的路径范围）。
  - `RESEND_API_KEY` / `EMAIL_FROM`：可选，邮件。`SEPOLIA_RPC_URL` / `BLOCKCHAIN_PRIVATE_KEY`：可选，测试网哈希锚定。
  - `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME`：可选，设置后会创建或提升管理员账号。`CRON_SECRET`：保护租约过期定时接口。
  - `COMPANION_OLLAMA_MODEL`：本地 Ollama 模型名，留空即规则模式。`COMPANION_BEDROCK_MODEL` / `COMPANION_BEDROCK_REGION`：可选，`/demo` 的 Bedrock 助手，AWS 凭据走标准凭据链或 `AWS_BEARER_TOKEN_BEDROCK`。
