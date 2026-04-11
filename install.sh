#!/usr/bin/env bash
# Claude Pulse - Installer
# Copies hook scripts and merges settings.json safely.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="$HOME/.claude"
HOOKS_DIR="$CLAUDE_DIR/hooks"
VIEWER_DIR="$HOOKS_DIR/log-viewer"
LOGS_DIR="$CLAUDE_DIR/claude-pulse"
SETTINGS="$CLAUDE_DIR/settings.json"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "=== Claude Pulse - Install ==="
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

# Build TypeScript
echo "Building TypeScript..."
(cd "$SCRIPT_DIR" && npm run build)
echo -e "  ${GREEN}+${NC} dist/ built"
echo ""

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

cp "$SCRIPT_DIR/dist/viewer/server.js" "$VIEWER_DIR/server.js"
echo -e "  ${GREEN}+${NC} hooks/log-viewer/server.js"

cp "$SCRIPT_DIR/dist/viewer/start.js" "$VIEWER_DIR/start.js"
echo -e "  ${GREEN}+${NC} hooks/log-viewer/start.js"

cp "$SCRIPT_DIR/viewer/index.html" "$VIEWER_DIR/index.html"
echo -e "  ${GREEN}+${NC} hooks/log-viewer/index.html"

echo ""

# Merge settings.json
echo "Merging settings.json..."
node "$SCRIPT_DIR/dist/lib/settings-merge-cli.js" install \
  --config "$SCRIPT_DIR/hooks-config.json" \
  --settings "$SETTINGS"

echo ""

# CLI symlink
CLI_NAME="claude-pulse"
CLI_TARGET="$HOOKS_DIR/log-viewer.sh"
CLI_BIN_DIR=""

echo "Setting up CLI..."
if [[ -d /usr/local/bin ]] && [[ -w /usr/local/bin ]]; then
  CLI_BIN_DIR="/usr/local/bin"
elif [[ -d /opt/homebrew/bin ]] && [[ -w /opt/homebrew/bin ]]; then
  CLI_BIN_DIR="/opt/homebrew/bin"
elif mkdir -p "$HOME/.local/bin" 2>/dev/null; then
  CLI_BIN_DIR="$HOME/.local/bin"
  if [[ ":$PATH:" != *":$CLI_BIN_DIR:"* ]]; then
    echo -e "  ${YELLOW}Note: Add ~/.local/bin to your PATH:${NC}"
    echo "    export PATH=\"\$HOME/.local/bin:\$PATH\""
  fi
fi

if [[ -n "$CLI_BIN_DIR" ]]; then
  LINK_PATH="$CLI_BIN_DIR/$CLI_NAME"
  # Safety: skip if target is a regular file or directory (not our symlink)
  if [[ -e "$LINK_PATH" ]] && [[ ! -L "$LINK_PATH" ]]; then
    echo -e "  ${YELLOW}Warning: $LINK_PATH already exists (not a symlink), skipping${NC}"
  else
    ln -sf "$CLI_TARGET" "$LINK_PATH"
    echo -e "  ${GREEN}+${NC} $LINK_PATH"
  fi
else
  echo -e "  ${YELLOW}Warning: No writable bin directory found. Use full path:${NC}"
  echo "    $CLI_TARGET --open"
fi

echo ""

# launchd auto-start (macOS only)
if [[ "$(uname)" == "Darwin" ]]; then
  PLIST_DIR="$HOME/Library/LaunchAgents"
  PLIST_FILE="$PLIST_DIR/com.claude-pulse.dashboard.plist"

  # Resolve Node.js path for launchd environment
  NODE_PATH="$(command -v node)"
  NODE_BIN_DIR="$(dirname "$NODE_PATH")"

  echo -n "Enable auto-start on login? (y/N) "
  read -r AUTOSTART
  if [[ "$AUTOSTART" =~ ^[Yy]$ ]]; then
    mkdir -p "$PLIST_DIR"
    cat > "$PLIST_FILE" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.claude-pulse.dashboard</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${HOOKS_DIR}/log-viewer.sh</string>
    <string>--fg</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>${NODE_BIN_DIR}:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <false/>
  <key>StandardOutPath</key>
  <string>${LOGS_DIR}/launchd.log</string>
  <key>StandardErrorPath</key>
  <string>${LOGS_DIR}/launchd-error.log</string>
</dict>
</plist>
PLIST
    if launchctl load "$PLIST_FILE"; then
      echo -e "  ${GREEN}+${NC} Auto-start enabled (launchd)"
    else
      echo -e "  ${YELLOW}Warning: launchctl load failed. Plist saved but not loaded.${NC}"
    fi
  else
    echo -e "  Skipped. Run 'claude-pulse --open' manually after reboot."
  fi
fi

echo ""
echo -e "${GREEN}=== Installation complete ===${NC}"
echo ""
echo "Usage:"
echo "  claude-pulse --open       Start dashboard + open browser"
echo "  claude-pulse --status     Check server status"
echo "  claude-pulse --stop       Stop server"
echo "  Uninstall:                $SCRIPT_DIR/uninstall.sh"
