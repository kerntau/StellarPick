# 星澜优选 · 仿真靶场（真实 Juice Shop 二开）

> 基座：**OWASP Juice Shop v20.4.0-SNAPSHOT（Angular 22）**。只做品牌皮肤、IA/P0 页面与 V01–V10 入口编排；漏洞机理保持原样。
> 仅监听 **127.0.0.1:8081**，无 Docker。品牌、备案、客服、地址、账号全部虚构。

## 交付说明

- Windows：`deploy.ps1`（依赖安装与构建）、`start.ps1`（本机启动）、`reset.ps1`（完整重置）。
- Linux：`deploy.sh`（依赖安装、构建、systemd/nginx）、`start.sh`（单实例启动）、`reset.sh`（硬重置）；详见 [Linux 部署指南](docs/Linux部署.md)。
- 优先使用可选的 `tools/node22/node.exe`，否则使用系统 Node；**Node 必须 ≥22.22.3**。
- 依赖、构建产物、数据库、上传和运行状态均不提交到 Git；首次克隆后需联网安装依赖。
- 服务通过 `vendor/juice-shop/config/stellarpick.yml` 绑定 **127.0.0.1**，默认端口 8081。
- 直接 `npm start`/`node build/app.js`（未设置 `NODE_ENV=stellarpick`）在检测到 SQLite 数据库或 lab-runtime 数据时会拒绝启动，避免误清库；请统一使用 `start.ps1`。

## 快速开始

```powershell
# Windows PowerShell 5.1+；在项目根目录执行
.\deploy.ps1 -Start
# 打开 http://127.0.0.1:8081
```

`deploy.ps1` 安装前后端依赖、重建 SQLite 原生模块并构建前后端；`-Start` 在准备完成后启动服务。也可以分步执行 `.\deploy.ps1` 与 `.\start.ps1`。启动脚本会重建应用，确保源码修改生效。

常用选项与检查：

```powershell
.\deploy.ps1 -IncludeTests       # 同时安装 E2E 依赖
.\start.ps1 -Port 8082          # 更换端口；测试脚本默认仍使用 8081
.\start.ps1 -SkipBuild         # 仅当已有构建产物时跳过构建
.\deploy.ps1 -SkipInstall      # 跳过依赖安装，仅构建
npm run deploy                   # deploy.ps1 -Start 的 npm 入口
Invoke-RestMethod http://127.0.0.1:8081/healthz
```

首次安装需要访问 npm registry；若未提供预编译 SQLite 模块，还需要本机 C/C++ 构建工具。不要随意终止依赖安装或构建过程。

### Linux 服务器

```bash
# Ubuntu/Debian；新服务器直接 clone
sudo apt-get update
sudo apt-get install -y git curl ca-certificates build-essential python3 nginx
sudo git clone https://github.com/kerntau/StellarPick.git /opt/stellarpick
cd /opt/stellarpick
sudo ./deploy.sh --service --nginx        # 安装依赖、构建、systemd 服务与 nginx
sudo ./deploy.sh --install-node --service --nginx   # 系统 Node 版本不足时
```

应用只监听 `127.0.0.1:8081`，由 nginx 反向代理；完整步骤、HTTPS、白名单、备份与排障见 [docs/Linux部署.md](docs/Linux部署.md)。

- 配置：`vendor/juice-shop/config/stellarpick.yml`（`NODE_ENV=stellarpick`）。
- 数据库：`vendor/juice-shop/data/juiceshop.sqlite`；运行时状态：`vendor/juice-shop/data/lab-runtime.json`；上传：`vendor/juice-shop/uploads/`。
- **同一时间只允许一个 Node 进程访问 SQLite**；`start.ps1` 检测端口占用并写入 `data/lab.lock`，换端口启动也会被拒绝；异常退出后下一次启动会自动清理陈旧锁。如确认锁已陈旧（例如强制结束进程后），用 `.\start.ps1 -Force` 清理。停止服务请在该终端按 Ctrl+C，不要结束其他 Node 进程。

### 重置

```powershell
# 软重置：清空 lab 订单/购物车/工单/上传，不动 SQLite
Invoke-RestMethod -Method Post 'http://127.0.0.1:8081/lab/reset?confirm=1'

# 硬重置：先在本服务终端按 Ctrl+C，再执行；会删除数据库与上传文件
.\reset.ps1                    # 显示确认提示
.\reset.ps1 -Force            # 已确认备份与影响时使用
.\reset.ps1 -Port 8082        # 服务不是用 8081 启动时指定端口
.\start.ps1
```

