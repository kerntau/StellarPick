#!/usr/bin/env bash
# StellarPick Linux 部署脚本
# 安装依赖、重建 sqlite3、构建前后端，可选安装 systemd 服务与 nginx 反向代理。
set -Eeuo pipefail

APP_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$APP_ROOT/vendor/juice-shop"
FRONTEND_DIR="$APP_DIR/frontend"
MIN_NODE="22.22.3"
PORT="${STELLARPICK_PORT:-8081}"
APP_USER="${STELLARPICK_USER:-stellarpick}"
BASE_URL="${STELLARPICK_BASE_URL:-}"
DO_INSTALL_NODE=0
DO_SERVICE=0
DO_NGINX=0
SKIP_INSTALL=0
SKIP_BUILD=0
DO_PRUNE=0

usage() {
  cat <<'EOF'
用法: sudo ./deploy.sh [选项]

  --port <端口>       服务监听端口（默认 8081）
  --user <用户>       systemd 运行用户（默认 stellarpick）
  --base-url <URL>    对外访问地址，如 https://lab.example.com
  --install-node      缺少 Node.js 时通过 NodeSource 安装 Node 22（仅 apt 系统）
  --service           安装并启动 systemd 服务 stellarpick
  --nginx             安装 nginx 反向代理配置并 reload
  --skip-install      跳过 npm ci
  --skip-build        跳过构建
  --prune             构建后删除服务端 devDependencies 与前端 node_modules
  -h, --help          显示帮助

最小用法:
  sudo ./deploy.sh --service --nginx

仅准备构建（不安装服务）:
  ./deploy.sh
EOF
}

log() { printf '\n==> %s\n' "$*"; }
warn() { printf '警告: %s\n' "$*" >&2; }
die() { printf '错误: %s\n' "$*" >&2; exit 1; }

require_root() {
  [ "$(id -u)" -eq 0 ] || die "该操作需要 root 权限，请使用 sudo 运行。"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --port) PORT="${2:?--port 需要参数}"; shift 2 ;;
    --user) APP_USER="${2:?--user 需要参数}"; shift 2 ;;
    --base-url) BASE_URL="${2:?--base-url 需要参数}"; shift 2 ;;
    --install-node) DO_INSTALL_NODE=1; shift ;;
    --service) DO_SERVICE=1; shift ;;
    --nginx) DO_NGINX=1; shift ;;
    --skip-install) SKIP_INSTALL=1; shift ;;
    --skip-build) SKIP_BUILD=1; shift ;;
    --prune) DO_PRUNE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "未知选项: $1" ;;
  esac
done

case "$PORT" in
  ''|*[!0-9]*) die "端口必须是数字: $PORT" ;;
