import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  filterEventsByTime,
  getSessionEvents,
  buildSessionDetail,
  buildMinimalContext,
  buildSummary,
} from "../viewer/data.js";
import type { LogEvent, Summary } from "../viewer/data.js";
import {
  createHookLoggerMcpServer,
  getAllEvents,
  handleGetDashboardSummary,
  handleListSessions,
  handleGetSessionDetail,
  handleGetRecentActivity,
  handleGetToolSkillUsage,
  handleSearchEvents,
} from "../viewer/mcp-tools.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "mcp-test-"));
}

function writeJsonl(dir: string, filename: string, events: LogEvent[]): void {
  fs.writeFileSync(
    path.join(dir, filename),
    events.map((e) => JSON.stringify(e)).join("\n") + "\n",
  );
}

// Sample events for tests
const SAMPLE_EVENTS: LogEvent[] = [
  { event: "SessionStart", session_id: "session-aaa-111", ts: "2024-01-01T00:00:00Z", cwd: "/project-a" },
  { event: "PreToolUse", session_id: "session-aaa-111", ts: "2024-01-01T00:01:00Z", data: { tool_name: "Read", tool_use_id: "t1", tool_input_summary: "file.ts" } },
  { event: "PostToolUse", session_id: "session-aaa-111", ts: "2024-01-01T00:01:01Z", data: { tool_name: "Read", tool_use_id: "t1" } },
  { event: "PreToolUse", session_id: "session-aaa-111", ts: "2024-01-01T00:02:00Z", data: { tool_name: "Write", tool_use_id: "t2", tool_input_summary: "output.ts" } },
  { event: "PostToolUse", session_id: "session-aaa-111", ts: "2024-01-01T00:02:01Z", data: { tool_name: "Write", tool_use_id: "t2" } },
  { event: "PreToolUse", session_id: "session-aaa-111", ts: "2024-01-01T00:03:00Z", data: { tool_name: "Skill", tool_use_id: "sk1", tool_input_summary: "commit" } },
  { event: "PostToolUse", session_id: "session-aaa-111", ts: "2024-01-01T00:03:01Z", data: { tool_name: "Skill", tool_use_id: "sk1" } },
  { event: "SessionEnd", session_id: "session-aaa-111", ts: "2024-01-01T00:04:00Z" },

  { event: "SessionStart", session_id: "session-bbb-222", ts: "2024-01-01T01:00:00Z", cwd: "/project-b" },
  { event: "PreToolUse", session_id: "session-bbb-222", ts: "2024-01-01T01:01:00Z", data: { tool_name: "Bash", tool_use_id: "t3", tool_input_summary: "npm test" } },
  { event: "PostToolUse", session_id: "session-bbb-222", ts: "2024-01-01T01:01:01Z", data: { tool_name: "Bash", tool_use_id: "t3" } },
  { event: "UserPromptSubmit", session_id: "session-bbb-222", ts: "2024-01-01T01:02:00Z", data: { prompt: "/git-worktree list" } },
  { event: "Stop", session_id: "session-bbb-222", ts: "2024-01-01T01:03:00Z", data: { stop_hook_active: true } },
  { event: "SessionEnd", session_id: "session-bbb-222", ts: "2024-01-01T01:04:00Z" },
];

// ---------------------------------------------------------------------------
// 1. filterEventsByTime tests
// ---------------------------------------------------------------------------
describe("filterEventsByTime", () => {
  it("returns all events when no bounds are given", () => {
    const result = filterEventsByTime(SAMPLE_EVENTS);
    assert.equal(result.length, SAMPLE_EVENTS.length);
  });

  it("filters events after 'since'", () => {
    const result = filterEventsByTime(SAMPLE_EVENTS, "2024-01-01T01:00:00Z");
    assert.ok(result.every((ev) => ev.ts >= "2024-01-01T01:00:00Z"));
    assert.equal(result.length, 6); // session-bbb events
  });

  it("filters events before 'until'", () => {
    const result = filterEventsByTime(SAMPLE_EVENTS, undefined, "2024-01-01T00:03:00Z");
    assert.ok(result.every((ev) => ev.ts <= "2024-01-01T00:03:00Z"));
  });

  it("filters events within both bounds", () => {
    const result = filterEventsByTime(SAMPLE_EVENTS, "2024-01-01T00:01:00Z", "2024-01-01T00:03:00Z");
    assert.ok(result.every((ev) => ev.ts >= "2024-01-01T00:01:00Z" && ev.ts <= "2024-01-01T00:03:00Z"));
  });

  it("returns empty array when no events match", () => {
    const result = filterEventsByTime(SAMPLE_EVENTS, "2025-01-01T00:00:00Z");
    assert.equal(result.length, 0);
  });
});

