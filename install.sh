#!/usr/bin/env bash
# Claude Hook Logger - Installer
# Copies hook scripts and merges settings.json safely.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="$HOME/.claude"
HOOKS_DIR="$CLAUDE_DIR/hooks"
VIEWER_DIR="$HOOKS_DIR/log-viewer"
LOGS_DIR="$CLAUDE_DIR/logs"
SETTINGS="$CLAUDE_DIR/settings.json"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "=== Claude Hook Logger - Install ==="
echo ""

# Check dependencies
MISSING=()
if ! command -v jq &>/dev/null; then
  MISSING+=("jq")
fi
if ! command -v node &>/dev/null; then
  MISSING+=("node")
else
  NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
  if [[ "$NODE_VERSION" -lt 18 ]]; then
    echo -e "${RED}Error: Node.js 18+ required (found v${NODE_VERSION})${NC}"
    exit 1
  fi
fi

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo -e "${RED}Error: Missing dependencies: ${MISSING[*]}${NC}"
  echo "Install via: brew install ${MISSING[*]}"
  exit 1
fi

# Create directories
mkdir -p "$HOOKS_DIR" "$VIEWER_DIR" "$LOGS_DIR"

# Copy files
echo "Copying files..."

cp "$SCRIPT_DIR/hooks/event-logger.sh" "$HOOKS_DIR/event-logger.sh"
chmod +x "$HOOKS_DIR/event-logger.sh"
echo -e "  ${GREEN}+${NC} hooks/event-logger.sh"

cp "$SCRIPT_DIR/hooks/rotate-logs.sh" "$HOOKS_DIR/rotate-logs.sh"
chmod +x "$HOOKS_DIR/rotate-logs.sh"
echo -e "  ${GREEN}+${NC} hooks/rotate-logs.sh"

cp "$SCRIPT_DIR/tools/analyze-interrupts.sh" "$HOOKS_DIR/analyze-interrupts.sh"
chmod +x "$HOOKS_DIR/analyze-interrupts.sh"
echo -e "  ${GREEN}+${NC} hooks/analyze-interrupts.sh"

cp "$SCRIPT_DIR/tools/log-viewer.sh" "$HOOKS_DIR/log-viewer.sh"
chmod +x "$HOOKS_DIR/log-viewer.sh"
echo -e "  ${GREEN}+${NC} hooks/log-viewer.sh"

cp "$SCRIPT_DIR/viewer/server.mjs" "$VIEWER_DIR/server.mjs"
echo -e "  ${GREEN}+${NC} hooks/log-viewer/server.mjs"

cp "$SCRIPT_DIR/viewer/index.html" "$VIEWER_DIR/index.html"
echo -e "  ${GREEN}+${NC} hooks/log-viewer/index.html"

echo ""

# Merge settings.json
echo "Merging settings.json..."
node "$SCRIPT_DIR/lib/settings-merge.mjs" install \
  --config "$SCRIPT_DIR/hooks-config.json" \
  --settings "$SETTINGS"

echo ""
echo -e "${GREEN}=== Installation complete ===${NC}"
echo ""
echo "Usage:"
echo "  View dashboard:  ~/.claude/hooks/log-viewer.sh --open"
echo "  Analyze logs:    ~/.claude/hooks/analyze-interrupts.sh"
echo "  Uninstall:       $SCRIPT_DIR/uninstall.sh"