esac
if [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then
  die "端口超出范围: $PORT"
fi

if [ "$DO_SERVICE" -eq 1 ] || [ "$DO_NGINX" -eq 1 ] || [ "$DO_INSTALL_NODE" -eq 1 ]; then
  require_root
fi

log "检查系统"
if [ -r /etc/os-release ]; then
  # shellcheck disable=SC1091
  . /etc/os-release
  printf '系统: %s %s\n' "${NAME:-unknown}" "${VERSION_ID:-}"
else
  warn "无法读取 /etc/os-release，继续执行。"
fi
printf '项目目录: %s\n' "$APP_ROOT"

node_ok() {
  local bin version
  bin="$(command -v node || true)"
  [ -n "$bin" ] || return 1
  version="$("$bin" -v 2>/dev/null | sed 's/^v//')"
  [ -n "$version" ] || return 1
  printf '%s\n%s\n' "$version" "$MIN_NODE" | sort -V -C
}

install_node_apt() {
  require_root
  command -v apt-get >/dev/null 2>&1 || die "自动安装 Node 仅支持 apt 系统；请手动安装 Node.js >= $MIN_NODE。"
  if ! command -v curl >/dev/null 2>&1; then
    log "安装 curl"
    apt-get update -y
    apt-get install -y curl ca-certificates
  fi
  log "通过 NodeSource 安装 Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
}

if ! node_ok; then
  if [ "$DO_INSTALL_NODE" -eq 1 ]; then
    install_node_apt
    if ! node_ok; then
      die "Node.js 安装后仍低于 $MIN_NODE，请检查 NodeSource 源或手动安装。"
    fi
  else
    die "Node.js >= $MIN_NODE 未安装。可加 --install-node（仅 apt），或手动安装后重试。"
  fi
fi
NODE_BIN="$(command -v node)"
NODE_VERSION="$("$NODE_BIN" -v | sed 's/^v//')"
NPM_BIN="$(command -v npm || true)"
[ -n "$NPM_BIN" ] || die "未找到 npm，请检查 Node.js 安装。"
printf 'Node: %s (%s)\n' "$NODE_BIN" "$NODE_VERSION"
printf 'npm:  %s (%s)\n' "$NPM_BIN" "$("$NPM_BIN" -v)"

if [ ! -f "$APP_DIR/package.json" ]; then
  die "未找到 $APP_DIR/package.json，请在项目根目录运行本脚本。"
fi

if [ "$SKIP_INSTALL" -eq 0 ]; then
  log "安装服务端依赖（跳过依赖安装脚本）"
  ( cd "$APP_DIR" && "$NPM_BIN" ci --ignore-scripts )
  log "安装前端依赖（跳过依赖安装脚本）"
  ( cd "$FRONTEND_DIR" && "$NPM_BIN" ci --ignore-scripts )

  log "重建原生模块 sqlite3"
  if ! ( cd "$APP_DIR" && "$NPM_BIN" rebuild sqlite3 ); then
    warn "sqlite3 预编译包安装失败，尝试从源码构建。"
    if ! command -v cc >/dev/null 2>&1 || ! command -v make >/dev/null 2>&1 || ! command -v python3 >/dev/null 2>&1; then
      if command -v apt-get >/dev/null 2>&1 && [ "$(id -u)" -eq 0 ]; then
        log "安装构建工具 build-essential python3"
        apt-get update -y
        apt-get install -y build-essential python3
      else
        die "缺少 C/C++ 构建工具。请安装 build-essential 与 python3 后重试。"
      fi
    fi
    ( cd "$APP_DIR" && "$NPM_BIN" rebuild sqlite3 --build-from-source )
  fi
  if ! find "$APP_DIR/node_modules/sqlite3" -name 'node_sqlite3.node' -print -quit 2>/dev/null | grep -q .; then
    die "sqlite3 原生模块未生成，请检查构建工具与网络后重试。"
  fi

  # 部分发行版上 esbuild 的安装脚本被 --ignore-scripts 跳过，重建一次更稳妥。
  ( cd "$APP_DIR" && "$NPM_BIN" rebuild esbuild >/dev/null 2>&1 || true )
  ( cd "$FRONTEND_DIR" && "$NPM_BIN" rebuild esbuild >/dev/null 2>&1 || true )
else
  log "跳过依赖安装（--skip-install）"
fi

if [ "$SKIP_BUILD" -eq 0 ]; then
  log "构建前端"
  ( cd "$FRONTEND_DIR" && "$NPM_BIN" run build )
  log "构建服务端"
  ( cd "$APP_DIR" && "$NPM_BIN" run build:server )
else
  log "跳过构建（--skip-build）"
fi

for artifact in "$APP_DIR/build/app.js" "$APP_DIR/frontend/dist/frontend/index.html"; do
  [ -f "$artifact" ] || die "缺少构建产物: $artifact"
done
log "构建产物检查通过"

if [ "$DO_PRUNE" -eq 1 ]; then
  log "清理构建期依赖"
  ( cd "$APP_DIR" && "$NPM_BIN" prune --omit=dev )
  rm -rf "$FRONTEND_DIR/node_modules"
  log "已删除服务端 devDependencies 与前端 node_modules"
fi

mkdir -p "$APP_DIR/data" "$APP_DIR/uploads" "$APP_DIR/logs" "$APP_DIR/i18n" \
         "$APP_DIR/ftp" "$APP_DIR/frontend/dist/frontend/assets/public/images/uploads"

install_service() {
  require_root
  log "安装 systemd 服务"
  if ! id -u "$APP_USER" >/dev/null 2>&1; then
    useradd --system --home-dir "$APP_ROOT" --shell /usr/sbin/nologin "$APP_USER"
    log "已创建系统用户 $APP_USER"
  fi
  chown -R "$APP_USER:$APP_USER" "$APP_ROOT"

  local unit_src="$APP_ROOT/deploy/stellarpick.service"
  [ -f "$unit_src" ] || die "缺少 $unit_src"
  sed -e "s|@APP_DIR@|$APP_ROOT|g" \
      -e "s|@APP_USER@|$APP_USER|g" \
      -e "s|@PORT@|$PORT|g" \
      "$unit_src" > /etc/systemd/system/stellarpick.service

  if [ -n "$BASE_URL" ]; then
    install -d /etc/systemd/system/stellarpick.service.d
    cat > /etc/systemd/system/stellarpick.service.d/base-url.conf <<EOF
[Service]
Environment='NODE_CONFIG={"server":{"baseUrl":"$BASE_URL"}}'
EOF
    log "已写入对外地址: $BASE_URL"
  fi

  systemctl daemon-reload
  systemctl enable stellarpick >/dev/null
  systemctl restart stellarpick
  log "服务已启动，等待健康检查"
  if ! command -v curl >/dev/null 2>&1; then
    warn "未安装 curl，跳过健康检查。可手动访问 http://127.0.0.1:$PORT/healthz"
    return 0
  fi
  local i
  for i in $(seq 1 40); do
    if curl -fsS "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1; then
      log "健康检查通过: http://127.0.0.1:$PORT/healthz"
      return 0
    fi
    sleep 1
  done
  warn "健康检查超时。查看日志: journalctl -u stellarpick -n 80 --no-pager"
  return 0
}

install_nginx() {
  require_root
  log "安装 nginx 反向代理配置"
  command -v nginx >/dev/null 2>&1 || die "未安装 nginx。请先执行 apt-get install -y nginx（或 dnf install -y nginx）。"
  local conf_src="$APP_ROOT/deploy/nginx-stellarpick.conf"
  [ -f "$conf_src" ] || die "缺少 $conf_src"

  if [ -d /etc/nginx/sites-available ]; then
    if [ -e /etc/nginx/sites-enabled/default ]; then
      warn "检测到 nginx 默认站点，已重命名为 default.disabled-by-stellarpick，避免抢占 80 端口。"
      mv /etc/nginx/sites-enabled/default /etc/nginx/sites-enabled/default.disabled-by-stellarpick
    fi
    sed "s|@PORT@|$PORT|g" "$conf_src" > /etc/nginx/sites-available/stellarpick.conf
    ln -sfn /etc/nginx/sites-available/stellarpick.conf /etc/nginx/sites-enabled/stellarpick.conf
  else
    sed "s|@PORT@|$PORT|g" "$conf_src" > /etc/nginx/conf.d/stellarpick.conf
  fi

  nginx -t
  systemctl reload nginx 2>/dev/null || systemctl restart nginx
  if command -v getenforce >/dev/null 2>&1 && [ "$(getenforce)" = "Enforcing" ]; then
    warn "SELinux 处于 Enforcing，若 502 请执行: setsebool -P httpd_can_network_connect 1"
  fi
  log "nginx 配置已生效"
}

if [ "$DO_SERVICE" -eq 1 ]; then
  install_service
fi

if [ "$DO_NGINX" -eq 1 ]; then
  install_nginx
fi

if [ -n "$BASE_URL" ] && [ "$DO_SERVICE" -eq 0 ]; then
  warn "--base-url 只在使用 --service 时写入 systemd；手动启动请设置 STELLARPICK_BASE_URL=$BASE_URL ./start.sh"
fi

log "部署准备完成"
if [ "$DO_SERVICE" -eq 1 ]; then
  cat <<EOF
服务管理:
  systemctl status stellarpick
  systemctl restart stellarpick
  journalctl -u stellarpick -f
EOF
else
  cat <<EOF
手动启动:
  ./start.sh --port $PORT
EOF
fi
if [ "$DO_NGINX" -eq 1 ]; then
  printf '访问: http://<服务器地址>/  （生产环境请配置 HTTPS）\n'
fi
cat <<'EOF'

安全提示: 该靶场故意保留 SQL 注入、XSS、IDOR、CSRF 等漏洞。
不要直接暴露到公网；建议通过 VPN、IP 白名单或 nginx auth_basic 限制访问。
EOF