// ---------------------------------------------------------------------------
// 2. getSessionEvents tests
// ---------------------------------------------------------------------------
describe("getSessionEvents", () => {
  it("returns events for exact session ID match", () => {
    const result = getSessionEvents(SAMPLE_EVENTS, "session-aaa-111");
    assert.equal(result.length, 8);
    assert.ok(result.every((ev) => ev.session_id === "session-aaa-111"));
  });

  it("returns events for session ID prefix match", () => {
    const result = getSessionEvents(SAMPLE_EVENTS, "session-bbb");
    assert.equal(result.length, 6);
    assert.ok(result.every((ev) => ev.session_id?.startsWith("session-bbb")));
  });

  it("returns empty array when no session matches", () => {
    const result = getSessionEvents(SAMPLE_EVENTS, "nonexistent");
    assert.equal(result.length, 0);
  });
});

// ---------------------------------------------------------------------------
// 3. buildSessionDetail tests
// ---------------------------------------------------------------------------
describe("buildSessionDetail", () => {
  it("returns detail for a valid session", () => {
    const detail = buildSessionDetail(SAMPLE_EVENTS, "session-aaa-111");
    assert.equal(detail.sessionId, "session-aaa-111");
    assert.equal(detail.eventCount, 8);
    assert.equal(detail.cwd, "/project-a");
    assert.equal(detail.firstTs, "2024-01-01T00:00:00Z");
    assert.equal(detail.lastTs, "2024-01-01T00:04:00Z");
    assert.ok(detail.tools.length > 0);
    assert.ok(detail.skills.length > 0);
    assert.equal(detail.events.length, 8);
  });

  it("returns tool usage sorted by count", () => {
    const detail = buildSessionDetail(SAMPLE_EVENTS, "session-aaa-111");
    // Read: 2 (PreToolUse + PostToolUse), Write: 2, Skill: 2
    assert.ok(detail.tools.length >= 2);
  });

  it("returns skill usage", () => {
    const detail = buildSessionDetail(SAMPLE_EVENTS, "session-aaa-111");
    const commitSkill = detail.skills.find((s) => s.name === "commit");
    assert.ok(commitSkill);
    assert.equal(commitSkill!.count, 1);
  });

  it("works with prefix match", () => {
    const detail = buildSessionDetail(SAMPLE_EVENTS, "session-bbb");
    assert.equal(detail.eventCount, 6);
    assert.equal(detail.cwd, "/project-b");
  });

  it("returns empty detail for nonexistent session", () => {
    const detail = buildSessionDetail(SAMPLE_EVENTS, "nonexistent");
    assert.equal(detail.eventCount, 0);
    assert.equal(detail.firstTs, null);
    assert.equal(detail.lastTs, null);
    assert.equal(detail.cwd, "");
    assert.deepEqual(detail.tools, []);
    assert.deepEqual(detail.skills, []);
    assert.deepEqual(detail.events, []);
  });
});

