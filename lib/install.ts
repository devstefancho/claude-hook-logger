#!/usr/bin/env node
// Claude Hook Logger - Cross-platform Installer
import { mkdirSync, copyFileSync, chmodSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const isWindows = process.platform === "win32";

const HOME = homedir();
const CLAUDE_DIR = join(HOME, ".claude");
const HOOKS_DIR = join(CLAUDE_DIR, "hooks");
const VIEWER_DIR = join(HOOKS_DIR, "log-viewer");
const LOGS_DIR = join(CLAUDE_DIR, "hook-logger");

const GREEN = "\x1b[0;32m";
const RED = "\x1b[0;31m";
const NC = "\x1b[0m";

console.log("=== Claude Hook Logger - Install ===\n");

// Check dependencies
try {
  const version = execSync("node -v", { encoding: "utf-8" }).trim();
  const major = parseInt(version.replace("v", "").split(".")[0]);
  if (major < 18) {
    console.error(`${RED}Error: Node.js 18+ required (found ${version})${NC}`);
    process.exit(1);
  }
} catch {
  console.error(`${RED}Error: Node.js is required${NC}`);
  process.exit(1);
}

if (!isWindows) {
  try {
    execSync("command -v jq", { stdio: "pipe" });
  } catch {
    console.error(`${RED}Error: jq is required (brew install jq)${NC}`);
    process.exit(1);
  }
}

// Build TypeScript
console.log("Building TypeScript...");
execSync("npm run build", { cwd: PROJECT_ROOT, stdio: "inherit" });
console.log(`  ${GREEN}+${NC} dist/ built\n`);

// Create directories
mkdirSync(HOOKS_DIR, { recursive: true });
mkdirSync(VIEWER_DIR, { recursive: true });
mkdirSync(LOGS_DIR, { recursive: true });

// Copy files
console.log("Copying files...");

interface CopyEntry {
  src: string;
  dst: string;
  executable?: boolean;
  label: string;
}

const filesToCopy: CopyEntry[] = [
  // Shell scripts (Unix only)
  ...(!isWindows ? [
    { src: "hooks/event-logger.sh", dst: join(HOOKS_DIR, "event-logger.sh"), executable: true, label: "hooks/event-logger.sh" },
    { src: "hooks/rotate-logs.sh", dst: join(HOOKS_DIR, "rotate-logs.sh"), executable: true, label: "hooks/rotate-logs.sh" },
    { src: "tools/analyze-interrupts.sh", dst: join(HOOKS_DIR, "analyze-interrupts.sh"), executable: true, label: "hooks/analyze-interrupts.sh" },
    { src: "tools/log-viewer.sh", dst: join(HOOKS_DIR, "log-viewer.sh"), executable: true, label: "hooks/log-viewer.sh" },
  ] : []),
  // Node.js hooks (all platforms)
  { src: "hooks/event-logger.js", dst: join(HOOKS_DIR, "event-logger.js"), label: "hooks/event-logger.js" },
  { src: "hooks/rotate-logs.js", dst: join(HOOKS_DIR, "rotate-logs.js"), label: "hooks/rotate-logs.js" },
  // Viewer
  { src: "dist/viewer/server.js", dst: join(VIEWER_DIR, "server.js"), label: "hooks/log-viewer/server.js" },
  { src: "dist/viewer/start.js", dst: join(VIEWER_DIR, "start.js"), label: "hooks/log-viewer/start.js" },
  { src: "viewer/index.html", dst: join(VIEWER_DIR, "index.html"), label: "hooks/log-viewer/index.html" },
];

for (const entry of filesToCopy) {
  const srcPath = join(PROJECT_ROOT, entry.src);
  if (!existsSync(srcPath)) {
    console.log(`  (skipped) ${entry.label} - not found`);
    continue;
  }
  copyFileSync(srcPath, entry.dst);
  if (entry.executable && !isWindows) {
    chmodSync(entry.dst, 0o755);
  }
  console.log(`  ${GREEN}+${NC} ${entry.label}`);
}

console.log("");

// Determine which hooks-config to use based on platform
const configFile = isWindows ? "hooks-config-node.json" : "hooks-config.json";
const configPath = existsSync(join(PROJECT_ROOT, configFile))
  ? join(PROJECT_ROOT, configFile)
  : join(PROJECT_ROOT, "hooks-config.json");

// Merge settings.json
console.log("Merging settings.json...");
execSync(
  `node "${join(PROJECT_ROOT, "dist", "lib", "settings-merge-cli.js")}" install --config "${configPath}" --settings "${join(CLAUDE_DIR, "settings.json")}"`,
  { stdio: "inherit" }
);

console.log("");
console.log(`${GREEN}=== Installation complete ===${NC}\n`);

if (isWindows) {
  console.log("Usage:");
  console.log("  View dashboard:  node %USERPROFILE%\\.claude\\hooks\\log-viewer\\start.js");
  console.log(`  Uninstall:       node "${join(PROJECT_ROOT, "dist", "lib", "uninstall.js")}"`);
} else {
  console.log("Usage:");
  console.log("  View dashboard:  ~/.claude/hooks/log-viewer.sh --open");
  console.log("  Analyze logs:    ~/.claude/hooks/analyze-interrupts.sh");
  console.log(`  Uninstall:       node "${join(PROJECT_ROOT, "dist", "lib", "uninstall.js")}"`);
}