`reset.ps1` 删除 `data/juiceshop.sqlite*`、`data/lab-runtime.json*` 与 `uploads/` 内容。重启后 datacreator 重建 20 个可见商品 + 1 个隐藏商品。每次正常启动都会执行 `sequelize.sync({force:true})` 重建 SQLite 用户/商品/邮箱/注册数据；`lab-runtime.json` 中的订单/购物车/工单会保留。需要彻底恢复基线请先停止服务再执行 `reset.ps1`。

## 测试账号

| 账号 | 密码 | 角色 | 说明 |
| --- | --- | --- | --- |
| admin@stellarpick.example | admin123 | 管理员 | DB id 1；弱口令，V02 返回该账号 |
| alice@stellarpick.example | Alice@2026 | 会员 | DB id 26；lab 订单 ownerId 仍为历史种子 id 2 |
| bob@stellarpick.example | Bob@2026 | 会员 | DB id 27；订单 1002 属于 bob（V05 目标） |
| merchant@stellarpick.example | Merchant@2026 | 商家 | DB id 28 |
| support@stellarpick.example | Support@2026 | 客服 | DB id 6 |
| jim@stellarpick.example | ncc-1701 | 会员 | Juice Shop 原生账号；商品 1003 种子评价作者 |

账号来自 `data/static/users.yml`，reset 后仍存在。`/api/admin/users` 的 **8 行是 lab 演示目录**，不是 SQLite 用户表；`/api/Users`（需登录）返回 SQLite 用户表；seed 约 **27**，测试注册会增长（本轮观测 **35**）。carol/dave/erin 只存在于 lab 目录，不能登录。

## 页面

星澜自建前端（Angular，`vendor/juice-shop/frontend/src/app/stellarpick/`）已覆盖任务书 P0/P1：

- 商城：`/#/`、`/#/category/:slug`、`/#/search?q=`、`/#/product/:id`、`/#/product/:id/reviews`（历史别名，落到商品页）、`/#/cart`、`/#/checkout`
- 会员：`/#/login`、`/#/register`、`/#/account`（资料/地址/订单/订单详情/评价）
- 服务：`/#/support/tickets`、`/#/support/tickets/:id`
- 商家：`/#/merchant`、`/#/merchant/products`、`/#/merchant/orders`
- 平台：`/#/admin`、`/#/admin/users`、`/#/admin/merchants`
- 公共：`/#/about`、`/#/help`、`/#/privacy`、`/#/terms`、`/#/404`

交付文档只保留使用说明：
- [Linux部署.md](docs/Linux部署.md)：Linux 服务器部署、systemd/nginx、HTTPS、备份与排障。
- [漏洞入口矩阵.md](docs/漏洞入口矩阵.md)：V01–V10 的 UI 入口、请求、payload、负样本与复现命令。
- [演示脚本.md](docs/演示脚本.md)：15 分钟演示流程与话术。
- [ground-truth.json](docs/ground-truth.json)：机器可读的漏洞/负样本/账号/端点契约。

## V01–V10（当前实际入口）

| 编号 | 入口 | 实际请求 / 证据 |
| --- | --- | --- |
| V01 | `/#/search?q=` | `GET /rest/products/search?q=')) UNION SELECT * FROM Products WHERE deletedAt IS NOT NULL--` → 200，21 行，含隐藏商品 1021 |
| V02 | `/#/login` | `POST /rest/user/login`，email=`' OR 1=1--` → 200 + admin JWT（id 1） |
| V03 | `/#/search?q=` | q=`<img src=x onerror="window.__v03=1">` → 结果头 innerHTML 原样渲染 |
| V04 | `/#/product/1003` → 评价 tab | `PUT /rest/products/1003/reviews` → 201；评价正文 `bypassSecurityTrustHtml` 渲染 |
| V05 | `/#/account/orders/1002` | alice 的 `GET /api/orders/1002` → 200，ownerId 3 / bob / total 556 |
| V06 | `/#/admin/users` | alice 的 `GET /api/admin/users` → 200，8 行 |
| V07 | `localStorage['token']` | alg=none 伪造 token → `/api/admin/settings`、`/api/admin/users` 均 200；原生 `/api/Users` 也接受 |
| V08 | `/#/account/profile` 或 `/lab/csrf.html` | login 下发 `sp_token`（HttpOnly; Secure; SameSite=None）；第三方页面 POST `/api/account/email` → 204，无 CSRF/Origin 校验 |
| V09 | `/#/cart` → `/#/checkout` | `POST /api/checkout`，unitPrice=0.01 → total 0.01 |
| V10 | `/#/account/profile` 上传 | `POST /api/account/avatar` 上传含 `<script>` 的 avatar.svg → `/uploads/xxx.svg`，Content-Type image/svg+xml |

完整矩阵、payload、负样本与复现命令见 [docs/漏洞入口矩阵.md](docs/漏洞入口矩阵.md) 与 [docs/ground-truth.json](docs/ground-truth.json)。