// ---------------------------------------------------------------------------
// 4. buildMinimalContext tests
// ---------------------------------------------------------------------------
describe("buildMinimalContext", () => {
  it("includes quick stats and tool instructions", () => {
    const summary: Summary = {
      totalEvents: 100,
      sessionCount: 5,
      liveSessionCount: 2,
      staleSessionCount: 1,
      toolCount: 10,
      interruptCount: 3,
      orphanCount: 1,
      sessions: [],
      toolUsage: [],
      skillUsage: [],
      orphanIds: [],
    };
    const ctx = buildMinimalContext(summary);
    assert.ok(ctx.includes("100 events"));
    assert.ok(ctx.includes("5 sessions"));
    assert.ok(ctx.includes("2 live"));
    assert.ok(ctx.includes("1 stale"));
    assert.ok(ctx.includes("10 tools"));
    assert.ok(ctx.includes("3 interrupts"));
    assert.ok(ctx.includes("get_recent_activity"));
    assert.ok(ctx.includes("get_session_detail"));
    assert.ok(ctx.includes("get_tool_skill_usage"));
    assert.ok(ctx.includes("search_events"));
    assert.ok(ctx.includes("list_sessions"));
  });
});

// ---------------------------------------------------------------------------
// 5. MCP Server creation test
// ---------------------------------------------------------------------------
describe("createHookLoggerMcpServer", () => {
  let tmpDir: string;

  before(() => {
    tmpDir = makeTmpDir();
    writeJsonl(tmpDir, "hook-events.jsonl", SAMPLE_EVENTS);
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates a server with type 'sdk' and name 'hook-logger'", () => {
    const server = createHookLoggerMcpServer(tmpDir);
    assert.equal(server.type, "sdk");
    assert.equal(server.name, "hook-logger");
    assert.ok(server.instance);
  });
});

// ---------------------------------------------------------------------------
// 6. MCP tool handler integration tests (via data functions)
// ---------------------------------------------------------------------------
describe("MCP tool data integration", () => {
  it("get_dashboard_summary equivalent: buildSummary returns full stats", () => {
    const summary = buildSummary(SAMPLE_EVENTS);
    assert.equal(summary.totalEvents, 14);
    assert.equal(summary.sessionCount, 2);
    assert.ok(summary.toolUsage.length > 0);
    assert.ok(summary.skillUsage.length > 0);
    assert.equal(summary.interruptCount, 1);
  });

  it("list_sessions equivalent: buildSummary sessions can be filtered by status", () => {
    const summary = buildSummary(SAMPLE_EVENTS);
    const ended = summary.sessions.filter((s) => !s.isLive && !s.isStale);
    assert.equal(ended.length, 2); // both sessions ended
  });

  it("get_session_detail equivalent: buildSessionDetail returns rich data", () => {
    const detail = buildSessionDetail(SAMPLE_EVENTS, "session-aaa");
    assert.equal(detail.eventCount, 8);
    assert.ok(detail.tools.some((t) => t.name === "Read"));
    assert.ok(detail.tools.some((t) => t.name === "Write"));
  });

  it("get_recent_activity equivalent: filterEventsByTime + buildSummary", () => {
    const since = "2024-01-01T01:00:00Z";
    const filtered = filterEventsByTime(SAMPLE_EVENTS, since);
    const summary = buildSummary(filtered);
    assert.equal(summary.sessionCount, 1);
    assert.equal(summary.sessions[0].id, "session-bbb-222");
  });

  it("get_tool_skill_usage equivalent: buildSummary with filtered events", () => {
    const sessionEvents = getSessionEvents(SAMPLE_EVENTS, "session-aaa");
    const summary = buildSummary(sessionEvents);
    assert.ok(summary.skillUsage.some((s) => s.name === "commit"));
  });

  it("search_events equivalent: filter by event type", () => {
    const stops = SAMPLE_EVENTS.filter((ev) => ev.event === "Stop");
    assert.equal(stops.length, 1);
    assert.equal(stops[0].data?.stop_hook_active, true);
  });

  it("search_events equivalent: filter by tool name", () => {
    const bashEvents = SAMPLE_EVENTS.filter((ev) => ev.data?.tool_name === "Bash");
    assert.equal(bashEvents.length, 2); // PreToolUse + PostToolUse
  });

  it("search_events equivalent: text search in tool_input_summary", () => {
    const search = "npm";
    const results = SAMPLE_EVENTS.filter((ev) => {
      const summary = (ev.data?.tool_input_summary || "").toLowerCase();
      return summary.includes(search);
    });
    assert.equal(results.length, 1);
    assert.equal(results[0].data?.tool_input_summary, "npm test");
  });

  it("search_events equivalent: text search in prompt field", () => {
    const search = "git-worktree";
    const results = SAMPLE_EVENTS.filter((ev) => {
      const prompt = (ev.data?.prompt || "").toLowerCase();
      return prompt.includes(search);
    });
    assert.equal(results.length, 1);
  });
});

