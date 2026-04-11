#!/usr/bin/env bash
# Hook Events Log Viewer - launcher script
# Usage: ./log-viewer.sh [--port NNNN] [--open] [--stop] [--status] [--fg] [--doctor]

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
  ps -p "$pid" -o command= 2>/dev/null | grep -q "node.*start\.js" || { rm -f "$PIDFILE"; return 1; }

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
    --doctor)
      COMMAND="doctor"
      shift
      ;;
    --help|-h)
      COMMAND="help"
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Run 'claude-pulse --help' for usage."
      exit 1
      ;;
  esac
done

# --- Doctor (runs before server path resolution) ---

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "$COMMAND" == "help" ]]; then
  echo "claude-pulse — Dashboard for Claude Code hook events"
  echo ""
  echo "Usage: claude-pulse [command] [options]"
  echo ""
  echo "Commands:"
  echo "  (default)     Start server in background"
  echo "  --open        Start server + open browser"
  echo "  --stop        Stop background server"
  echo "  --status      Check if server is running"
  echo "  --doctor      Check installation health"
  echo "  --fg          Start server in foreground"
  echo "  --help, -h    Show this help"
  echo ""
  echo "Options:"
  echo "  --port NNNN   Set server port (default: 7777)"
  echo ""
  echo "Examples:"
  echo "  claude-pulse --open          # start + open browser"
  echo "  claude-pulse --doctor        # verify installation"
  echo "  claude-pulse --port 8080     # use custom port"
  echo ""
  echo "https://github.com/devstefancho/claude-pulse"
  exit 0
fi

if [[ "$COMMAND" == "doctor" ]]; then
    GREEN='\033[0;32m'
    RED='\033[0;31m'
    YELLOW='\033[0;33m'
    NC='\033[0m'
    ISSUES=0

    echo "=== Claude Pulse - Doctor ==="
    echo ""

    # Node.js
    if command -v node &>/dev/null; then
      NODE_VER=$(node -v)
      NODE_MAJOR=$(echo "$NODE_VER" | sed 's/v//' | cut -d. -f1)
      if [[ "$NODE_MAJOR" -ge 18 ]]; then
        echo -e "  ${GREEN}✓${NC} Node.js $NODE_VER"
      else
        echo -e "  ${RED}✗${NC} Node.js $NODE_VER (18+ required)"
        ((ISSUES++))
      fi
    else
      echo -e "  ${RED}✗${NC} Node.js not found"
      ((ISSUES++))
    fi

    # jq
    if command -v jq &>/dev/null; then
      echo -e "  ${GREEN}✓${NC} jq $(jq --version 2>/dev/null || echo 'installed')"
    else
      echo -e "  ${RED}✗${NC} jq not found (brew install jq)"
      ((ISSUES++))
    fi

    # Hook scripts
    echo ""
    HOOK_FILES=("event-logger.sh" "rotate-logs.sh" "log-viewer.sh")
    for f in "${HOOK_FILES[@]}"; do
      if [[ -f "$HOME/.claude/hooks/$f" ]]; then
        echo -e "  ${GREEN}✓${NC} ~/.claude/hooks/$f"
      else
        echo -e "  ${RED}✗${NC} ~/.claude/hooks/$f missing"
        ((ISSUES++))
      fi
    done

    # Server files
    if [[ -f "$HOME/.claude/hooks/log-viewer/start.js" ]]; then
      echo -e "  ${GREEN}✓${NC} ~/.claude/hooks/log-viewer/start.js"
    else
      echo -e "  ${RED}✗${NC} ~/.claude/hooks/log-viewer/start.js missing"
      ((ISSUES++))
    fi

    # Settings.json hooks
    echo ""
    if [[ -f "$HOME/.claude/settings.json" ]]; then
      if grep -q "event-logger" "$HOME/.claude/settings.json" 2>/dev/null; then
        echo -e "  ${GREEN}✓${NC} Hook config in settings.json"
      else
        echo -e "  ${RED}✗${NC} Hook config missing in settings.json"
        ((ISSUES++))
      fi
    else
      echo -e "  ${RED}✗${NC} ~/.claude/settings.json not found"
      ((ISSUES++))
    fi

    # Log directory
    if [[ -d "$HOME/.claude/claude-pulse" ]]; then
      LOG_FILE="$HOME/.claude/claude-pulse/hook-events.jsonl"
      if [[ -f "$LOG_FILE" ]]; then
        LINE_COUNT=$(wc -l < "$LOG_FILE" | tr -d ' ')
        echo -e "  ${GREEN}✓${NC} Log file ($LINE_COUNT events)"
      else
        echo -e "  ${YELLOW}~${NC} Log directory exists but no events yet"
      fi
    else
      echo -e "  ${YELLOW}~${NC} Log directory not created (will be created on first event)"
    fi

    # CLI symlink
    echo ""
    CLI_FOUND=false
    for dir in "/usr/local/bin" "/opt/homebrew/bin" "$HOME/.local/bin"; do
      if [[ -L "$dir/claude-pulse" ]]; then
        echo -e "  ${GREEN}✓${NC} CLI: $dir/claude-pulse"
        CLI_FOUND=true
        break
      fi
    done
    if ! $CLI_FOUND; then
      echo -e "  ${YELLOW}~${NC} CLI symlink not found (use full path to run)"
    fi

    # Dashboard server
    if is_running; then
      local_pid=$(cat "$PIDFILE")
      echo -e "  ${GREEN}✓${NC} Dashboard running (PID: $local_pid, port $PORT)"
    else
      echo -e "  ${YELLOW}~${NC} Dashboard not running"
    fi

    # launchd
    if [[ "$(uname)" == "Darwin" ]]; then
      PLIST="$HOME/Library/LaunchAgents/com.claude-pulse.dashboard.plist"
      if [[ -f "$PLIST" ]]; then
        echo -e "  ${GREEN}✓${NC} Auto-start enabled (launchd)"
      else
        echo -e "  ${YELLOW}~${NC} Auto-start not configured"
      fi
    fi

    echo ""
    if [[ $ISSUES -eq 0 ]]; then
      echo -e "  ${GREEN}All checks passed.${NC}"
    else
      echo -e "  ${RED}$ISSUES issue(s) found.${NC} Run install.sh to fix."
    fi
    exit 0
fi

# --- Resolve server path ---

if ! command -v node &>/dev/null; then
  echo "Error: Node.js is required but not found in PATH"
  exit 1
fi

SERVER="$SCRIPT_DIR/log-viewer/start.js"
if [[ ! -f "$SERVER" ]]; then
  SERVER="$SCRIPT_DIR/../dist/viewer/start.js"
fi

if [[ ! -f "$SERVER" ]]; then
  echo "Error: server.js not found at $SERVER"
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
