# StellarPick 启动说明

> 仅监听 `127.0.0.1:8081`，无 Docker。Node.js 必须 ≥ 22.22.3。
> 同一时间只允许一个 Node 进程访问 SQLite。

## Windows

```powershell
# 首次部署并启动（安装依赖、重建 SQLite 原生模块、构建前后端）
.\deploy.ps1 -Start

# 日常启动（默认会先重新构建）
.\start.ps1

# 仅启动已有构建产物
.\start.ps1 -SkipBuild

# 硬重置（先停止服务；删除数据库、运行状态与上传）
.\reset.ps1
```

## Linux

```bash
# 从零部署（可选 systemd + nginx）
sudo ./deploy.sh --install-node --service --nginx

# 单实例启动
./start.sh

# 启动前重新构建
./start.sh --build

# 硬重置（先停止服务）
./reset.sh
```

## 检查

```bash
curl http://127.0.0.1:8081/healthz
```

- 数据库：`vendor/juice-shop/data/juiceshop.sqlite`
- 运行状态：`vendor/juice-shop/data/lab-runtime.json`
- 上传目录：`vendor/juice-shop/uploads/`
- 账号、端点与漏洞契约：`docs/ground-truth.json`
