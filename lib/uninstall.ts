#!/usr/bin/env node
// Claude Hook Logger - Cross-platform Uninstaller
import { existsSync, rmSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

const HOME = homedir();
const CLAUDE_DIR = join(HOME, ".claude");
const HOOKS_DIR = join(CLAUDE_DIR, "hooks");
const VIEWER_DIR = join(HOOKS_DIR, "log-viewer");
const SETTINGS = join(CLAUDE_DIR, "settings.json");

const GREEN = "\x1b[0;32m";
const YELLOW = "\x1b[0;33m";
const RED = "\x1b[0;31m";
const NC = "\x1b[0m";

console.log("=== Claude Hook Logger - Uninstall ===\n");

// Remove hooks from settings.json
console.log("Cleaning settings.json...");
if (existsSync(SETTINGS)) {
  execSync(
    `node "${join(PROJECT_ROOT, "dist", "lib", "settings-merge-cli.js")}" uninstall --settings "${SETTINGS}" --pattern "event-logger\\.sh"`,
    { stdio: "inherit" }
  );
  // Also remove Node.js hook references
  execSync(
    `node "${join(PROJECT_ROOT, "dist", "lib", "settings-merge-cli.js")}" uninstall --settings "${SETTINGS}" --pattern "event-logger\\.js"`,
    { stdio: "inherit" }
  );
} else {
  console.log("  No settings.json found, skipping.");
}

console.log("");

// Remove files
console.log("Removing files...");

const filesToRemove = [
  join(HOOKS_DIR, "event-logger.sh"),
  join(HOOKS_DIR, "event-logger.js"),
  join(HOOKS_DIR, "rotate-logs.sh"),
  join(HOOKS_DIR, "rotate-logs.js"),
  join(HOOKS_DIR, "analyze-interrupts.sh"),
  join(HOOKS_DIR, "log-viewer.sh"),
];

for (const f of filesToRemove) {
  if (existsSync(f)) {
    unlinkSync(f);
    const name = f.split(/[/\\]/).pop();
    console.log(`  ${RED}-${NC} ${name}`);
  }
}

// Remove log-viewer directory
if (existsSync(VIEWER_DIR)) {
  rmSync(VIEWER_DIR, { recursive: true, force: true });
  console.log(`  ${RED}-${NC} log-viewer/`);
}

console.log("");
console.log(`${YELLOW}Note: ~/.claude/hook-logger/ preserved (your log data)${NC}`);
console.log(`${YELLOW}Note: If you added the 'hooklog' alias, remove it manually from your shell config.${NC}`);
console.log("");
console.log(`${GREEN}=== Uninstall complete ===${NC}`);
