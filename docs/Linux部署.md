# Linux 服务器部署指南

> 适用：Ubuntu 22.04/24.04、Debian 12、RHEL/Rocky 9 等带 systemd 的发行版。
> 本指南部署的是**故意保留漏洞**的星澜优选仿真靶场，只能用于授权教学与内部演练。

## 0. 安全边界

- 应用只监听 `127.0.0.1:8081`，由 nginx 反向代理对外提供访问。
- **不要直接暴露到公网**。建议使用 VPN、内网、IP 白名单或 nginx `auth_basic` 限制访问。
- V08 的 `sp_token` Cookie 带 `Secure` 属性，请通过 HTTPS 访问；纯 HTTP 下浏览器可能丢弃该 Cookie，CSRF 演示会不完整。
- V08 的 `/lab/csrf.html` 用 `localhost` 与 `127.0.0.1` 的差异构造跨站对照，设计用于**本机演示**。远程部署时页面里的 `127.0.0.1` 指向访问者自己的电脑；请在演示机上另开一个 origin（第二个域名/端口或本地静态页）向服务器地址提交，或按 [漏洞入口矩阵](漏洞入口矩阵.md) 用 curl/Burp 复现。
- 靶场包含 SQL 注入、XSS、IDOR、CSRF、价格篡改、任意文件上传等漏洞，这是设计目标，不要“修复”。

## 1. 环境要求

| 组件 | 要求 |
| --- | --- |
| Node.js | **>= 22.22.3**（Angular 22 与构建脚本要求） |
| npm | 随 Node 安装 |
| 构建工具 | `build-essential`、`python3`（sqlite3 无预编译包时需要） |
| 代码获取 | `git`（clone）或 `rsync`（从本机上传） |
| 服务管理 | systemd |
| 反向代理 | nginx（可选，但推荐） |
| 磁盘 | 约 2 GB（含依赖与构建产物；`--prune` 后可显著减小） |
| 内存 | 建议 >= 1 GB |

Ubuntu/Debian 安装基础依赖：

```bash
sudo apt-get update
sudo apt-get install -y git curl ca-certificates build-essential python3 nginx
```

Node.js 版本过低时，可让部署脚本安装（仅 apt 系统）：

```bash
sudo ./deploy.sh --install-node --service --nginx
```

也可以自行安装 NodeSource 22：

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt-get install -y nodejs
node -v   # 必须 >= 22.22.3
```

## 2. 获取代码

推荐放到 `/opt/stellarpick`。新服务器直接 clone：

```bash
sudo apt-get install -y git
sudo git clone https://github.com/kerntau/StellarPick.git /opt/stellarpick
cd /opt/stellarpick
```

私有仓库请先配置 GitHub PAT、SSH deploy key 或使用 `git clone git@github.com:kerntau/StellarPick.git`。
仓库不包含 `node_modules`、`build/`、`frontend/dist/`、SQLite、上传和运行状态；`deploy.sh` 会安装依赖并构建。

也可以从本机 rsync 上传：

```bash
sudo mkdir -p /opt/stellarpick
sudo rsync -a --delete \
  --exclude node_modules \
  --exclude tools/node22 \
  --exclude vendor/juice-shop/build \
  --exclude vendor/juice-shop/frontend/dist \
  --exclude vendor/juice-shop/data/juiceshop.sqlite \
  --exclude vendor/juice-shop/data/lab-runtime.json \
  ./ /opt/stellarpick/
cd /opt/stellarpick
```

`tools/node22` 是 Windows 便携 Node，Linux 不需要，上传时排除即可。

## 3. 一键部署

```bash
cd /opt/stellarpick
sudo ./deploy.sh --service --nginx
```

脚本会依次执行：

1. 检查 Node.js 版本；
2. 在 `vendor/juice-shop` 与 `vendor/juice-shop/frontend` 执行 `npm ci --ignore-scripts`；
3. 执行 `npm rebuild sqlite3`（必要时从源码构建）；
4. 构建前端（Angular production）与服务端（`tsc`）；
5. 创建系统用户 `stellarpick`，安装并启动 `stellarpick.service`；
6. 写入 nginx 配置并 reload；
7. 轮询 `/healthz` 做健康检查。

常用选项：

```bash
sudo ./deploy.sh --service --nginx --port 8081 --user stellarpick
sudo ./deploy.sh --skip-install --skip-build --service   # 仅重装服务
sudo ./deploy.sh --prune                                  # 构建后删除构建期依赖
sudo ./deploy.sh --base-url https://lab.example.com --service --nginx
```

只准备构建、不安装服务：

```bash
./deploy.sh
./start.sh
```

## 4. HTTPS 与对外地址

### 4.1 签发证书

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d lab.example.com
```

certbot 会改写 nginx 配置并配置自动续期。确认：

```bash
sudo systemctl status certbot.timer
```

### 4.2 设置对外地址

应用生成的邮件链接、订单 PDF 等使用 `server.baseUrl`。通过 nginx 对外提供服务时，把它设为公开地址：

```bash
sudo ./deploy.sh --base-url https://lab.example.com --service
```

该选项会写入 systemd drop-in：

```ini
[Service]
Environment='NODE_CONFIG={"server":{"baseUrl":"https://lab.example.com"}}'
```

修改后重启：

```bash
sudo systemctl restart stellarpick
```

### 4.3 防火墙

只开放 80/443，应用端口 8081 不要对外：

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

> `deploy.sh --nginx` 会把 Debian/Ubuntu 的默认站点 `/etc/nginx/sites-enabled/default`
> 重命名为 `default.disabled-by-stellarpick`，避免它抢占 80 端口；需要恢复时改回原名并 `nginx -t && systemctl reload nginx`。

