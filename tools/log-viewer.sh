#!/usr/bin/env bash
# Hook Events Log Viewer - launcher script
# Usage: ./log-viewer.sh [--port NNNN] [--open]

set -euo pipefail

PORT=7777
OPEN=false

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
    *)
      echo "Usage: $0 [--port NNNN] [--open]"
      exit 1
      ;;
  esac
done

if ! command -v node &>/dev/null; then
  echo "Error: Node.js is required but not found in PATH"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER="$SCRIPT_DIR/../viewer/server.mjs"

if [[ ! -f "$SERVER" ]]; then
  echo "Error: server.mjs not found at $SERVER"
  exit 1
fi

if $OPEN; then
  if [[ "$OSTYPE" == "darwin"* ]]; then
    (sleep 1 && open "http://localhost:$PORT") &
  elif command -v xdg-open &>/dev/null; then
    (sleep 1 && xdg-open "http://localhost:$PORT") &
  fi
fi

exec node "$SERVER" "$PORT"
