#!/usr/bin/env bash
# StellarPick 硬重置：删除 SQLite、运行状态与上传文件，重启后重建演示数据。
set -Eeuo pipefail

APP_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$APP_ROOT/vendor/juice-shop"
PORT="${STELLARPICK_PORT:-8081}"
FORCE=0

usage() {
  cat <<'EOF'
用法: ./reset.sh [选项]

  --port <端口>   服务端口（默认 8081）
  --force         跳过确认
  -h, --help      显示帮助

重置前必须先停止服务。软重置（保留数据库）:
  curl -X POST 'http://127.0.0.1:8081/lab/reset?confirm=1'
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --port) PORT="${2:?--port 需要参数}"; shift 2 ;;
    --force) FORCE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "未知选项: $1" >&2; usage >&2; exit 2 ;;
  esac
done

case "$PORT" in
  ''|*[!0-9]*) echo "端口必须是数字: $PORT" >&2; exit 2 ;;
esac

port_in_use() {
  if command -v ss >/dev/null 2>&1; then
    ss -ltnH 2>/dev/null | awk '{print $4}' | grep -qE "[:.]${PORT}$"
  elif command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1
  elif command -v nc >/dev/null 2>&1; then
    nc -z 127.0.0.1 "$PORT" >/dev/null 2>&1
  else
    (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null
  fi
}

lock_pid() {
  sed -n 's/.*"pid"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p' "$1" 2>/dev/null | head -n 1
}

if port_in_use; then
  echo "服务仍在端口 $PORT 监听。请先停止服务（Ctrl+C 或 systemctl stop stellarpick）。" >&2
  exit 1
fi

LOCK_FILE="$APP_DIR/data/lab.lock"
if [ -e "$LOCK_FILE" ]; then
  PID="$(lock_pid "$LOCK_FILE" || true)"
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    echo "服务仍在运行（PID $PID）。请先停止后再重置。" >&2
    exit 1
  fi
  rm -f "$LOCK_FILE"
fi

if [ "$FORCE" -eq 0 ]; then
  printf '将删除以下内容:\n  %s\n  %s\n  %s/*\n继续? [y/N] ' \
    "$APP_DIR/data/juiceshop.sqlite*" \
    "$APP_DIR/data/lab-runtime.json*" \
    "$APP_DIR/uploads"
  read -r ANSWER
  case "$ANSWER" in
    y|Y|yes|YES) ;;
    *) echo "已取消。"; exit 0 ;;
  esac
fi

rm -f "$APP_DIR"/data/juiceshop.sqlite* "$APP_DIR"/data/lab-runtime.json* "$APP_DIR/data/lab.lock"
if [ -d "$APP_DIR/uploads" ]; then
  find "$APP_DIR/uploads" -mindepth 1 -delete
fi

echo "重置完成。启动服务后将重建数据库与演示种子数据。"