## 5. 服务管理

```bash
sudo systemctl status stellarpick
sudo systemctl restart stellarpick
sudo systemctl stop stellarpick
sudo journalctl -u stellarpick -f
curl -fsS http://127.0.0.1:8081/healthz
```

nginx：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 6. 数据重置

软重置（保留 SQLite，只清订单/购物车/工单/上传）：

```bash
curl -X POST 'http://127.0.0.1:8081/lab/reset?confirm=1'
```

硬重置（删除数据库、运行状态与上传，重启后重建种子数据）：

```bash
sudo systemctl stop stellarpick
cd /opt/stellarpick
sudo ./reset.sh --force
sudo systemctl start stellarpick
```

`reset.sh` 会检查端口与锁文件；服务未停止时会拒绝执行。

## 7. 升级

```bash
cd /opt/stellarpick
sudo git pull
sudo ./deploy.sh --service --nginx
```

`deploy.sh` 默认重新执行 `npm ci` 与构建；数据库和 `lab-runtime.json` 不会被删除，但每次启动都会 `sequelize.sync({ force: true })` 重建 SQLite 用户/商品表，运行期订单/购物车/工单保存在 `data/lab-runtime.json` 中。

## 8. 备份

需要备份的运行期数据：

```bash
sudo systemctl stop stellarpick
sudo tar czf /var/backups/stellarpick-$(date +%F).tgz \
  -C /opt/stellarpick/vendor/juice-shop \
  data/juiceshop.sqlite data/lab-runtime.json uploads
sudo systemctl start stellarpick
```

## 9. 故障排查

| 现象 | 处理 |
| --- | --- |
| `Node.js >= 22.22.3 未安装` | 使用 `--install-node`，或手动安装 NodeSource 22 |
| `sqlite3 原生模块未生成` | 安装 `build-essential python3`，再执行 `npm rebuild sqlite3 --build-from-source` |
| `端口 8081 已被占用` | `ss -ltnp | grep 8081` 找到进程；不要同时启动两个实例 |
| `StellarPick 已在运行` | 锁文件 `data/lab.lock` 指向存活进程；先停止，或确认陈旧后删除 |
| 服务启动失败 | `journalctl -u stellarpick -n 80 --no-pager` |
| nginx 502 | 确认 `curl http://127.0.0.1:8081/healthz`；SELinux 下执行 `setsebool -P httpd_can_network_connect 1` |
| 页面空白 / 资源 404 | 确认 `frontend/dist/frontend/index.html` 存在，重新执行构建 |
| V08 Cookie 不生效 | 使用 HTTPS 访问；检查浏览器是否丢弃 `Secure` Cookie |
| 上传失败 | 检查 nginx `client_max_body_size` 与 `uploads/` 权限 |

## 10. 目录与端口

```text
/opt/stellarpick/
├── deploy.sh / start.sh / reset.sh       # Linux 脚本
├── deploy/                               # systemd 与 nginx 模板
├── docs/                                 # 部署、漏洞矩阵、演示脚本
├── tools/e2e/                            # Playwright 回归脚本
└── vendor/juice-shop/
    ├── build/app.js                      # 服务端构建产物
    ├── frontend/dist/frontend/           # 前端构建产物
    ├── config/stellarpick.yml            # NODE_ENV=stellarpick 配置
    ├── data/juiceshop.sqlite             # SQLite（运行期生成）
    ├── data/lab-runtime.json             # 订单/购物车/工单（运行期生成）
    ├── uploads/                          # 头像等上传文件
    ├── i18n/                             # 启动时由 data/static/i18n 复制
    └── logs/                             # 访问日志
```

- 应用监听：`127.0.0.1:8081`
- nginx 对外：`80/443`
- 健康检查：`GET /healthz`
- 单实例：同一时间只允许一个 Node 进程访问 SQLite

## 11. 测试账号

| 账号 | 密码 | 角色 |
| --- | --- | --- |
| admin@stellarpick.example | admin123 | 管理员 |
| alice@stellarpick.example | Alice@2026 | 会员 |
| bob@stellarpick.example | Bob@2026 | 会员 |
| merchant@stellarpick.example | Merchant@2026 | 商家 |
| support@stellarpick.example | Support@2026 | 客服 |
| jim@stellarpick.example | ncc-1701 | 会员（Juice Shop 原生） |

## 12. 部署后验证

```bash
curl -fsS http://127.0.0.1:8081/healthz
```

期望返回 `"ok":true`、`"visible":20`、`"orders":{"count":10}`。

在本机（或能访问站点的机器）运行 Playwright 回归：

```bash
cd /opt/stellarpick
cd tools/e2e && npm ci && cd ../..
node tools/e2e/audit.mjs
```

E2E 需要 Chrome/Chromium。脚本会按 `CHROME_PATH`、`/usr/bin/google-chrome`、`/usr/bin/chromium`、`/snap/bin/chromium` 的顺序查找；也可显式指定：

```bash
sudo apt-get install -y chromium
export CHROME_PATH=/usr/bin/chromium
node tools/e2e/audit.mjs
```

> `deploy.sh --service` 会把项目目录 chown 给 `stellarpick`。如果当前用户没有写权限，
> 请在 `tools/e2e` 目录使用 `sudo npm ci`，或先把该目录 chown 回当前用户。

`audit.mjs` 覆盖 V01–V10、负样本、冒烟、无障碍、性能与移动端检查。

## 13. Windows 本地

Windows 本地继续使用：

```powershell
.\deploy.ps1 -Start
.\start.ps1
.\reset.ps1
```

Linux 脚本与 Windows 脚本共用同一份 `vendor/juice-shop` 源码、配置与数据目录，但不要在同一份目录上同时运行两个实例。
