#!/usr/bin/env bash
# Claude Hook Logger - Uninstaller
# Removes hook scripts and cleans settings.json safely.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="$HOME/.claude"
HOOKS_DIR="$CLAUDE_DIR/hooks"
VIEWER_DIR="$HOOKS_DIR/log-viewer"
SETTINGS="$CLAUDE_DIR/settings.json"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "=== Claude Hook Logger - Uninstall ==="
echo ""

# Check node is available (needed for settings-merge)
if ! command -v node &>/dev/null; then
  echo -e "${RED}Error: Node.js is required for uninstall${NC}"
  exit 1
fi

# Remove hooks from settings.json
echo "Cleaning settings.json..."
if [[ -f "$SETTINGS" ]]; then
  node "$SCRIPT_DIR/lib/settings-merge.mjs" uninstall \
    --settings "$SETTINGS" \
    --pattern "event-logger\\.sh"
else
  echo "  No settings.json found, skipping."
fi

echo ""

# Remove files
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

echo ""
echo -e "${YELLOW}Note: ~/.claude/logs/ preserved (your log data)${NC}"
echo -e "${YELLOW}Note: If you added the 'hooklog' alias, remove it manually from your shell config.${NC}"
echo ""
echo -e "${GREEN}=== Uninstall complete ===${NC}"
