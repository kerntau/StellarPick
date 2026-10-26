#!/usr/bin/env bash
# StellarPick 本地/服务器启动脚本（Linux/macOS）
# 单实例保护：端口占用、lab.lock、构建产物三项检查通过后才启动。
set -Eeuo pipefail

APP_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$APP_ROOT/vendor/juice-shop"
MIN_NODE="22.22.3"
PORT="${STELLARPICK_PORT:-${PORT:-8081}}"
HOST="${STELLARPICK_HOST:-${HOST:-127.0.0.1}}"
LOCK_FILE="${STELLARPICK_LOCK_FILE:-$APP_DIR/data/lab.lock}"
DO_BUILD=0

usage() {
  cat <<'EOF'
用法: ./start.sh [选项]

  --port <端口>   监听端口（默认 8081，也可用 STELLARPICK_PORT）
  --host <地址>   监听地址（默认 127.0.0.1，也可用 STELLARPICK_HOST）
  --build         启动前重新构建前端与服务端
  -h, --help      显示帮助

环境变量:
  STELLARPICK_BASE_URL  对外访问地址（如 https://lab.example.com），
                        会通过 NODE_CONFIG 覆盖 server.baseUrl。
  STELLARPICK_NODE      指定 node 可执行文件路径。
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --port) PORT="${2:?--port 需要参数}"; shift 2 ;;
    --host) HOST="${2:?--host 需要参数}"; shift 2 ;;
    --build) DO_BUILD=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "未知选项: $1" >&2; usage >&2; exit 2 ;;
  esac
done

case "$PORT" in
  ''|*[!0-9]*) echo "端口必须是数字: $PORT" >&2; exit 2 ;;
esac
if [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then
  echo "端口超出范围: $PORT" >&2
  exit 2
fi

resolve_node() {
  if [ -n "${STELLARPICK_NODE:-}" ]; then
    printf '%s\n' "$STELLARPICK_NODE"
    return 0
  fi
  if [ -x "$APP_ROOT/tools/node22/bin/node" ]; then
    printf '%s\n' "$APP_ROOT/tools/node22/bin/node"
    return 0
  fi
  command -v node
}

NODE_BIN="$(resolve_node || true)"
if [ -z "$NODE_BIN" ] || [ ! -x "$NODE_BIN" ]; then
  echo "未找到 Node.js。请安装 Node.js >= $MIN_NODE，或设置 STELLARPICK_NODE。" >&2
  exit 1
fi
NODE_VERSION="$("$NODE_BIN" -v 2>/dev/null | sed 's/^v//')"
if [ -z "$NODE_VERSION" ] || ! printf '%s\n%s\n' "$NODE_VERSION" "$MIN_NODE" | sort -V -C; then
  echo "Node.js 版本过低: ${NODE_VERSION:-unknown}（需要 >= $MIN_NODE）" >&2
  exit 1
fi

port_in_use() {
  if command -v ss >/dev/null 2>&1; then
    ss -ltnH 2>/dev/null | awk '{print $4}' | grep -qE "[:.]${PORT}$"
  elif command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1
  elif command -v nc >/dev/null 2>&1; then
    nc -z 127.0.0.1 "$PORT" >/dev/null 2>&1
  else
    # Bash 内建回退，不依赖 ss/lsof/nc。
    (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null
  fi
}

lock_pid() {
  sed -n 's/.*"pid"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p' "$1" 2>/dev/null | head -n 1
}

if [ -e "$LOCK_FILE" ]; then
  LOCK_PID="$(lock_pid "$LOCK_FILE" || true)"
  if [ -n "$LOCK_PID" ] && kill -0 "$LOCK_PID" 2>/dev/null; then
    LOCK_CMD="$(tr '\0' ' ' < "/proc/$LOCK_PID/cmdline" 2>/dev/null || true)"
    if printf '%s' "$LOCK_CMD" | grep -q 'build/app.js'; then
      echo "StellarPick 已在运行（PID $LOCK_PID）。请先停止该进程。" >&2
      exit 1
    fi
  fi
  echo "清理陈旧锁文件: $LOCK_FILE"
  rm -f "$LOCK_FILE"
fi

if port_in_use; then
  echo "端口 $PORT 已被占用。请停止占用该端口的服务，或用 --port 指定其他端口。" >&2
  echo "注意：同一时间只允许一个 Node 进程访问 data/juiceshop.sqlite。" >&2
  exit 1
fi

if [ "$DO_BUILD" -eq 1 ]; then
  NPM_BIN="$(command -v npm || true)"
  if [ -z "$NPM_BIN" ]; then
    echo "未找到 npm，无法构建。" >&2
    exit 1
  fi
  echo "==> 构建前端"
  ( cd "$APP_DIR/frontend" && "$NPM_BIN" run build )
  echo "==> 构建服务端"
  ( cd "$APP_DIR" && "$NPM_BIN" run build:server )
fi

for artifact in "$APP_DIR/build/app.js" "$APP_DIR/frontend/dist/frontend/index.html"; do
  if [ ! -f "$artifact" ]; then
    echo "缺少构建产物: $artifact" >&2
    echo "请先执行 ./deploy.sh，或使用 ./start.sh --build。" >&2
    exit 1
  fi
done

mkdir -p "$(dirname -- "$LOCK_FILE")"
if ! ( set -o noclobber; printf '{"pid":%d,"port":%d,"startedAt":"%s"}\n' "$$" "$PORT" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$LOCK_FILE" ) 2>/dev/null; then
  echo "另一个 StellarPick 实例正在启动或运行（锁文件: $LOCK_FILE）。" >&2
  exit 1
fi

CHILD_PID=""
cleanup() {
  if [ -n "$CHILD_PID" ] && kill -0 "$CHILD_PID" 2>/dev/null; then
    kill -TERM "$CHILD_PID" 2>/dev/null || true
    wait "$CHILD_PID" 2>/dev/null || true
  fi
  rm -f "$LOCK_FILE"
}
trap cleanup EXIT
trap 'exit 143' INT TERM

cd "$APP_DIR"
export NODE_ENV=stellarpick
export HOST="$HOST"
export PORT="$PORT"
export STELLARPICK_LOCK_FILE="$LOCK_FILE"
if [ -n "${STELLARPICK_BASE_URL:-}" ]; then
  export NODE_CONFIG="{\"server\":{\"baseUrl\":\"${STELLARPICK_BASE_URL}\"}}"
fi

echo "StellarPick 启动中: http://$HOST:$PORT"
echo "Node: $NODE_BIN ($NODE_VERSION) | 数据库: $APP_DIR/data/juiceshop.sqlite"
echo "这是故意保留漏洞的演示靶场，请勿暴露到公网。"

set +e
"$NODE_BIN" build/app.js &
CHILD_PID=$!
wait "$CHILD_PID"
STATUS=$?
set -e
exit "$STATUS"
