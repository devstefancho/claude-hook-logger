import http from "node:http";
import fs from "node:fs";
import path from "node:path";

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

export function isBuiltinCommand(prompt: string): boolean {
  const cmd = prompt.split(/\s/)[0].toLowerCase();
  return BUILTIN_COMMANDS.has(cmd);
}

export interface LogEvent {
  event: string;
  session_id?: string;
  ts: string;
  cwd?: string;
  permission_mode?: string;
  data?: {
    tool_name?: string;
    tool_use_id?: string;
    tool_input_summary?: string;
    stop_hook_active?: boolean;
    prompt?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface SessionInfo {
  id: string;
  cwd: string;
  eventCount: number;
  firstTs: string;
  lastTs: string;
  hasInterrupt: boolean;
  orphanCount: number;
  hasSessionStart: boolean;
  hasSessionEnd: boolean;
  isLive: boolean;
}

export interface ToolUsageEntry {
  name: string;
  count: number;
}

export interface Summary {
  totalEvents: number;
  sessionCount: number;
  liveSessionCount: number;
  toolCount: number;
  interruptCount: number;
  orphanCount: number;
  sessions: SessionInfo[];
  toolUsage: ToolUsageEntry[];
  skillUsage: ToolUsageEntry[];
  orphanIds: string[];
}

export function parseLogFile(logDir: string, filename: string): LogEvent[] {
  const filePath = path.join(logDir, filename);
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, "utf-8");
  const events: LogEvent[] = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed) as LogEvent);
    } catch {
      // skip malformed lines
    }
  }
  return events;
}

export function isValidFilename(file: string | null | undefined): boolean {
  if (!file || file.includes("..") || file.includes("/") || file.includes("\\")) return false;
  return /^hook-events[\w.-]*\.jsonl$/.test(file);
}

export function getLogFiles(logDir: string): string[] {
  if (!fs.existsSync(logDir)) return [];
  return fs
    .readdirSync(logDir)
    .filter((f) => /^hook-events.*\.jsonl$/.test(f))
    .sort()
    .reverse();
}

export function buildSummary(events: LogEvent[]): Summary {
  const sessions = new Map<string, SessionInfo>();
  const toolCounts = new Map<string, number>();
  const skillCounts = new Map<string, number>();
  const preToolIds = new Set<string>();
  const postToolIds = new Set<string>();
  const interrupts: LogEvent[] = [];
  const totalEvents = events.length;

  for (const ev of events) {
    const sid = ev.session_id || "unknown";
    if (!sessions.has(sid)) {
      sessions.set(sid, {
        id: sid,
        cwd: (ev.cwd as string) || "",
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
    const sess = sessions.get(sid)!;
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

  for (const sess of sessions.values()) {
    sess.isLive = sess.hasSessionStart && !sess.hasSessionEnd;
  }

  const orphanIds = new Set<string>();
  for (const id of preToolIds) {
    if (!postToolIds.has(id)) orphanIds.add(id);
  }

  for (const ev of events) {
    if (ev.event === "PreToolUse" && ev.data?.tool_use_id && orphanIds.has(ev.data.tool_use_id)) {
      const sess = sessions.get(ev.session_id || "unknown");
      if (sess) sess.orphanCount++;
    }
  }

  const toolUsage: ToolUsageEntry[] = [...toolCounts.entries()]
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

function sendJson(res: http.ServerResponse, data: unknown, status = 200): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-cache",
  });
  res.end(body);
}

export function createServer(logDir: string, htmlPath: string): http.Server {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url!, `http://${req.headers.host || "localhost"}`);
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

