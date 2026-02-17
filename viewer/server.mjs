import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_LOG_DIR = path.join(process.env.HOME, ".claude", "logs");
const DEFAULT_PORT = 7777;

const BUILTIN_COMMANDS = new Set([
  // Official docs (code.claude.com/docs/en/interactive-mode)
  "/clear", "/compact", "/config", "/context", "/copy", "/cost",
  "/debug", "/desktop", "/doctor", "/exit", "/export", "/help",
  "/init", "/mcp", "/memory", "/model", "/permissions", "/plan",
  "/rename", "/resume", "/rewind", "/stats", "/status", "/statusline",
  "/tasks", "/teleport", "/theme", "/todos", "/usage",
  // Additional built-in commands
  "/add-dir", "/agents", "/bug", "/hooks", "/ide",
  "/install-github-app", "/login", "/logout", "/output-style",
  "/plugin", "/pr-comments", "/privacy-settings", "/release-notes",
  "/remote-env", "/review", "/sandbox", "/security-review",
  "/terminal-setup", "/vim", "/fast", "/slow", "/listen",
]);

export function isBuiltinCommand(prompt) {
  const cmd = prompt.split(/\s/)[0].toLowerCase();
  return BUILTIN_COMMANDS.has(cmd);
}

export function parseLogFile(logDir, filename) {
  const filePath = path.join(logDir, filename);
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, "utf-8");
  const events = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed));
    } catch {
      // skip malformed lines
    }
  }
  return events;
}

export function isValidFilename(file) {
  if (!file || file.includes("..") || file.includes("/") || file.includes("\\")) return false;
  return /^hook-events[\w.-]*\.jsonl$/.test(file);
}

export function getLogFiles(logDir) {
  if (!fs.existsSync(logDir)) return [];
  return fs
    .readdirSync(logDir)
    .filter((f) => /^hook-events.*\.jsonl$/.test(f))
    .sort()
    .reverse();
}

export function buildSummary(events) {
  const sessions = new Map();
  const toolCounts = new Map();
  const skillCounts = new Map();
  const preToolIds = new Set();
  const postToolIds = new Set();
  const interrupts = [];
  let totalEvents = events.length;

  for (const ev of events) {
    const sid = ev.session_id || "unknown";
    if (!sessions.has(sid)) {
      sessions.set(sid, {
        id: sid,
        cwd: ev.cwd || "",
        eventCount: 0,
        firstTs: ev.ts,
        lastTs: ev.ts,
        hasInterrupt: false,
        orphanCount: 0,
        hasSessionStart: false,
        hasSessionEnd: false,
        isLive: false,
      });
    }
    const sess = sessions.get(sid);
    sess.eventCount++;
    if (ev.ts < sess.firstTs) sess.firstTs = ev.ts;
    if (ev.ts > sess.lastTs) sess.lastTs = ev.ts;

    const toolName = ev.data?.tool_name;
    const toolUseId = ev.data?.tool_use_id;

    if (toolName) {
      toolCounts.set(toolName, (toolCounts.get(toolName) || 0) + 1);
    }

    if (ev.event === "PreToolUse" && toolName === "Skill") {
      const skillName = ev.data?.tool_input_summary || "unknown";
      skillCounts.set(skillName, (skillCounts.get(skillName) || 0) + 1);
    }

    // UserPromptSubmit에서 slash command 감지 (유저가 직접 호출한 경우)
    if (ev.event === "UserPromptSubmit") {
      const prompt = (ev.data?.prompt || "").trim();
      if (prompt.startsWith("/") && !isBuiltinCommand(prompt)) {
        const skillName = prompt.split(/\s/)[0].slice(1); // "/" 제거
        skillCounts.set(skillName, (skillCounts.get(skillName) || 0) + 1);
      }
    }

    if (ev.event === "PreToolUse" && toolUseId) {
      preToolIds.add(toolUseId);
    }
    if ((ev.event === "PostToolUse" || ev.event === "PostToolUseFailure") && toolUseId) {
      postToolIds.add(toolUseId);
    }

    if (ev.event === "SessionStart") sess.hasSessionStart = true;
    if (ev.event === "SessionEnd") sess.hasSessionEnd = true;

    if (ev.event === "Stop" && ev.data?.stop_hook_active) {
      sess.hasInterrupt = true;
      interrupts.push(ev);
    }
  }

  // Compute live sessions
  for (const sess of sessions.values()) {
    sess.isLive = sess.hasSessionStart && !sess.hasSessionEnd;
  }

  // Compute orphans
  const orphanIds = new Set();
  for (const id of preToolIds) {
    if (!postToolIds.has(id)) orphanIds.add(id);
  }

  // Assign orphan counts to sessions
  for (const ev of events) {
    if (ev.event === "PreToolUse" && ev.data?.tool_use_id && orphanIds.has(ev.data.tool_use_id)) {
      const sess = sessions.get(ev.session_id || "unknown");
      if (sess) sess.orphanCount++;
    }
  }

  const toolUsage = [...toolCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const skillUsage = [...skillCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalEvents,
    sessionCount: sessions.size,
    liveSessionCount: [...sessions.values()].filter(s => s.isLive).length,
    toolCount: toolUsage.length,
    interruptCount: interrupts.length,
    orphanCount: orphanIds.size,
    sessions: [...sessions.values()].sort((a, b) => (b.lastTs > a.lastTs ? 1 : -1)),
    toolUsage,
    skillUsage,
    orphanIds: [...orphanIds],
  };
}

function sendJson(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-cache",
  });
  res.end(body);
}

export function createServer(logDir, htmlPath) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const pathname = url.pathname;

    if (pathname === "/" || pathname === "/index.html") {
      const html = fs.readFileSync(htmlPath, "utf-8");
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache",
      });
      res.end(html);
      return;
    }

    if (pathname === "/api/files") {
      return sendJson(res, { files: getLogFiles(logDir) });
    }

    if (pathname === "/api/events") {
      const file = url.searchParams.get("file") || "hook-events.jsonl";
      if (!isValidFilename(file)) return sendJson(res, { error: "Invalid filename" }, 400);
      const events = parseLogFile(logDir, file);
      return sendJson(res, { events, count: events.length });
    }

    if (pathname === "/api/summary") {
      const file = url.searchParams.get("file") || "hook-events.jsonl";
      if (!isValidFilename(file)) return sendJson(res, { error: "Invalid filename" }, 400);
      const events = parseLogFile(logDir, file);
      const summary = buildSummary(events);
      return sendJson(res, summary);
    }

    sendJson(res, { error: "Not found" }, 404);
  });

  return server;
}

// Direct execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const PORT = parseInt(process.argv[2] || String(DEFAULT_PORT), 10);
  const server = createServer(DEFAULT_LOG_DIR, path.join(__dirname, "index.html"));

  server.listen(PORT, () => {
    console.log(`Hook Events Log Viewer running at http://localhost:${PORT}`);
    console.log(`Log directory: ${DEFAULT_LOG_DIR}`);
    console.log("Press Ctrl+C to stop");
  });

  function shutdown() {
    console.log("\nShutting down...");
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000);
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
