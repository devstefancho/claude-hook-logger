#!/usr/bin/env node
// Log rotation for Claude Code hook events (cross-platform Node.js version)
// Called on SessionStart. Rotates log if date has changed.

import { existsSync, readFileSync, renameSync, appendFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const HOME = process.env.HOME || homedir();
const LOG_DIR = join(HOME, ".claude", "claude-pulse");
const LOG_FILE = join(LOG_DIR, "hook-events.jsonl");

// Nothing to rotate if log file doesn't exist or is empty
if (!existsSync(LOG_FILE)) process.exit(0);
const stat = statSync(LOG_FILE);
if (stat.size === 0) process.exit(0);

// Read first line to get its date
const content = readFileSync(LOG_FILE, "utf-8");
const firstLine = content.split("\n")[0]?.trim();
if (!firstLine) process.exit(0);

let firstDate;
try {
  const parsed = JSON.parse(firstLine);
  firstDate = (parsed.ts || "").split("T")[0];
} catch {
  process.exit(0);
}

if (!firstDate) process.exit(0);

const today = new Date().toISOString().split("T")[0];

if (firstDate !== today) {
  const archive = join(LOG_DIR, `hook-events.${firstDate}.jsonl`);

  if (existsSync(archive)) {
    // Append current log to existing archive
    appendFileSync(archive, content);
  } else {
    renameSync(LOG_FILE, archive);
  }

  // Ensure current log is cleared
  if (existsSync(LOG_FILE)) {
    writeFileSync(LOG_FILE, "");
  }
}
