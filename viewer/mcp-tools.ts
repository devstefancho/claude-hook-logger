import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod/v4";
import {
  parseLogFile,
  getLogFiles,
  buildSummary,
  filterEventsByTime,
  getSessionEvents,
  buildSessionDetail,
} from "./data.js";
import type { LogEvent } from "./data.js";

// ---------------------------------------------------------------------------
// Exported handler logic (testable without MCP protocol)
// ---------------------------------------------------------------------------

export function getAllEvents(logDir: string): LogEvent[] {
  const files = getLogFiles(logDir);
  const mainFile = files.includes("hook-events.jsonl") ? "hook-events.jsonl" : files[0];
  if (!mainFile) return [];
  return parseLogFile(logDir, mainFile);
}

export function handleGetDashboardSummary(logDir: string, args: { top_n?: number }) {
  const events = getAllEvents(logDir);
  const summary = buildSummary(events);
  const topN = args.top_n ?? 20;
  return {
    totalEvents: summary.totalEvents,
    sessionCount: summary.sessionCount,
    liveSessionCount: summary.liveSessionCount,
    staleSessionCount: summary.staleSessionCount,
    toolCount: summary.toolCount,
    interruptCount: summary.interruptCount,
    orphanCount: summary.orphanCount,
    topTools: summary.toolUsage.slice(0, topN),
    topSkills: summary.skillUsage.slice(0, topN),
    orphanIds: summary.orphanIds,
  };
}

export function handleListSessions(logDir: string, args: { status?: string; since?: string; limit?: number }) {
  const events = getAllEvents(logDir);
  const summary = buildSummary(events);
  let sessions = summary.sessions;

  if (args.status && args.status !== "all") {
    sessions = sessions.filter((s) => {
      if (args.status === "live") return s.isLive;
      if (args.status === "stale") return s.isStale;
      if (args.status === "ended") return !s.isLive && !s.isStale;
      return true;
    });
  }

  if (args.since) {
    sessions = sessions.filter((s) => s.lastTs >= args.since!);
  }

  const limit = args.limit ?? 50;
  sessions = sessions.slice(0, limit);

  return sessions.map((s) => ({
    id: s.id,
    status: s.isLive ? "live" : s.isStale ? "stale" : "ended",
    eventCount: s.eventCount,
    cwd: s.cwd,
    firstTs: s.firstTs,
    lastTs: s.lastTs,
    hasInterrupt: s.hasInterrupt,
    orphanCount: s.orphanCount,
  }));
}

export function handleGetSessionDetail(logDir: string, args: { session_id: string; max_events?: number }) {
  const events = getAllEvents(logDir);
  const detail = buildSessionDetail(events, args.session_id);
  const maxEvents = args.max_events ?? 100;
  return {
    ...detail,
    events: detail.events.slice(0, maxEvents),
    totalEventsInSession: detail.events.length,
    truncated: detail.events.length > maxEvents,
  };
}

export function handleGetRecentActivity(logDir: string, args: { minutes?: number; since?: string }) {
  const events = getAllEvents(logDir);
  const sinceTs = args.since ?? new Date(Date.now() - (args.minutes ?? 30) * 60 * 1000).toISOString();
  const filtered = filterEventsByTime(events, sinceTs);
  const summary = buildSummary(filtered);
  return {
    timeRange: { since: sinceTs, until: new Date().toISOString() },
    totalEvents: summary.totalEvents,
    sessionCount: summary.sessionCount,
    liveSessionCount: summary.liveSessionCount,
    topTools: summary.toolUsage.slice(0, 10),
    topSkills: summary.skillUsage.slice(0, 10),
    sessions: summary.sessions.map((s) => ({
      id: s.id,
      status: s.isLive ? "live" : s.isStale ? "stale" : "ended",
      eventCount: s.eventCount,
      cwd: s.cwd,
    })),
  };
}

export function handleGetToolSkillUsage(logDir: string, args: { type?: string; top_n?: number; minutes?: number; session_id?: string }) {
  let events = getAllEvents(logDir);

  if (args.session_id) {
    events = getSessionEvents(events, args.session_id);
  }
  if (args.minutes) {
    const sinceTs = new Date(Date.now() - args.minutes * 60 * 1000).toISOString();
    events = filterEventsByTime(events, sinceTs);
  }

  const summary = buildSummary(events);
  const topN = args.top_n ?? 20;
  const usageType = args.type ?? "both";

  const result: Record<string, unknown> = { eventCount: summary.totalEvents };
  if (usageType === "tools" || usageType === "both") {
    result.tools = summary.toolUsage.slice(0, topN);
  }
  if (usageType === "skills" || usageType === "both") {
    result.skills = summary.skillUsage.slice(0, topN);
  }

  return result;
}

