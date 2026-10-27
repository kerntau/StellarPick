# StellarPick

星澜优选：基于 OWASP Juice Shop 的本地仿真靶场，仅监听 `127.0.0.1:8081`，不使用 Docker。

## 功能要点

- 以 OWASP Juice Shop 20.4.0-SNAPSHOT（Angular 22）为基座，保留基座的漏洞机理。
- 提供星澜品牌的商城、会员、商家与平台后台页面。
- 提供 Windows 与 Linux 的依赖安装、构建、启动与重置脚本。
- 商品与登录账号保存在 SQLite，服务启动时按种子数据重建。
- 订单、购物车、工单与工单消息保存在 `lab-runtime.json`；收货地址、平台用户目录与商家入驻记录只保存在进程内存，评价保存在内存，重启后回到种子状态。
- 提供 Playwright 端到端校验、无障碍检查、性能检查与移动端检查脚本。

## 功能边界

以下能力目前只有界面与前端计算，没有服务端实现，演示时不应视为已实现：

- 优惠券：券面与抵扣金额由前端计算，提交订单时不参与结算。
- 积分、会员等级、会员日折扣：仅用于页面展示与估算，不写入数据库。
- 发票：只在订单上记录发票类型与抬头，不生成或下载发票文件。
- 售后、退换与退款：没有独立流程，只能通过客服工单沟通。
- 支付超时、库存释放、物流轨迹：没有后台任务或承运商对接，页面展示为静态演示数据。
- 平台后台的账号角色/状态修改、商家入驻审核：只修改进程内的演示目录，不改变 SQLite 登录账号，重启后恢复。

## 环境要求

- Node.js >= 22.22.3（见 `package.json` 的 `engines` 字段）；Juice Shop 基座支持 Node 22–26。
- npm（随 Node.js 安装）。
- Windows PowerShell 5.1+，或 Linux 上的 bash。
- 构建 `sqlite3` 原生模块需要本机 C/C++ 构建工具；Linux 部署脚本可安装构建期依赖。
- 运行 E2E 校验需要本机安装 Chrome 或 Chromium，也可以用 `CHROME_PATH` 指定可执行文件。
- 默认监听 `127.0.0.1:8081`，仅用于本机或受控内网。

## 安装

Windows：

```powershell
git clone https://github.com/kerntau/StellarPick.git
cd StellarPick
.\deploy.ps1
```

Linux：

```bash
git clone https://github.com/kerntau/StellarPick.git
cd StellarPick
sudo ./deploy.sh --install-node --service --nginx
```

`deploy.ps1` 安装前后端依赖、重建 SQLite 原生模块并构建前后端。`deploy.sh` 完成相同步骤，并额外补齐跨平台原生可选依赖；`--install-node` 在 apt 系统安装 Node.js 22，`--service` 与 `--nginx` 安装 systemd 服务和 nginx 反向代理。首次安装需要访问 npm 源（使用 `--install-node` 时还需要访问 NodeSource）。

仅构建、不安装系统服务：

```bash
./deploy.sh
```

安装 E2E 依赖（Windows 也可在部署时加 `-IncludeTests`）：

```bash
cd tools/e2e
npm ci
cd ../..
```

## 运行

Windows 的 `start.ps1` 默认先重新构建；Linux 的 `start.sh` 默认使用现有构建产物。

Windows：

```powershell
.\start.ps1
```

Linux：

```bash
./start.sh
```

默认地址：`http://127.0.0.1:8081`。启动前检查端口占用与构建产物。

已有构建产物时跳过重建：

```powershell
.\start.ps1 -SkipBuild
```

启动前重新构建：

```bash
./start.sh --build
```

更换端口：

```powershell
.\start.ps1 -Port 8082
```

```bash
./start.sh --port 8082
```

健康检查：

```bash
curl http://127.0.0.1:8081/healthz
```

校验（服务启动后执行）：

```bash
npm run verify
npm run audit
```

`npm run verify` 会修改运行状态（V08 修改邮箱后恢复、V09 创建测试订单、V10 写入测试上传文件）；执行后可用 `POST /lab/reset?confirm=1` 恢复实验室状态。`npm run audit:strict-a11y` 与 `npm run audit` 当前等价：无障碍脚本默认已阻断 serious 与 moderate 级问题。

重置：

```powershell
.\reset.ps1
```

```bash
./reset.sh
```

重置会删除 SQLite 数据库、运行状态与上传文件；执行前先停止服务。

## 配置

主配置文件为 `vendor/juice-shop/config/stellarpick.yml`，通过 `NODE_ENV=stellarpick` 加载。项目不使用 `.env` 文件；启动与部署脚本读取以下环境变量：

| 变量 | 用途 | 适用脚本 |
| --- | --- | --- |
| `STELLARPICK_PORT` | 监听端口，默认 8081 | `deploy.sh`、`start.sh`、`reset.sh` |
| `STELLARPICK_HOST` | 监听地址，默认 127.0.0.1 | `start.sh` |
| `STELLARPICK_BASE_URL` | 对外访问地址，写入 `server.baseUrl` | `deploy.sh --service`、`start.sh` |
| `STELLARPICK_NODE` | 指定 Node.js 可执行文件 | `start.sh` |
| `STELLARPICK_LOCK_FILE` | 单实例锁文件路径 | `start.sh`、`start.ps1`（脚本内部设置） |
| `STELLARPICK_USER` | systemd 运行用户，默认 stellarpick | `deploy.sh --service` |

Windows 脚本使用 `-Port` 参数；`STELLARPICK_HOST`、`STELLARPICK_NODE`、`STELLARPICK_USER` 仅由 Linux 脚本读取。

运行数据：

- 数据库：`vendor/juice-shop/data/juiceshop.sqlite`
- 运行状态：`vendor/juice-shop/data/lab-runtime.json`
- 上传目录：`vendor/juice-shop/uploads/`

同一时间只允许一个 Node.js 进程访问 SQLite。服务每次启动都会按种子数据重建 SQLite，注册账号、修改邮箱、增改商品等 SQLite 变更不会跨重启保留；订单、购物车与工单由 `lab-runtime.json` 持久化。

## 目录结构

```text
deploy/                          systemd 与 nginx 模板
docs/ground-truth.json           机器可读的靶场契约
tools/e2e/                       Playwright 校验脚本
tools/repair-native-bindings.mjs 补齐跨平台原生可选依赖
tools/node22/                    可选的 Windows 便携 Node 运行时（不随 Git 提交）
vendor/juice-shop/               Juice Shop 基座与星澜代码
  config/stellarpick.yml         主配置
  routes/stellarpick.ts          业务路由
  routes/lab.ts                  健康检查、重置与演示页
  data/labRuntime.ts             运行状态持久化
  frontend/src/app/stellarpick/  自建前端页面
deploy.ps1 / start.ps1 / reset.ps1   Windows 脚本
deploy.sh / start.sh / reset.sh      Linux 脚本
package.json                     npm 脚本与 Node.js 版本要求
```

## 许可证

基座 OWASP Juice Shop 使用 MIT 许可证，见 `vendor/juice-shop/LICENSE`。