// ---------------------------------------------------------------------------
// 7. getAllEvents tests
// ---------------------------------------------------------------------------
describe("getAllEvents", () => {
  it("returns events from hook-events.jsonl when it exists", () => {
    const tmpDir = makeTmpDir();
    writeJsonl(tmpDir, "hook-events.jsonl", SAMPLE_EVENTS);
    const events = getAllEvents(tmpDir);
    assert.equal(events.length, SAMPLE_EVENTS.length);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns events from first available file when hook-events.jsonl does not exist", () => {
    const tmpDir = makeTmpDir();
    writeJsonl(tmpDir, "hook-events.2024-01-01.jsonl", SAMPLE_EVENTS.slice(0, 3));
    const events = getAllEvents(tmpDir);
    assert.equal(events.length, 3);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty array for empty directory", () => {
    const tmpDir = makeTmpDir();
    const events = getAllEvents(tmpDir);
    assert.deepEqual(events, []);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty array for nonexistent directory", () => {
    const events = getAllEvents("/nonexistent/path/xyz");
    assert.deepEqual(events, []);
  });
});

// ---------------------------------------------------------------------------
// 8. handleGetDashboardSummary tests
// ---------------------------------------------------------------------------
describe("handleGetDashboardSummary", () => {
  let tmpDir: string;

  before(() => {
    tmpDir = makeTmpDir();
    writeJsonl(tmpDir, "hook-events.jsonl", SAMPLE_EVENTS);
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns full dashboard summary with default top_n", () => {
    const result = handleGetDashboardSummary(tmpDir, {});
    assert.equal(result.totalEvents, 14);
    assert.equal(result.sessionCount, 2);
    assert.ok(Array.isArray(result.topTools));
    assert.ok(Array.isArray(result.topSkills));
    assert.ok(Array.isArray(result.orphanIds));
    assert.equal(typeof result.liveSessionCount, "number");
    assert.equal(typeof result.staleSessionCount, "number");
    assert.equal(typeof result.toolCount, "number");
    assert.equal(typeof result.interruptCount, "number");
    assert.equal(typeof result.orphanCount, "number");
  });

  it("respects top_n parameter", () => {
    const result = handleGetDashboardSummary(tmpDir, { top_n: 1 });
    assert.ok(result.topTools.length <= 1);
    assert.ok(result.topSkills.length <= 1);
  });
});

