#!/usr/bin/env bash
# Hook Events Log Viewer - launcher script
# Usage: ./log-viewer.sh [--port NNNN] [--open] [--stop] [--status] [--fg]

set -euo pipefail

PORT=7777
OPEN=false
COMMAND="start"
PIDFILE="$HOME/.claude/hooks/log-viewer.pid"

# --- Process management ---

is_running() {
  [[ -f "$PIDFILE" ]] || return 1

  local pid
  pid=$(cat "$PIDFILE")

  # PID가 살아있는지 확인 (signal 0 = 존재 확인만)
  kill -0 "$pid" 2>/dev/null || { rm -f "$PIDFILE"; return 1; }

  # 우리 node server.mjs 프로세스가 맞는지 확인
  ps -p "$pid" -o command= 2>/dev/null | grep -q "node.*server\.mjs" || { rm -f "$PIDFILE"; return 1; }

  return 0
}

open_browser() {
  local url="http://localhost:$PORT"
  if [[ "$OSTYPE" == "darwin"* ]]; then
    open "$url"
  elif command -v xdg-open &>/dev/null; then
    xdg-open "$url"
  fi
}

wait_for_server() {
  local max_attempts=20
  for (( i=0; i<max_attempts; i++ )); do
    if curl -sf "http://localhost:$PORT" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.25
  done
  return 1
}

# --- Argument parsing ---

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port)
      PORT="$2"
      shift 2
      ;;
    --open)
      OPEN=true
      shift
      ;;
    --stop)
      COMMAND="stop"
      shift
      ;;
    --status)
      COMMAND="status"
      shift
      ;;
    --fg)
      COMMAND="foreground"
      shift
      ;;
    *)
      echo "Usage: $0 [--port NNNN] [--open] [--stop] [--status] [--fg]"
      echo ""
      echo "Commands:"
      echo "  (default)   Start server in background"
      echo "  --open      Start server + open browser"
      echo "  --fg        Start server in foreground (for debugging)"
      echo "  --stop      Stop background server"
      echo "  --status    Check if server is running"
      exit 1
      ;;
  esac
done

# --- Resolve server path ---

if ! command -v node &>/dev/null; then
  echo "Error: Node.js is required but not found in PATH"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER="$SCRIPT_DIR/log-viewer/server.mjs"
if [[ ! -f "$SERVER" ]]; then
  SERVER="$SCRIPT_DIR/../viewer/server.mjs"
fi

if [[ ! -f "$SERVER" ]]; then
  echo "Error: server.mjs not found at $SERVER"
  exit 1
fi

# --- Command dispatch ---

case "$COMMAND" in
  status)
    if is_running; then
      local_pid=$(cat "$PIDFILE")
      echo "Log viewer is running (PID: $local_pid, http://localhost:$PORT)"
    else
      echo "Log viewer is not running"
    fi
    ;;

  stop)
    if is_running; then
      local_pid=$(cat "$PIDFILE")
      kill "$local_pid" 2>/dev/null
      rm -f "$PIDFILE"
      echo "Log viewer stopped (PID: $local_pid)"
    else
      echo "Log viewer is not running"
    fi
    ;;

  foreground)
    if is_running; then
      echo "Log viewer is already running in background. Use --stop first."
      exit 1
    fi
    exec node "$SERVER" "$PORT"
    ;;

  start)
    # 이미 실행 중이면 브라우저만 열기
    if is_running; then
      echo "Log viewer is already running (http://localhost:$PORT)"
      if $OPEN; then
        open_browser
      fi
      exit 0
    fi

    # Background로 서버 시작
    nohup node "$SERVER" "$PORT" > /dev/null 2>&1 &
    echo $! > "$PIDFILE"

    if wait_for_server; then
      echo "Log viewer started (PID: $(cat "$PIDFILE"), http://localhost:$PORT)"
      if $OPEN; then
        open_browser
      fi
    else
      echo "Error: server failed to start within 5 seconds"
      rm -f "$PIDFILE"
      exit 1
    fi
    ;;
esac
