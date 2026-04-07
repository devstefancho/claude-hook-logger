#!/usr/bin/env node
// Claude Code Universal Event Logger (cross-platform Node.js version)
// Reads JSON from stdin, extracts event-specific fields, appends JSONL to log file.
// Used by all hook events via settings.json registration.

import { mkdirSync, appendFileSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { execSync, fork } from "node:child_process";
import { fileURLToPath } from "node:url";

const HOME = process.env.HOME || homedir();
const LOG_DIR = join(HOME, ".claude", "hook-logger");
const LOG_FILE = join(LOG_DIR, "hook-events.jsonl");

mkdirSync(LOG_DIR, { recursive: true });

// Read JSON input from stdin
let input = "";
for await (const chunk of process.stdin) {
  input += chunk;
}
input = input.trim();
if (!input) process.exit(0);

let parsed;
try {
  parsed = JSON.parse(input);
} catch {
  process.exit(0);
}

// Common fields
const ts = new Date().toISOString().replace(/\.\d{3}Z$/, ".000Z");
const event = parsed.hook_event_name || "unknown";
const sessionId = parsed.session_id || "unknown";
const cwd = parsed.cwd || "unknown";
const permMode = parsed.permission_mode || "";

const base = { ts, event, session_id: sessionId, cwd, permission_mode: permMode };

// Extract tool input summary for PreToolUse / PermissionRequest
function extractToolSummary(input, toolName) {
  const ti = input.tool_input || {};
  switch (toolName) {
    case "Bash": return (ti.command || "").slice(0, 200);
    case "Read": case "Write": case "Edit": return ti.file_path || "";
    case "Glob": case "Grep": return ti.pattern || "";
    case "Task": return ti.description || "";
    case "WebFetch": return ti.url || "";
    case "WebSearch": return ti.query || "";
    case "Skill": return ti.skill || "";
    default: {
      try { return JSON.stringify(ti).slice(0, 200); } catch { return ""; }
    }
  }
}

// Extract event-specific data
let data = {};
switch (event) {
  case "SessionStart":
    data = { source: parsed.source ?? null, model: parsed.model ?? null };
    break;
  case "SessionEnd":
    data = { reason: parsed.reason ?? null };
    break;
  case "UserPromptSubmit": {
    const prompt = parsed.prompt || "";
    data = { prompt: prompt.slice(0, 500), prompt_length: prompt.length };
    break;
  }
  case "PreToolUse": {
    const toolName = parsed.tool_name || "unknown";
    const toolUseId = parsed.tool_use_id || "unknown";
    data = { tool_name: toolName, tool_use_id: toolUseId, tool_input_summary: extractToolSummary(parsed, toolName) };
    break;
  }
  case "PostToolUse": {
    data = { tool_name: parsed.tool_name || "unknown", tool_use_id: parsed.tool_use_id || "unknown", success: true };
    break;
  }
  case "PostToolUseFailure": {
    data = {
      tool_name: parsed.tool_name || "unknown",
      tool_use_id: parsed.tool_use_id || "unknown",
      error: (parsed.error || "").slice(0, 300),
      is_interrupt: parsed.is_interrupt ?? false,
    };
    break;
  }
  case "Notification": {
    data = { notification_type: parsed.notification_type || "", message: (parsed.message || "").slice(0, 300) };
    break;
  }
  case "Stop": {
    data = { stop_hook_active: parsed.stop_hook_active ?? false };
    break;
  }
  case "SubagentStart": {
    data = { agent_id: parsed.agent_id || "", agent_type: parsed.agent_type || "" };
    break;
  }
  case "SubagentStop": {
    data = { agent_id: parsed.agent_id || "", agent_type: parsed.agent_type || "" };
    break;
  }
  case "PermissionRequest": {
    const toolName = parsed.tool_name || "unknown";
    data = { tool_name: toolName, tool_input_summary: extractToolSummary(parsed, toolName) };
    break;
  }
  default:
    data = {};
}

// Append JSONL line
const logLine = JSON.stringify({ ...base, data });
appendFileSync(LOG_FILE, logLine + "\n");

// On SessionStart, trigger log rotation (fire & forget)
if (event === "SessionStart") {
  const rotatePath = join(HOME, ".claude", "hooks", "rotate-logs.js");
  if (existsSync(rotatePath)) {
    try {
      const child = fork(rotatePath, [], { detached: true, stdio: "ignore" });
      child.unref();
    } catch { /* ignore */ }
  } else {
    // Fallback to .sh version
    const rotateShPath = join(HOME, ".claude", "hooks", "rotate-logs.sh");
    if (existsSync(rotateShPath)) {
      try { execSync(`bash "${rotateShPath}"`, { stdio: "ignore", timeout: 5000 }); } catch { /* ignore */ }
    }
  }
}

// On SessionEnd, record session summary to vault daily note (fire & forget)
if (event === "SessionEnd") {
  setTimeout(() => {
    try {
      const now = new Date();
      const date = now.toISOString().slice(0, 10);
      const time = now.toTimeString().slice(0, 5);
      const vaultDaily = join(HOME, ".claude", "vault", "daily");
      const dailyFile = join(vaultDaily, `${date}.md`);
      const sessionsDir = join(HOME, ".claude", "sessions");
      const historyFile = join(HOME, ".claude", "history.jsonl");

      mkdirSync(vaultDaily, { recursive: true });

      // Get session name
      let sessionName = "";
      if (existsSync(sessionsDir)) {
        for (const f of readdirSync(sessionsDir)) {
          if (!f.endsWith(".json")) continue;
          try {
            const sData = JSON.parse(readFileSync(join(sessionsDir, f), "utf-8"));
            if (sData.sessionId === sessionId && sData.name) {
              sessionName = sData.name;
              break;
            }
          } catch { /* skip */ }
        }
      }

      // Get git branch
      let branch = "n/a";
      try {
        branch = execSync(`git -C "${cwd}" branch --show-current`, { encoding: "utf-8", timeout: 3000 }).trim() || "n/a";
      } catch { /* ignore */ }

      const shortCwd = cwd.startsWith(HOME) ? "~" + cwd.slice(HOME.length) : cwd;

      // Get recent prompts from history.jsonl
      let prompts = "";
      if (existsSync(historyFile)) {
        try {
          const lines = readFileSync(historyFile, "utf-8").trim().split("\n");
          const matched = [];
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const entry = JSON.parse(line);
              if (entry.sessionId === sessionId && entry.display) {
                matched.push(entry.display.slice(0, 120));
              }
            } catch { /* skip */ }
          }
          prompts = matched.slice(-3).map(p => `  - "${p}"`).join("\n");
        } catch { /* ignore */ }
      }

      // Append to daily note
      let content = `\n## Claude session ended (${date} ${time})\n`;
      if (sessionName) content += `- name: "${sessionName}"\n`;
      content += `- dir: ${shortCwd} (${branch})\n`;
      content += `- session: ${sessionId.slice(0, 12)}...\n`;
      if (prompts) content += `- 최근 작업:\n${prompts}\n`;

      appendFileSync(dailyFile, content);
    } catch { /* ignore */ }
  }, 0);
}
