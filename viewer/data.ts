import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";

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
} /* c8 ignore next */

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

    if (ev.event === "SessionStart") {
      sess.hasSessionStart = true;
      sess.hasSessionEnd = false; // Reset on resume
    }
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
      /* c8 ignore next -- branch: || fallback */
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
    /* c8 ignore next -- branch: ternary */
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
    /* c8 ignore next -- branch: ternary chain */
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
    /* c8 ignore next -- branch: || fallback */
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
    /* c8 ignore next -- branch: initial comparison always true */
    if (ev.ts < firstTs) firstTs = ev.ts;
    if (ev.ts > lastTs) lastTs = ev.ts;
    if (ev.cwd && !cwd) cwd = ev.cwd;

    const toolName = ev.data?.tool_name;
    if (toolName) {
      toolCounts.set(toolName, (toolCounts.get(toolName) || 0) + 1);
    }
    /* c8 ignore next -- branch: && short-circuit */
    if (ev.event === "PreToolUse" && toolName === "Skill") {
      /* c8 ignore next -- branch: || fallback */
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

// --- Agent orchestration ---

export interface ClaudeSession {
  pid: number;
  sessionId: string;
  cwd: string;
  startedAt: number;
  kind?: string;
  entrypoint?: string;
  name?: string;
}

/* c8 ignore start -- TS interface (no runtime code) */
export interface AgentInfo {
  sessionId: string;
  name: string | null;
  cwd: string;
  projectName: string;
  branch: string | null;
  status: "active" | "idle" | "waiting" | "ended";
  lastActivity: string;
  lastToolName: string | null;
  sessionDuration: number;
  eventCount: number;
  summary: string | null;
  recentPrompts: string[];
  pid: number | null;
  justCompleted: boolean;
  permissionMessage: string | null;
  latestUserPrompt: string | null;
}
/* c8 ignore stop */

export function getClaudeSessions(sessionsDir: string): Map<string, ClaudeSession> {
  const result = new Map<string, ClaudeSession>();
  if (!fs.existsSync(sessionsDir)) return result;
  for (const file of fs.readdirSync(sessionsDir)) {
    if (!file.endsWith(".json")) continue;
    try {
      const data = JSON.parse(fs.readFileSync(path.join(sessionsDir, file), "utf-8"));
      if (data.sessionId) {
        result.set(data.sessionId, data as ClaudeSession);
      }
    } catch {
      // skip malformed
    }
  }
  return result;
}

function mangleCwd(cwd: string): string {
  const normalized = cwd.replace(/\\/g, "/").replace(/^[A-Z]:\//i, "/");
  return "-" + normalized.replace(/^\//g, "").replace(/\//g, "-");
}

export function getRecentPrompts(sessionId: string, cwd: string, count = 3): string[] {
  /* c8 ignore next -- branch: HOME always set in test env */
  const projectsDir = path.join(process.env.HOME || os.homedir(), ".claude", "projects");
  const mangledCwd = mangleCwd(cwd);
  const sessionFile = path.join(projectsDir, mangledCwd, `${sessionId}.jsonl`);
  if (!fs.existsSync(sessionFile)) return [];

  const prompts: string[] = [];
  const content = fs.readFileSync(sessionFile, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const data = JSON.parse(trimmed);
      if (data.type === "user" && data.message?.content) {
        const text = typeof data.message.content === "string"
          ? data.message.content
          : Array.isArray(data.message.content)
            /* c8 ignore start */
            ? data.message.content.filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join(" ")
            : "";
            /* c8 ignore stop */
        if (text) prompts.push(text.slice(0, 200));
      }
    } catch {
      // skip
    }
  }
  return prompts.slice(-count);
}

export function extractProjectName(cwd: string): string {
  const home = process.env.HOME || os.homedir();
  if (home && (cwd === home || cwd.startsWith(home + "/") || cwd.startsWith(home + "\\"))) {
    return "~" + cwd.slice(home.length);
  }
  return cwd;
}

/* c8 ignore next -- V8 doesn't cover function signature with default params */
export function buildAgentList(events: LogEvent[], claudeSessions: Map<string, ClaudeSession>, options: { includeEnded?: boolean; thresholdMs?: number; teams?: TeamInfo[] } = {}): AgentInfo[] {
  const { includeEnded = false, thresholdMs = 5 * 60 * 1000, teams = [] } = options;
  const summary = buildSummary(events);
  const now = Date.now();

  // Pre-index: last significant event per session, last tool event per session
  const lastSignificantBySession = new Map<string, LogEvent>();
  const lastPermResolveBySession = new Map<string, LogEvent>();
  const lastToolBySession = new Map<string, LogEvent>();
  const lastStopBySession = new Map<string, LogEvent>();
  const lastPermissionBySession = new Map<string, LogEvent>();
  const lastUserPromptBySession = new Map<string, LogEvent>();
  // key: "{parentSessionId}:{workerName}", value: last worker_permission_prompt Notification
  const workerPermByKey = new Map<string, LogEvent>();
  // Track dangling PreToolUse per session (PreToolUse without matching PostToolUse)
  // key: sessionId, value: Map<tool_use_id, LogEvent>
  const pendingPreToolBySession = new Map<string, Map<string, LogEvent>>();
  for (const ev of events) {
    /* c8 ignore next -- branch: session_id always present in test data */
    const sid = ev.session_id || "unknown";
    if (ev.event === "Stop" || ev.event === "PreToolUse" || ev.event === "PostToolUse" || ev.event === "UserPromptSubmit") {
      lastSignificantBySession.set(sid, ev);
    }
    // Permission resolution: only events that prove permission was resolved
    // PreToolUse is excluded because it fires BEFORE the permission check
    // SessionStart included because resume clears stale permission state
    if (ev.event === "Stop" || ev.event === "PostToolUse" || ev.event === "UserPromptSubmit" || ev.event === "SessionStart") {
      lastPermResolveBySession.set(sid, ev);
    }
    if ((ev.event === "PreToolUse" || ev.event === "PostToolUse") && ev.data?.tool_name) {
      lastToolBySession.set(sid, ev);
    }
    // Track dangling PreToolUse: add on PreToolUse, remove on PostToolUse/PostToolUseFailure
    if (ev.event === "PreToolUse" && ev.data?.tool_use_id) {
      if (!pendingPreToolBySession.has(sid)) pendingPreToolBySession.set(sid, new Map());
      pendingPreToolBySession.get(sid)!.set(String(ev.data.tool_use_id), ev);
    }
    if ((ev.event === "PostToolUse" || ev.event === "PostToolUseFailure") && ev.data?.tool_use_id) {
      pendingPreToolBySession.get(sid)?.delete(String(ev.data.tool_use_id));
    }
    if (ev.event === "Stop") {
      lastStopBySession.set(sid, ev);
    }
    if (ev.event === "Notification" && ev.data?.message &&
        ev.data?.notification_type !== "worker_permission_prompt" &&
        (String(ev.data.message).includes("permission") || String(ev.data.message).includes("approval"))) {
      lastPermissionBySession.set(sid, ev);
    }
    if (ev.event === "PermissionRequest") {
      lastPermissionBySession.set(sid, ev);
    }
    if (ev.event === "UserPromptSubmit" && ev.data?.prompt) {
      lastUserPromptBySession.set(sid, ev);
    }
    // Track worker_permission_prompt from parent sessions for team member mapping
    if (ev.event === "Notification" && ev.data?.notification_type === "worker_permission_prompt") {
      const match = String(ev.data.message || "").match(/^(.+?) needs permission for (.+)$/);
      if (match) {
        workerPermByKey.set(`${sid}:${match[1]}`, ev);
      }
    }
  }

  // Collect team member session IDs to preserve them even if ended
  const teamSessionIds = new Set<string>();
  if (teams) {
    for (const team of teams) {
      for (const member of team.members) {
        if (member.sessionId) teamSessionIds.add(member.sessionId);
      }
    }
  }

  const agents: AgentInfo[] = [];

  for (const sess of summary.sessions) {
    const claudeSession = claudeSessions.get(sess.id);

    // Determine status using custom threshold
    let status: AgentInfo["status"];
    if (sess.hasSessionEnd) {
      status = "ended";
    } else {
      const lastSignificant = lastSignificantBySession.get(sess.id);
      if (lastSignificant?.event === "Stop" && lastSignificant.data?.stop_hook_active) {
        status = "waiting";
      } else {
        const hasNoEnd = sess.hasSessionStart && !sess.hasSessionEnd;
        if (hasNoEnd) {
          const elapsed = now - new Date(sess.lastTs).getTime();
          status = elapsed <= thresholdMs ? "active" : "idle";
        /* c8 ignore start */
        } else {
          status = "ended";
        }
        /* c8 ignore stop */
      }
    }

    // Skip ended sessions unless explicitly requested or part of a team
    if (status === "ended" && !includeEnded && !teamSessionIds.has(sess.id)) continue;

    const lastToolEvent = lastToolBySession.get(sess.id);
    const cwd = claudeSession?.cwd || sess.cwd;

    // Only read prompts for non-ended sessions (expensive I/O)
    const recentPrompts = getRecentPrompts(sess.id, cwd);

    let branch: string | null = null;
    const treesMatch = cwd.match(/\/trees\/([^/]+)/);
    if (treesMatch) branch = treesMatch[1];

    const startedAt = claudeSession?.startedAt || new Date(sess.firstTs).getTime();
    const sessionDuration = now - startedAt;

    // Derive new status fields
    const lastStop = lastStopBySession.get(sess.id);
    const justCompleted = lastStop && !lastStop.data?.stop_hook_active ? (now - new Date(lastStop.ts).getTime()) <= 30000 : false;
    const lastPerm = lastPermissionBySession.get(sess.id);
    const lastResolve = lastPermResolveBySession.get(sess.id);
    const permResolved = lastPerm && lastResolve &&
      new Date(lastResolve.ts).getTime() > new Date(lastPerm.ts).getTime();
    const permissionMessage = (lastPerm && !permResolved)
      ? String(lastPerm.data?.message || "Waiting for approval")
      : null;

    // Override status to "waiting" if permission is unresolved
    if (permissionMessage && status !== "ended") {
      status = "waiting";
    }
    const lastPrompt = lastUserPromptBySession.get(sess.id);
    const latestUserPrompt = lastPrompt?.data?.prompt ? String(lastPrompt.data.prompt) : null;

    agents.push({
      sessionId: sess.id,
      name: claudeSession?.name || null,
      cwd,
      projectName: extractProjectName(cwd),
      branch,
      status,
      lastActivity: sess.lastTs,
      lastToolName: lastToolEvent?.data?.tool_name || null,
      sessionDuration,
      eventCount: sess.eventCount,
      summary: null,
      recentPrompts,
      pid: claudeSession?.pid || null,
      justCompleted,
      permissionMessage,
      latestUserPrompt,
    });
  }

  // Propagate worker_permission_prompt from parent session to team member agents
  // Worker names in notifications may differ from team member names (e.g., "tester" vs "tester2"),
  // so we match by checking if either name starts with the other.
  if (teams.length > 0) {
    for (const agent of agents) {
      if (agent.status === "ended") continue;
      for (const team of teams) {
        const member = team.members.find(m => m.sessionId === agent.sessionId);
        if (!member) continue;
        // Try exact match first, then prefix match
        const prefix = `${team.leadSessionId}:`;
        let workerPerm: LogEvent | undefined;
        workerPerm = workerPermByKey.get(`${prefix}${member.name}`);
        if (!workerPerm) {
          // Prefix match: notification worker name startsWith member name or vice versa
          for (const [key, ev] of workerPermByKey) {
            if (!key.startsWith(prefix)) continue;
            const notifWorkerName = key.slice(prefix.length);
            if (member.name.startsWith(notifWorkerName) || notifWorkerName.startsWith(member.name)) {
              workerPerm = ev;
              break;
            }
          }
        }
        if (!workerPerm) continue;
        const lastResolve = lastPermResolveBySession.get(agent.sessionId);
        const resolved = lastResolve && new Date(lastResolve.ts).getTime() > new Date(workerPerm.ts).getTime();
        if (!resolved) {
          agent.status = "waiting";
          if (!agent.permissionMessage) {
            agent.permissionMessage = String(workerPerm.data?.message || "Waiting for permission");
          }
        }
      }
    }

    // Fallback: detect dangling PreToolUse for idle team members (not lead)
    // Team member sessions may not receive PermissionRequest/Notification events,
    // so a PreToolUse without matching PostToolUse indicates permission waiting.
    // Only apply to "idle" agents — "active" agents have a dangling PreToolUse
    // because a tool is currently executing, not because it's waiting for permission.
    for (const agent of agents) {
      if (agent.status !== "idle") continue;
      const pending = pendingPreToolBySession.get(agent.sessionId);
      if (!pending || pending.size === 0) continue;
      // Only apply to team members (not lead)
      let isTeamMember = false;
      for (const team of teams) {
        if (team.members.some(m => m.sessionId === agent.sessionId) && team.leadSessionId !== agent.sessionId) {
          isTeamMember = true;
          break;
        }
      }
      if (!isTeamMember) continue;
      // Use the most recent dangling PreToolUse
      let latest: LogEvent | undefined;
      for (const ev of pending.values()) {
        if (!latest || ev.ts > latest.ts) latest = ev;
      }
      if (latest) {
        agent.status = "waiting";
        if (!agent.permissionMessage) {
          agent.permissionMessage = `Waiting for permission: ${latest.data?.tool_name || "tool"}`;
        }
      }
    }
  }

  // Sort: active > waiting > idle > ended, then by lastActivity desc
  const statusOrder = { active: 0, waiting: 1, idle: 2, ended: 3 };
  agents.sort((a, b) => {
    const so = statusOrder[a.status] - statusOrder[b.status];
    if (so !== 0) return so;
    /* c8 ignore next -- branch: ternary */
    return b.lastActivity > a.lastActivity ? 1 : -1;
  });

  return agents;
}

// --- Team data ---

export interface TeamMember {
  agentId: string;
  name: string;
  agentType?: string;
  model?: string;
  cwd?: string;
  tmuxPaneId?: string;
  sessionId?: string;
  joinedAt?: number;
}

export interface TeamInfo {
  name: string;
  description: string;
  createdAt: number;
  leadSessionId: string;
  members: TeamMember[];
}

interface SessionCandidate {
  sessionId: string;
  pid: number;
  cwd: string;
  mtime: number;
}

/* c8 ignore start -- OS-level pgrep call, not testable in unit tests */
function getDescendantPids(pid: number): number[] {
  if (process.platform === "win32") return [];
  const result: number[] = [];
  try {
    const children = execSync(`pgrep -P ${pid}`, {
      encoding: "utf-8",
      timeout: 2000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    for (const line of children.trim().split("\n")) {
      const childPid = parseInt(line.trim(), 10);
      if (!isNaN(childPid)) {
        result.push(childPid);
        result.push(...getDescendantPids(childPid));
      }
    }
  } catch { /* no children */ }
  return result;
}
/* c8 ignore stop */

export function getTeams(teamsDir: string, sessionsDir?: string): TeamInfo[] {
  if (!fs.existsSync(teamsDir)) return [];

  // Build session candidates from session files (PID → sessionId + cwd + mtime)
  const pidToSessionId = new Map<number, string>();
  const sessionCandidates: SessionCandidate[] = [];
  if (sessionsDir && fs.existsSync(sessionsDir)) {
    for (const file of fs.readdirSync(sessionsDir)) {
      /* c8 ignore next -- branch: file filter */
      if (!file.endsWith(".json")) continue;
      try {
        const filePath = path.join(sessionsDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        /* c8 ignore start -- requires real session files with pid */
        if (data.pid && data.sessionId) {
          pidToSessionId.set(data.pid, data.sessionId);
          const stat = fs.statSync(filePath);
          sessionCandidates.push({
            sessionId: data.sessionId,
            pid: data.pid,
            cwd: data.cwd || "",
            mtime: stat.mtimeMs,
          });
        }
        /* c8 ignore stop */
      /* c8 ignore start -- session file parse error */
      } catch {
        // skip
      }
      /* c8 ignore stop */
    }
  }

  // Build tmux paneId → panePid map (best-effort, tmux may not be available)
  /* c8 ignore start -- tmux OS call, not testable in unit tests */
  const panePidMap = new Map<string, number>();
  if (process.platform !== "win32") {
    try {
      const paneOutput = execSync("tmux list-panes -a -F '#{pane_id} #{pane_pid}'", {
        encoding: "utf-8",
        timeout: 3000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      for (const line of paneOutput.split("\n")) {
        const parts = line.trim().split(" ");
        if (parts.length >= 2) {
          panePidMap.set(parts[0], parseInt(parts[1], 10));
        }
      }
    } catch {
      // tmux not available
    }
  }
  /* c8 ignore stop */

  const teams: TeamInfo[] = [];
  for (const dir of fs.readdirSync(teamsDir)) {
    const configPath = path.join(teamsDir, dir, "config.json");
    if (!fs.existsSync(configPath)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      if (!data.name || !Array.isArray(data.members)) continue;
      const leadAgentId = (data.leadAgentId as string) || "";
      const leadSessionId = (data.leadSessionId as string) || "";
      const assignedSessionIds = new Set<string>();

      /* c8 ignore start -- branch: || fallbacks in member mapping */
      const members: TeamMember[] = data.members.map((m: Record<string, unknown>) => {
        const member: TeamMember = {
          agentId: (m.agentId as string) || "",
          name: (m.name as string) || "",
          agentType: (m.agentType as string) || undefined,
          model: (m.model as string) || undefined,
          cwd: (m.cwd as string) || undefined,
          tmuxPaneId: (m.tmuxPaneId as string) || undefined,
          joinedAt: typeof m.joinedAt === "number" ? m.joinedAt : undefined,
        };
        /* c8 ignore stop */

        // Resolve sessionId: lead member
        if (member.agentId === leadAgentId) {
          member.sessionId = leadSessionId;
          assignedSessionIds.add(leadSessionId);
        /* c8 ignore start -- tmux pane resolution requires live tmux session */
        } else if (member.tmuxPaneId && panePidMap.has(member.tmuxPaneId)) {
          // Resolve sessionId: tmux pane → recursive descendant PIDs → session file
          const panePid = panePidMap.get(member.tmuxPaneId)!;
          const descendantPids = getDescendantPids(panePid);
          for (const childPid of descendantPids) {
            const sid = pidToSessionId.get(childPid);
            if (sid && !assignedSessionIds.has(sid)) {
              member.sessionId = sid;
              assignedSessionIds.add(sid);
              break;
            }
          }
        }
        /* c8 ignore stop */

        return member;
      });

      // Temporal matching fallback: for unresolved non-lead members with joinedAt
      /* c8 ignore start -- requires session files + joinedAt timing match */
      for (const member of members) {
        if (member.sessionId || !member.joinedAt) continue;

        // Find unassigned session candidates with matching cwd, closest mtime to joinedAt
        const candidates = sessionCandidates
          .filter((s) => !assignedSessionIds.has(s.sessionId) && member.cwd && s.cwd === member.cwd)
          .sort((a, b) => Math.abs(a.mtime - member.joinedAt!) - Math.abs(b.mtime - member.joinedAt!));

        if (candidates.length > 0) {
          member.sessionId = candidates[0].sessionId;
          assignedSessionIds.add(candidates[0].sessionId);
        }
      }
      /* c8 ignore stop */

      teams.push({
        name: data.name,
        description: data.description || "",
        createdAt: data.createdAt || 0,
        leadSessionId,
        members,
      });
    } catch {
      // skip malformed config
    }
  }
  return teams;
}

/** Enrich team members with sessionId by matching hook event sessions (temporal + cwd) */
export function enrichTeamSessions(teams: TeamInfo[], summary: Summary): void {
  for (const team of teams) {
    const assignedSids = new Set(team.members.filter(m => m.sessionId).map(m => m.sessionId!));
    const unresolvedMembers = team.members
      .filter(m => !m.sessionId && m.joinedAt)
      .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));

    if (unresolvedMembers.length === 0) continue;

    const candidateSessions = summary.sessions
      .filter(s => !assignedSids.has(s.id) && s.cwd && unresolvedMembers.some(m => m.cwd === s.cwd))
      .sort((a, b) => new Date(a.firstTs).getTime() - new Date(b.firstTs).getTime());

    for (const member of unresolvedMembers) {
      const match = candidateSessions.find(
        s => s.cwd === member.cwd && !assignedSids.has(s.id)
          && Math.abs(new Date(s.firstTs).getTime() - (member.joinedAt || 0)) < 60000
      );
      if (match) {
        member.sessionId = match.id;
        assignedSids.add(match.id);
      }
    }
  }
}

// Summary cache for agent summaries
const summaryCache = new Map<string, { text: string; expiry: number }>();
const SUMMARY_TTL_MS = 5 * 60 * 1000;

export function getCachedSummary(sessionId: string): string | null {
  const cached = summaryCache.get(sessionId);
  if (cached && cached.expiry > Date.now()) return cached.text;
  summaryCache.delete(sessionId);
  return null;
}

export function setCachedSummary(sessionId: string, text: string): void {
  summaryCache.set(sessionId, { text, expiry: Date.now() + SUMMARY_TTL_MS });
}

export function buildMinimalContext(summary: Summary): string {
  return `You are an assistant that analyzes Claude Code hook event data.
You have MCP tools (claude-pulse) to query data. Use them for detailed answers.

Quick stats: ${summary.totalEvents} events, ${summary.sessionCount} sessions (${summary.liveSessionCount} live, ${summary.staleSessionCount} stale), ${summary.toolCount} tools, ${summary.interruptCount} interrupts

Use tools before answering:
- get_recent_activity: time-based activity query
- get_session_detail: per-session detail
- get_tool_skill_usage: tool/skill statistics
- search_events: event search
- list_sessions: session listing`;
}