## 数据基线

- 商品：**20 个可见（1001–1020）+ 1 个隐藏（1021）**；Products 表 21 行。隐藏商品只可通过 V01 注入看到。
- 订单：10 个种子订单（1001–1010）；seed 状态下 alice 4 单、bob 4 单、carol 1 单、admin 1 单。V09 每跑一次会新增一单，alice 列表随之增长；`POST /lab/reset?confirm=1` 恢复。
- 工单：3 条；商家申请：4 条；lab 目录：8 个；DB 用户：seed 约 27 个（测试注册会增长，本轮观测 35）。
- 评价：1003 有 2 条种子评价（jim 良性 + alice 含 `<img onerror="window.__v04_seed=1">` 的 V04 演示载荷）；1007 有 bender 1 条。打开 1003 的“评价”tab 即触发 `window.__v04_seed=1`，手动提交的 XSS 评价重启后消失。

## 自检

```powershell
.\deploy.ps1 -SkipBuild -IncludeTests
npm run verify   # 10/10 + 7/7 + 18/18
npm run audit    # verify + a11y + perf + mobile，失败即非 0
```

Linux：

```bash
cd tools/e2e && npm ci && cd ../..
node tools/e2e/audit.mjs
```

2026-10-26 复核：`npm run audit` **6/6 通过**——verify 10/10 + 7/7 + 18/18，a11y 54 次扫描 0 failures，perf max LCP 624ms / 初始 JS transfer 201KB（300KB 预算 PASS），mobile 36 检查 0 overflow；`node tools/e2e/flow.mjs` **58/58**（29 流程 × 1440/390，0 console error / 0 横溢）。

- `tools/e2e/verify-v.mjs`：V01–V10 十条正向（10/10），退出码非 0 表示失败。
- `tools/e2e/verify-negative.mjs`：N01–N06 + N06-admin 七条负样本（7/7），退出码非 0 表示失败。
- `tools/e2e/smoke.mjs`：18 条路由 200 + 控制台零错误 + 商品页不是 404。
- `tools/e2e/audit.mjs`：依次跑 verify、a11y、perf、mobile；解析各脚本输出，失败即非 0。`npm run audit:strict-a11y` 会把任何 serious axe 违规也判失败。
- `tools/e2e/flow.mjs`：58 项端到端流程（游客/会员/管理员/商家/注册 × 1440/390），失败非 0，报告写入 `tools/e2e/flow-report.json`。
- 其他脚本：`a11y.mjs`（axe，27 路由 × 390/1440）、`perf.mjs`（LCP/初始 JS 预算）、`mobile-qa.mjs`（360/768 横溢）。
- 手动专项：`a11y-responsive.mjs`（响应式/键盘焦点/模态焦点陷阱）、`a11y-modal-check.mjs`（筛选抽屉/商家弹窗）。

## 目录

```text
vendor/juice-shop/                 # 真实基座
  config/stellarpick.yml           # 品牌、商品种子、隐藏商品
  routes/stellarpick.ts            # V05–V10 薄路由层
  routes/lab.ts                    # /healthz、/lab/reset、/lab/csrf.html
  data/labRuntime.ts               # lab 订单/购物车/工单持久化
  frontend/src/app/stellarpick/    # 星澜自建页面
deploy.ps1                         # Windows：依赖安装、原生模块与前后端构建
start.ps1 / reset.ps1              # Windows：本机启动 / 完整数据重置
deploy.sh / start.sh / reset.sh    # Linux：构建/启动/重置
deploy/                            # systemd 与 nginx 模板
docs/                              # 漏洞入口矩阵、演示脚本、Linux 部署、ground truth
tools/NodeEnv.ps1                  # Windows Node 环境预检
tools/e2e/                         # Playwright 校验与 audit
tools/node22/                      # 可选 Windows 便携 Node（Git 忽略）
```

## 安全声明与已知边界

- 仅本机或受控内网演示，不部署公网；全部数据虚构。
- 10 条缺陷为设计保留，不是 bug；不要“修复”。
- V08 是**真正的 Cookie CSRF**：登录同时下发 `sp_token` Cookie，`/api/account/email` 接受该 Cookie 且不校验 CSRF token/Origin；前端 API 仍主要用 `localStorage['token']` 的 Bearer。
- V07 不只影响 lab 路由：基座的 `express-jwt 0.1.3 + jsonwebtoken 0.4.0` 对 `alg=none` 也放行，原生 `/api/Users` 同样返回 200。
- `/#/product/:id/reviews` 是历史别名，会加载商品页但不会自动切到评价 tab；演示时进入 `/#/product/1003` 后点“评价”。