export function handleSearchEvents(logDir: string, args: { event_type?: string; tool_name?: string; text_search?: string; session_id?: string; limit?: number }) {
  let events = getAllEvents(logDir);

  if (args.session_id) {
    events = getSessionEvents(events, args.session_id);
  }
  if (args.event_type) {
    events = events.filter((ev) => ev.event === args.event_type);
  }
  if (args.tool_name) {
    events = events.filter((ev) => ev.data?.tool_name === args.tool_name);
  }
  if (args.text_search) {
    const search = args.text_search.toLowerCase();
    events = events.filter((ev) => {
      const summary = (ev.data?.tool_input_summary || "").toLowerCase();
      const prompt = (ev.data?.prompt || "").toLowerCase();
      return summary.includes(search) || prompt.includes(search);
    });
  }

  const limit = args.limit ?? 50;
  const results = events.slice(0, limit).map((ev) => ({
    event: ev.event,
    session_id: ev.session_id,
    ts: ev.ts,
    tool: ev.data?.tool_name,
    detail: ev.data?.tool_input_summary || ev.data?.prompt,
  }));

  return { totalMatches: events.length, results, truncated: events.length > limit };
}

// ---------------------------------------------------------------------------
// MCP Server (thin wrappers around exported handlers)
// ---------------------------------------------------------------------------

function mcpContent(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export function createHookLoggerMcpServer(logDir: string) {
  return createSdkMcpServer({
    name: "hook-logger",
    version: "1.0.0",
    tools: [
      tool(
        "get_dashboard_summary",
        "Get overall dashboard summary including total events, sessions, top tools/skills, and orphan counts. Use this for a high-level overview.",
        { top_n: z.number().optional().describe("Number of top tools/skills to include (default: 20)") },
        async (args) => mcpContent(handleGetDashboardSummary(logDir, args)),
        { annotations: { readOnlyHint: true } },
      ),

      tool(
        "list_sessions",
        "List sessions with optional filtering by status (live/stale/ended) and time range. Returns session ID, status, event count, working directory, and timestamps.",
        {
          status: z.enum(["live", "stale", "ended", "all"]).optional().describe("Filter by session status (default: all)"),
          since: z.string().optional().describe("ISO timestamp - only sessions with activity after this time"),
          limit: z.number().optional().describe("Maximum number of sessions to return (default: 50)"),
        },
        async (args) => mcpContent(handleListSessions(logDir, args)),
        { annotations: { readOnlyHint: true } },
      ),

      tool(
        "get_session_detail",
        "Get detailed information about a specific session including all events, tool usage, and skill usage. Use session ID prefix matching (e.g. first 8 chars).",
        {
          session_id: z.string().describe("Session ID or prefix to match"),
          max_events: z.number().optional().describe("Maximum number of events to include in detail (default: 100)"),
        },
        async (args) => mcpContent(handleGetSessionDetail(logDir, args)),
        { annotations: { readOnlyHint: true } },
      ),

      tool(
        "get_recent_activity",
        "Get activity summary for the last N minutes. Shows events, active sessions, and tool usage within the time window.",
        {
          minutes: z.number().optional().describe("Number of minutes to look back (default: 30)"),
          since: z.string().optional().describe("ISO timestamp to use as the start time instead of minutes"),
        },
        async (args) => mcpContent(handleGetRecentActivity(logDir, args)),
        { annotations: { readOnlyHint: true } },
      ),

      tool(
        "get_tool_skill_usage",
        "Get tool and/or skill usage statistics with optional filtering by time range or session.",
        {
          type: z.enum(["tools", "skills", "both"]).optional().describe("Type of usage to return (default: both)"),
          top_n: z.number().optional().describe("Number of top entries to return (default: 20)"),
          minutes: z.number().optional().describe("Only count usage in the last N minutes"),
          session_id: z.string().optional().describe("Only count usage for a specific session"),
        },
        async (args) => mcpContent(handleGetToolSkillUsage(logDir, args)),
        { annotations: { readOnlyHint: true } },
      ),

      tool(
        "search_events",
        "Search events by type, tool name, or text content. Returns matching events with details.",
        {
          event_type: z.string().optional().describe("Filter by event type (e.g. PreToolUse, SessionStart, Stop)"),
          tool_name: z.string().optional().describe("Filter by tool name"),
          text_search: z.string().optional().describe("Search in tool_input_summary and prompt fields"),
          session_id: z.string().optional().describe("Filter by session ID prefix"),
          limit: z.number().optional().describe("Maximum results to return (default: 50)"),
        },
        async (args) => mcpContent(handleSearchEvents(logDir, args)),
        { annotations: { readOnlyHint: true } },
      ),
    ],
  });
}