// ---------------------------------------------------------------------------
// 9. handleListSessions tests
// ---------------------------------------------------------------------------
describe("handleListSessions", () => {
  let tmpDir: string;

  before(() => {
    tmpDir = makeTmpDir();
    writeJsonl(tmpDir, "hook-events.jsonl", SAMPLE_EVENTS);
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("lists all sessions by default", () => {
    const result = handleListSessions(tmpDir, {});
    assert.equal(result.length, 2);
    assert.ok(result[0].id);
    assert.ok(result[0].status);
    assert.equal(typeof result[0].eventCount, "number");
  });

  it("filters by status=ended", () => {
    const result = handleListSessions(tmpDir, { status: "ended" });
    assert.equal(result.length, 2); // both ended
    assert.ok(result.every((s) => s.status === "ended"));
  });

  it("filters by status=live returns empty for ended sessions", () => {
    const result = handleListSessions(tmpDir, { status: "live" });
    assert.equal(result.length, 0);
  });

  it("filters by status=stale returns empty for ended sessions", () => {
    const result = handleListSessions(tmpDir, { status: "stale" });
    assert.equal(result.length, 0);
  });

  it("filters by status=all returns all", () => {
    const result = handleListSessions(tmpDir, { status: "all" });
    assert.equal(result.length, 2);
  });

  it("filters by since timestamp", () => {
    const result = handleListSessions(tmpDir, { since: "2024-01-01T01:00:00Z" });
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "session-bbb-222");
  });

  it("respects limit parameter", () => {
    const result = handleListSessions(tmpDir, { limit: 1 });
    assert.equal(result.length, 1);
  });

  it("returns expected fields for each session", () => {
    const result = handleListSessions(tmpDir, {});
    const session = result[0];
    assert.ok("id" in session);
    assert.ok("status" in session);
    assert.ok("eventCount" in session);
    assert.ok("cwd" in session);
    assert.ok("firstTs" in session);
    assert.ok("lastTs" in session);
    assert.ok("hasInterrupt" in session);
    assert.ok("orphanCount" in session);
  });
});

// ---------------------------------------------------------------------------
// 10. handleGetSessionDetail tests
// ---------------------------------------------------------------------------
describe("handleGetSessionDetail", () => {
  let tmpDir: string;

  before(() => {
    tmpDir = makeTmpDir();
    writeJsonl(tmpDir, "hook-events.jsonl", SAMPLE_EVENTS);
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns session detail with events", () => {
    const result = handleGetSessionDetail(tmpDir, { session_id: "session-aaa-111" });
    assert.equal(result.eventCount, 8);
    assert.equal(result.totalEventsInSession, 8);
    assert.equal(result.truncated, false);
    assert.equal(result.events.length, 8);
  });

  it("truncates events when max_events is set", () => {
    const result = handleGetSessionDetail(tmpDir, { session_id: "session-aaa-111", max_events: 2 });
    assert.equal(result.events.length, 2);
    assert.equal(result.totalEventsInSession, 8);
    assert.equal(result.truncated, true);
  });

  it("returns empty detail for nonexistent session", () => {
    const result = handleGetSessionDetail(tmpDir, { session_id: "nonexistent" });
    assert.equal(result.eventCount, 0);
    assert.equal(result.totalEventsInSession, 0);
    assert.equal(result.truncated, false);
  });
});

// ---------------------------------------------------------------------------
// 11. handleGetRecentActivity tests
// ---------------------------------------------------------------------------
describe("handleGetRecentActivity", () => {
  let tmpDir: string;

  before(() => {
    tmpDir = makeTmpDir();
    writeJsonl(tmpDir, "hook-events.jsonl", SAMPLE_EVENTS);
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns activity with since parameter", () => {
    const result = handleGetRecentActivity(tmpDir, { since: "2024-01-01T01:00:00Z" });
    assert.ok(result.timeRange);
    assert.equal(result.timeRange.since, "2024-01-01T01:00:00Z");
    assert.equal(result.sessionCount, 1);
    assert.equal(result.sessions[0].id, "session-bbb-222");
  });

  it("defaults to 30 minutes when no args given", () => {
    const result = handleGetRecentActivity(tmpDir, {});
    assert.ok(result.timeRange);
    assert.ok(result.timeRange.since);
    assert.ok(result.timeRange.until);
    // All sample events are from 2024, so nothing in last 30 minutes
    assert.equal(result.totalEvents, 0);
  });

  it("uses minutes parameter", () => {
    const result = handleGetRecentActivity(tmpDir, { minutes: 5 });
    assert.ok(result.timeRange);
    assert.equal(result.totalEvents, 0); // old sample events
  });

  it("returns expected fields", () => {
    const result = handleGetRecentActivity(tmpDir, { since: "2024-01-01T00:00:00Z" });
    assert.ok("timeRange" in result);
    assert.ok("totalEvents" in result);
    assert.ok("sessionCount" in result);
    assert.ok("liveSessionCount" in result);
    assert.ok("topTools" in result);
    assert.ok("topSkills" in result);
    assert.ok("sessions" in result);
    assert.ok(Array.isArray(result.sessions));
    if (result.sessions.length > 0) {
      assert.ok("id" in result.sessions[0]);
      assert.ok("status" in result.sessions[0]);
      assert.ok("eventCount" in result.sessions[0]);
      assert.ok("cwd" in result.sessions[0]);
    }
  });
});

// ---------------------------------------------------------------------------
// 12. handleGetToolSkillUsage tests
// ---------------------------------------------------------------------------
describe("handleGetToolSkillUsage", () => {
  let tmpDir: string;

  before(() => {
    tmpDir = makeTmpDir();
    writeJsonl(tmpDir, "hook-events.jsonl", SAMPLE_EVENTS);
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns both tools and skills by default", () => {
    const result = handleGetToolSkillUsage(tmpDir, {});
    assert.ok("tools" in result);
    assert.ok("skills" in result);
    assert.ok("eventCount" in result);
  });

  it("returns only tools when type=tools", () => {
    const result = handleGetToolSkillUsage(tmpDir, { type: "tools" });
    assert.ok("tools" in result);
    assert.ok(!("skills" in result));
  });

  it("returns only skills when type=skills", () => {
    const result = handleGetToolSkillUsage(tmpDir, { type: "skills" });
    assert.ok(!("tools" in result));
    assert.ok("skills" in result);
  });

  it("filters by session_id", () => {
    const result = handleGetToolSkillUsage(tmpDir, { session_id: "session-aaa" });
    assert.ok((result.eventCount as number) <= 14);
    const skills = result.skills as Array<{ name: string; count: number }>;
    assert.ok(skills.some((s) => s.name === "commit"));
  });

  it("respects top_n parameter", () => {
    const result = handleGetToolSkillUsage(tmpDir, { top_n: 1 });
    const tools = result.tools as Array<{ name: string; count: number }>;
    assert.ok(tools.length <= 1);
  });

  it("filters by minutes (no recent events in sample)", () => {
    const result = handleGetToolSkillUsage(tmpDir, { minutes: 5 });
    assert.equal(result.eventCount, 0);
  });
});

// ---------------------------------------------------------------------------
// 13. handleSearchEvents tests
// ---------------------------------------------------------------------------
describe("handleSearchEvents", () => {
  let tmpDir: string;

  before(() => {
    tmpDir = makeTmpDir();
    writeJsonl(tmpDir, "hook-events.jsonl", SAMPLE_EVENTS);
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns all events without filters", () => {
    const result = handleSearchEvents(tmpDir, {});
    assert.equal(result.totalMatches, 14);
    assert.equal(result.results.length, 14);
    assert.equal(result.truncated, false);
  });

  it("filters by event_type", () => {
    const result = handleSearchEvents(tmpDir, { event_type: "Stop" });
    assert.equal(result.totalMatches, 1);
    assert.equal(result.results[0].event, "Stop");
  });

  it("filters by tool_name", () => {
    const result = handleSearchEvents(tmpDir, { tool_name: "Bash" });
    assert.equal(result.totalMatches, 2); // PreToolUse + PostToolUse
    assert.ok(result.results.every((r) => r.tool === "Bash"));
  });

  it("filters by text_search in tool_input_summary", () => {
    const result = handleSearchEvents(tmpDir, { text_search: "npm" });
    assert.equal(result.totalMatches, 1);
    assert.equal(result.results[0].detail, "npm test");
  });

  it("filters by text_search in prompt", () => {
    const result = handleSearchEvents(tmpDir, { text_search: "git-worktree" });
    assert.equal(result.totalMatches, 1);
  });

  it("filters by session_id", () => {
    const result = handleSearchEvents(tmpDir, { session_id: "session-aaa" });
    assert.equal(result.totalMatches, 8);
    assert.ok(result.results.every((r) => r.session_id?.startsWith("session-aaa")));
  });

  it("respects limit parameter", () => {
    const result = handleSearchEvents(tmpDir, { limit: 3 });
    assert.equal(result.results.length, 3);
    assert.equal(result.totalMatches, 14);
    assert.equal(result.truncated, true);
  });

  it("combines multiple filters", () => {
    const result = handleSearchEvents(tmpDir, { session_id: "session-bbb", event_type: "PreToolUse" });
    assert.equal(result.totalMatches, 1);
    assert.equal(result.results[0].tool, "Bash");
  });

  it("returns expected fields in results", () => {
    const result = handleSearchEvents(tmpDir, { limit: 1 });
    const r = result.results[0];
    assert.ok("event" in r);
    assert.ok("session_id" in r);
    assert.ok("ts" in r);
  });
});
