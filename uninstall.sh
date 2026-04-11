#!/usr/bin/env bash
# Claude Pulse - Uninstaller
# Removes hook scripts and cleans settings.json safely.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="$HOME/.claude"
HOOKS_DIR="$CLAUDE_DIR/hooks"
VIEWER_DIR="$HOOKS_DIR/log-viewer"
SETTINGS="$CLAUDE_DIR/settings.json"
PIDFILE="$HOOKS_DIR/log-viewer.pid"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "=== Claude Pulse - Uninstall ==="
echo ""

# 1. Stop running server first
echo "Stopping server..."
if [[ -f "$HOOKS_DIR/log-viewer.sh" ]]; then
  "$HOOKS_DIR/log-viewer.sh" --stop 2>/dev/null || true
elif [[ -f "$PIDFILE" ]]; then
  pid=$(cat "$PIDFILE")
  kill "$pid" 2>/dev/null || true
  rm -f "$PIDFILE"
fi
echo ""

# 2. Unload launchd agent (macOS) — before deleting scripts
if [[ "$(uname)" == "Darwin" ]]; then
  PLIST="$HOME/Library/LaunchAgents/com.claude-pulse.dashboard.plist"
  if [[ -f "$PLIST" ]]; then
    launchctl unload "$PLIST" 2>/dev/null || true
    rm "$PLIST"
    echo -e "  ${RED}-${NC} launchd agent removed"
  fi
fi

# 3. Remove CLI symlink
for dir in "/usr/local/bin" "/opt/homebrew/bin" "$HOME/.local/bin"; do
  if [[ -L "$dir/claude-pulse" ]]; then
    rm "$dir/claude-pulse"
    echo -e "  ${RED}-${NC} $dir/claude-pulse"
  fi
done

# 4. Clean hooks from settings.json (requires Node)
echo ""
echo "Cleaning settings.json..."
if ! command -v node &>/dev/null; then
  echo -e "  ${YELLOW}Warning: Node.js not found. settings.json cleanup skipped.${NC}"
  echo -e "  ${YELLOW}Remove claude-pulse hooks from ~/.claude/settings.json manually.${NC}"
elif [[ -f "$SETTINGS" ]]; then
  node "$SCRIPT_DIR/dist/lib/settings-merge-cli.js" uninstall \
    --settings "$SETTINGS" \
    --pattern "event-logger\\.sh"
else
  echo "  No settings.json found, skipping."
fi

echo ""

# 5. Remove files
echo "Removing files..."

FILES_TO_REMOVE=(
  "$HOOKS_DIR/event-logger.sh"
  "$HOOKS_DIR/rotate-logs.sh"
  "$HOOKS_DIR/analyze-interrupts.sh"
  "$HOOKS_DIR/log-viewer.sh"
)

for f in "${FILES_TO_REMOVE[@]}"; do
  if [[ -f "$f" ]]; then
    rm "$f"
    echo -e "  ${RED}-${NC} $(basename "$f")"
  fi
done

# Remove log-viewer directory
if [[ -d "$VIEWER_DIR" ]]; then
  rm -rf "$VIEWER_DIR"
  echo -e "  ${RED}-${NC} log-viewer/"
fi

# Remove pidfile
rm -f "$PIDFILE"

echo ""
echo -e "${YELLOW}Note: ~/.claude/claude-pulse/ preserved (your log data)${NC}"
echo ""
echo -e "${GREEN}=== Uninstall complete ===${NC}"
