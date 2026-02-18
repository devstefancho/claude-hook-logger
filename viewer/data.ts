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
  isStale: boolean;
}

export interface ToolUsageEntry {
  name: string;
  count: number;
}

export interface Summary {
  totalEvents: number;
  sessionCount: number;
  liveSessionCount: number;
  staleSessionCount: number;
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
        isStale: false,
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

  const LIVE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
  const now = Date.now();
  for (const sess of sessions.values()) {
    const hasNoEnd = sess.hasSessionStart && !sess.hasSessionEnd;
    if (hasNoEnd) {
      const elapsed = now - new Date(sess.lastTs).getTime();
      sess.isLive = elapsed <= LIVE_THRESHOLD_MS;
      sess.isStale = elapsed > LIVE_THRESHOLD_MS;
    } else {
      sess.isLive = false;
      sess.isStale = false;
    }
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
    staleSessionCount: [...sessions.values()].filter(s => s.isStale).length,
    toolCount: toolUsage.length,
    interruptCount: interrupts.length,
    orphanCount: orphanIds.size,
    sessions: [...sessions.values()].sort((a, b) => (b.lastTs > a.lastTs ? 1 : -1)),
    toolUsage,
    skillUsage,
    orphanIds: [...orphanIds],
  };
}

export function buildChatContext(summary: Summary): string {
  const topTools = summary.toolUsage.slice(0, 10).map(t => `  ${t.name}: ${t.count}`).join("\n");
  const topSkills = summary.skillUsage.slice(0, 10).map(t => `  ${t.name}: ${t.count}`).join("\n");
  const sessionList = summary.sessions.slice(0, 10).map(s => {
    const status = s.isLive ? "LIVE" : s.isStale ? "STALE" : "ended";
    return `  ${s.id.slice(0, 8)} (${status}) - ${s.eventCount} events - ${s.cwd}`;
  }).join("\n");

  return `You are an assistant that analyzes Claude Code hook event data from a dashboard.
Here is the current dashboard summary:

Stats:
- Total events: ${summary.totalEvents}
- Sessions: ${summary.sessionCount} (${summary.liveSessionCount} live, ${summary.staleSessionCount} stale)
- Unique tools: ${summary.toolCount}
- Interrupts: ${summary.interruptCount}
- Orphaned tool calls: ${summary.orphanCount}

Top Tools:
${topTools || "  (none)"}

Top Skills:
${topSkills || "  (none)"}

Sessions:
${sessionList || "  (none)"}

Orphan IDs: ${summary.orphanIds.length ? summary.orphanIds.join(", ") : "(none)"}

Answer the user's questions based on this data. Be concise and helpful.`;
}

// --- New helper functions for MCP tools ---

export function filterEventsByTime(events: LogEvent[], since?: string, until?: string): LogEvent[] {
  return events.filter((ev) => {
    if (since && ev.ts < since) return false;
    if (until && ev.ts > until) return false;
    return true;
  });
}

export function getSessionEvents(events: LogEvent[], sessionId: string): LogEvent[] {
  return events.filter((ev) => {
    const sid = ev.session_id || "";
    return sid === sessionId || sid.startsWith(sessionId);
  });
}

export function buildSessionDetail(events: LogEvent[], sessionId: string): {
  sessionId: string;
  eventCount: number;
  firstTs: string | null;
  lastTs: string | null;
  cwd: string;
  tools: ToolUsageEntry[];
  skills: ToolUsageEntry[];
  events: Array<{ event: string; ts: string; tool?: string; detail?: string }>;
} {
  const sessionEvents = getSessionEvents(events, sessionId);
  if (sessionEvents.length === 0) {
    return { sessionId, eventCount: 0, firstTs: null, lastTs: null, cwd: "", tools: [], skills: [], events: [] };
  }

  const toolCounts = new Map<string, number>();
  const skillCounts = new Map<string, number>();
  let firstTs = sessionEvents[0].ts;
  let lastTs = sessionEvents[0].ts;
  let cwd = "";

  const eventList: Array<{ event: string; ts: string; tool?: string; detail?: string }> = [];

  for (const ev of sessionEvents) {
    if (ev.ts < firstTs) firstTs = ev.ts;
    if (ev.ts > lastTs) lastTs = ev.ts;
    if (ev.cwd && !cwd) cwd = ev.cwd;

    const toolName = ev.data?.tool_name;
    if (toolName) {
      toolCounts.set(toolName, (toolCounts.get(toolName) || 0) + 1);
    }
    if (ev.event === "PreToolUse" && toolName === "Skill") {
      const skillName = ev.data?.tool_input_summary || "unknown";
      skillCounts.set(skillName, (skillCounts.get(skillName) || 0) + 1);
    }

    eventList.push({
      event: ev.event,
      ts: ev.ts,
      ...(toolName ? { tool: toolName } : {}),
      ...(ev.data?.tool_input_summary ? { detail: ev.data.tool_input_summary } : {}),
    });
  }

  const tools = [...toolCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const skills = [...skillCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return { sessionId, eventCount: sessionEvents.length, firstTs, lastTs, cwd, tools, skills, events: eventList };
}

export function buildMinimalContext(summary: Summary): string {
  return `You are an assistant that analyzes Claude Code hook event data.
You have MCP tools (hook-logger) to query data. Use them for detailed answers.

Quick stats: ${summary.totalEvents} events, ${summary.sessionCount} sessions (${summary.liveSessionCount} live, ${summary.staleSessionCount} stale), ${summary.toolCount} tools, ${summary.interruptCount} interrupts

Use tools before answering:
- get_recent_activity: time-based activity query
- get_session_detail: per-session detail
- get_tool_skill_usage: tool/skill statistics
- search_events: event search
- list_sessions: session listing`;
}
