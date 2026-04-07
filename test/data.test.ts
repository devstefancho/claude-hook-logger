import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  extractProjectName,
  getClaudeSessions,
  getRecentPrompts,
  buildAgentList,
  getCachedSummary,
  setCachedSummary,
  buildChatContext,
  buildSummary,
} from "../viewer/data.js";
import type { LogEvent, ClaudeSession, TeamInfo } from "../viewer/data.js";

// ---------------------------------------------------------------------------
// extractProjectName tests
// ---------------------------------------------------------------------------
describe("extractProjectName", () => {
  let originalHome: string | undefined;

  beforeEach(() => {
    originalHome = process.env.HOME;
  });

  afterEach(() => {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
  });

  it("replaces HOME prefix with ~/", () => {
    process.env.HOME = "/Users/foo";
    assert.equal(
      extractProjectName("/Users/foo/works/project/.claude"),
      "~/works/project/.claude",
    );
  });

  it("returns absolute path when outside HOME", () => {
    process.env.HOME = "/Users/foo";
    assert.equal(extractProjectName("/opt/project"), "/opt/project");
  });

  it("returns path as-is when HOME is empty", () => {
    process.env.HOME = "";
    assert.equal(
      extractProjectName("/Users/foo/works/project"),
      "/Users/foo/works/project",
    );
  });

  it("handles HOME being the exact path", () => {
    process.env.HOME = "/Users/foo";
    assert.equal(extractProjectName("/Users/foo"), "~");
  });

  it("does not replace partial HOME match", () => {
    process.env.HOME = "/Users/foo";
    assert.equal(
      extractProjectName("/Users/foobar/project"),
      "/Users/foobar/project",
    );
  });
});

// ---------------------------------------------------------------------------
// getClaudeSessions tests
// ---------------------------------------------------------------------------
describe("getClaudeSessions", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sessions-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty map for nonexistent directory", () => {
    const result = getClaudeSessions("/nonexistent/path");
    assert.equal(result.size, 0);
  });

  it("returns empty map for empty directory", () => {
    const result = getClaudeSessions(tmpDir);
    assert.equal(result.size, 0);
  });

  it("reads valid session JSON files", () => {
    const session = { pid: 1234, sessionId: "sess-abc", cwd: "/project", startedAt: 1700000000000 };
    fs.writeFileSync(path.join(tmpDir, "sess-abc.json"), JSON.stringify(session));
    const result = getClaudeSessions(tmpDir);
    assert.equal(result.size, 1);
    assert.equal(result.get("sess-abc")?.pid, 1234);
    assert.equal(result.get("sess-abc")?.cwd, "/project");
  });

  it("skips non-JSON files", () => {
    fs.writeFileSync(path.join(tmpDir, "readme.txt"), "not json");
    const result = getClaudeSessions(tmpDir);
    assert.equal(result.size, 0);
  });

  it("skips malformed JSON files", () => {
    fs.writeFileSync(path.join(tmpDir, "bad.json"), "{invalid json");
    const result = getClaudeSessions(tmpDir);
    assert.equal(result.size, 0);
  });

  it("skips JSON without sessionId", () => {
    fs.writeFileSync(path.join(tmpDir, "no-id.json"), JSON.stringify({ pid: 1 }));
    const result = getClaudeSessions(tmpDir);
    assert.equal(result.size, 0);
  });

  it("reads multiple session files", () => {
    fs.writeFileSync(path.join(tmpDir, "a.json"), JSON.stringify({ sessionId: "a", pid: 1, cwd: "/a", startedAt: 1 }));
    fs.writeFileSync(path.join(tmpDir, "b.json"), JSON.stringify({ sessionId: "b", pid: 2, cwd: "/b", startedAt: 2 }));
    const result = getClaudeSessions(tmpDir);
    assert.equal(result.size, 2);
    assert.ok(result.has("a"));
    assert.ok(result.has("b"));
  });
});

// ---------------------------------------------------------------------------
// getRecentPrompts tests
// ---------------------------------------------------------------------------
describe("getRecentPrompts", () => {
  let tmpDir: string;
  let originalHome: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "prompts-test-"));
    originalHome = process.env.HOME;
    process.env.HOME = tmpDir;
  });

  afterEach(() => {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty array when session file does not exist", () => {
    const result = getRecentPrompts("sess-123", "/some/cwd");
    assert.deepEqual(result, []);
  });

  it("reads prompts from session JSONL file", () => {
    const projectsDir = path.join(tmpDir, ".claude", "projects", "-some-cwd");
    fs.mkdirSync(projectsDir, { recursive: true });
    const lines = [
      JSON.stringify({ type: "user", message: { content: "hello" } }),
      JSON.stringify({ type: "assistant", message: { content: "hi" } }),
      JSON.stringify({ type: "user", message: { content: "run tests" } }),
    ];
    fs.writeFileSync(path.join(projectsDir, "sess-123.jsonl"), lines.join("\n") + "\n");
    const result = getRecentPrompts("sess-123", "/some/cwd");
    assert.deepEqual(result, ["hello", "run tests"]);
  });

  it("returns last N prompts (default 3)", () => {
    const projectsDir = path.join(tmpDir, ".claude", "projects", "-some-cwd");
    fs.mkdirSync(projectsDir, { recursive: true });
    const lines = [
      JSON.stringify({ type: "user", message: { content: "p1" } }),
      JSON.stringify({ type: "user", message: { content: "p2" } }),
      JSON.stringify({ type: "user", message: { content: "p3" } }),
      JSON.stringify({ type: "user", message: { content: "p4" } }),
    ];
    fs.writeFileSync(path.join(projectsDir, "sess-123.jsonl"), lines.join("\n") + "\n");
    const result = getRecentPrompts("sess-123", "/some/cwd");
    assert.deepEqual(result, ["p2", "p3", "p4"]);
  });

  it("handles array content blocks", () => {
    const projectsDir = path.join(tmpDir, ".claude", "projects", "-some-cwd");
    fs.mkdirSync(projectsDir, { recursive: true });
    const line = JSON.stringify({
      type: "user",
      message: { content: [{ type: "text", text: "array content" }, { type: "image", url: "x" }] },
    });
    fs.writeFileSync(path.join(projectsDir, "sess-123.jsonl"), line + "\n");
    const result = getRecentPrompts("sess-123", "/some/cwd");
    assert.deepEqual(result, ["array content"]);
  });

  it("truncates long prompts to 200 chars", () => {
    const projectsDir = path.join(tmpDir, ".claude", "projects", "-some-cwd");
    fs.mkdirSync(projectsDir, { recursive: true });
    const longText = "x".repeat(300);
    const line = JSON.stringify({ type: "user", message: { content: longText } });
    fs.writeFileSync(path.join(projectsDir, "sess-123.jsonl"), line + "\n");
    const result = getRecentPrompts("sess-123", "/some/cwd");
    assert.equal(result[0].length, 200);
  });

  it("skips malformed JSON lines", () => {
    const projectsDir = path.join(tmpDir, ".claude", "projects", "-some-cwd");
    fs.mkdirSync(projectsDir, { recursive: true });
    const content = "{bad json\n" + JSON.stringify({ type: "user", message: { content: "good" } }) + "\n";
    fs.writeFileSync(path.join(projectsDir, "sess-123.jsonl"), content);
    const result = getRecentPrompts("sess-123", "/some/cwd");
    assert.deepEqual(result, ["good"]);
  });
});

// ---------------------------------------------------------------------------
// buildAgentList tests
// ---------------------------------------------------------------------------
describe("buildAgentList", () => {
  let tmpDir: string;
  let originalHome: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-test-"));
    originalHome = process.env.HOME;
    process.env.HOME = tmpDir;
  });

  afterEach(() => {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const nowIso = new Date().toISOString();
  const oldIso = "2024-01-01T00:00:00Z";

  it("returns empty array for empty events", () => {
    const result = buildAgentList([], new Map());
    assert.deepEqual(result, []);
  });

  it("excludes ended sessions by default", () => {
    const events: LogEvent[] = [
      { event: "SessionStart", session_id: "s1", ts: oldIso, cwd: "/p" },
      { event: "SessionEnd", session_id: "s1", ts: oldIso },
    ];
    const result = buildAgentList(events, new Map());
    assert.equal(result.length, 0);
  });

  it("includes ended sessions when includeEnded=true", () => {
    const events: LogEvent[] = [
      { event: "SessionStart", session_id: "s1", ts: oldIso, cwd: "/p" },
      { event: "SessionEnd", session_id: "s1", ts: oldIso },
    ];
    const result = buildAgentList(events, new Map(), { includeEnded: true });
    assert.equal(result.length, 1);
    assert.equal(result[0].status, "ended");
  });

  it("detects waiting status from Stop with stop_hook_active", () => {
    const events: LogEvent[] = [
      { event: "SessionStart", session_id: "s1", ts: nowIso, cwd: "/p" },
      { event: "Stop", session_id: "s1", ts: nowIso, data: { stop_hook_active: true } },
    ];
    const result = buildAgentList(events, new Map());
    assert.equal(result[0].status, "waiting");
  });

  it("detects active status for recent sessions", () => {
    const events: LogEvent[] = [
      { event: "SessionStart", session_id: "s1", ts: nowIso, cwd: "/p" },
      { event: "PreToolUse", session_id: "s1", ts: nowIso, data: { tool_name: "Read" } },
    ];
    const result = buildAgentList(events, new Map());
    assert.equal(result[0].status, "active");
  });

  it("detects idle status for old sessions without end", () => {
    const events: LogEvent[] = [
      { event: "SessionStart", session_id: "s1", ts: oldIso, cwd: "/p" },
      { event: "PreToolUse", session_id: "s1", ts: oldIso, data: { tool_name: "Read" } },
    ];
    const result = buildAgentList(events, new Map());
    assert.equal(result[0].status, "idle");
  });

  it("uses ClaudeSession data when available", () => {
    const events: LogEvent[] = [
      { event: "SessionStart", session_id: "s1", ts: nowIso, cwd: "/p" },
    ];
    const sessions = new Map<string, ClaudeSession>([
      ["s1", { pid: 999, sessionId: "s1", cwd: "/override", startedAt: Date.now(), name: "my-agent" }],
    ]);
    const result = buildAgentList(events, sessions);
    assert.equal(result[0].cwd, "/override");
    assert.equal(result[0].name, "my-agent");
    assert.equal(result[0].pid, 999);
  });

  it("extracts branch from /trees/ path", () => {
    const events: LogEvent[] = [
      { event: "SessionStart", session_id: "s1", ts: nowIso, cwd: "/project/trees/feature-x" },
    ];
    const result = buildAgentList(events, new Map());
    assert.equal(result[0].branch, "feature-x");
  });

  it("sets branch to null when no /trees/ in path", () => {
    const events: LogEvent[] = [
      { event: "SessionStart", session_id: "s1", ts: nowIso, cwd: "/project/src" },
    ];
    const result = buildAgentList(events, new Map());
    assert.equal(result[0].branch, null);
  });

  it("tracks last tool name", () => {
    const events: LogEvent[] = [
      { event: "SessionStart", session_id: "s1", ts: nowIso, cwd: "/p" },
      { event: "PreToolUse", session_id: "s1", ts: nowIso, data: { tool_name: "Bash" } },
      { event: "PostToolUse", session_id: "s1", ts: nowIso, data: { tool_name: "Bash" } },
      { event: "PreToolUse", session_id: "s1", ts: nowIso, data: { tool_name: "Write" } },
    ];
    const result = buildAgentList(events, new Map());
    assert.equal(result[0].lastToolName, "Write");
  });

  it("detects unresolved permission from Notification with 'permission' keyword", () => {
    const events: LogEvent[] = [
      { event: "SessionStart", session_id: "s1", ts: nowIso, cwd: "/p" },
      { event: "Notification", session_id: "s1", ts: nowIso, data: { message: "Claude needs your permission to use Bash" } },
    ];
    const result = buildAgentList(events, new Map());
    assert.equal(result[0].status, "waiting");
    assert.equal(result[0].permissionMessage, "Claude needs your permission to use Bash");
  });

  it("detects unresolved permission from Notification with 'approval' keyword", () => {
    const events: LogEvent[] = [
      { event: "SessionStart", session_id: "s1", ts: nowIso, cwd: "/p" },
      { event: "Notification", session_id: "s1", ts: nowIso, data: { message: "Claude Code needs your approval for the plan" } },
    ];
    const result = buildAgentList(events, new Map());
    assert.equal(result[0].status, "waiting");
    assert.equal(result[0].permissionMessage, "Claude Code needs your approval for the plan");
  });

  it("detects unresolved permission from PermissionRequest event", () => {
    const events: LogEvent[] = [
      { event: "SessionStart", session_id: "s1", ts: nowIso, cwd: "/p" },
      { event: "PermissionRequest", session_id: "s1", ts: nowIso, data: {} },
    ];
    const result = buildAgentList(events, new Map());
    assert.equal(result[0].status, "waiting");
    assert.equal(result[0].permissionMessage, "Waiting for approval");
  });

  it("resolves permission when PostToolUse occurs after PermissionRequest", () => {
    const t1 = "2026-01-01T00:00:01Z";
    const t2 = "2026-01-01T00:00:02Z";
    const events: LogEvent[] = [
      { event: "SessionStart", session_id: "s1", ts: t1, cwd: "/p" },
      { event: "PermissionRequest", session_id: "s1", ts: t1, data: {} },
      { event: "PostToolUse", session_id: "s1", ts: t2, data: { tool_name: "Bash" } },
    ];
    const result = buildAgentList(events, new Map());
    assert.equal(result[0].permissionMessage, null);
    assert.notEqual(result[0].status, "waiting");
  });

  it("resolves permission when SessionStart (resume) occurs after PermissionRequest", () => {
    const t1 = "2026-01-01T00:00:01Z";
    const t2 = "2026-01-01T00:00:02Z";
    const events: LogEvent[] = [
      { event: "SessionStart", session_id: "s1", ts: t1, cwd: "/p" },
      { event: "PermissionRequest", session_id: "s1", ts: t1, data: {} },
      { event: "SessionStart", session_id: "s1", ts: t2, cwd: "/p", data: { source: "resume" } },
    ];
    const result = buildAgentList(events, new Map());
    assert.equal(result[0].permissionMessage, null);
  });

  it("sets justCompleted true when Stop without stop_hook_active is recent", () => {
    const events: LogEvent[] = [
      { event: "SessionStart", session_id: "s1", ts: nowIso, cwd: "/p" },
      { event: "Stop", session_id: "s1", ts: nowIso, data: { stop_hook_active: false } },
    ];
    const result = buildAgentList(events, new Map());
    assert.equal(result[0].justCompleted, true);
  });

  it("sets latestUserPrompt from UserPromptSubmit event", () => {
    const events: LogEvent[] = [
      { event: "SessionStart", session_id: "s1", ts: nowIso, cwd: "/p" },
      { event: "UserPromptSubmit", session_id: "s1", ts: nowIso, data: { prompt: "Fix the bug" } },
    ];
    const result = buildAgentList(events, new Map());
    assert.equal(result[0].latestUserPrompt, "Fix the bug");
  });

  it("does not resolve permission when PreToolUse has same timestamp as PermissionRequest", () => {
    const t1 = "2026-01-01T00:00:01Z";
    const events: LogEvent[] = [
      { event: "SessionStart", session_id: "s1", ts: t1, cwd: "/p" },
      { event: "PreToolUse", session_id: "s1", ts: t1, data: { tool_name: "Grep" } },
      { event: "PermissionRequest", session_id: "s1", ts: t1, data: {} },
    ];
    const result = buildAgentList(events, new Map());
    assert.equal(result[0].status, "waiting");
    assert.equal(result[0].permissionMessage, "Waiting for approval");
  });

  it("detects waiting from worker_permission_prompt on parent session", () => {
    const t1 = "2026-01-01T00:00:01Z";
    const events: LogEvent[] = [
      { event: "SessionStart", session_id: "parent", ts: t1, cwd: "/p" },
      { event: "SessionStart", session_id: "worker1", ts: t1, cwd: "/p" },
      { event: "Notification", session_id: "parent", ts: nowIso, data: {
        notification_type: "worker_permission_prompt",
        message: "tester needs permission for Bash",
      } },
    ];
    const teams: TeamInfo[] = [{
      name: "test-team",
      description: "",
      createdAt: 0,
      leadSessionId: "parent",
      members: [{ agentId: "a1", name: "tester", sessionId: "worker1" }],
    }];
    const result = buildAgentList(events, new Map(), { teams });
    const worker = result.find(a => a.sessionId === "worker1");
    assert.equal(worker?.status, "waiting");
    assert.equal(worker?.permissionMessage, "tester needs permission for Bash");
  });

  it("resolves worker permission when worker has PostToolUse after notification", () => {
    const t1 = "2026-01-01T00:00:01Z";
    const t2 = "2026-01-01T00:00:02Z";
    const t3 = "2026-01-01T00:00:03Z";
    const events: LogEvent[] = [
      { event: "SessionStart", session_id: "parent", ts: t1, cwd: "/p" },
      { event: "SessionStart", session_id: "worker1", ts: t1, cwd: "/p" },
      { event: "Notification", session_id: "parent", ts: t2, data: {
        notification_type: "worker_permission_prompt",
        message: "tester needs permission for Bash",
      } },
      { event: "PostToolUse", session_id: "worker1", ts: t3, data: { tool_name: "Bash" } },
    ];
    const teams: TeamInfo[] = [{
      name: "test-team",
      description: "",
      createdAt: 0,
      leadSessionId: "parent",
      members: [{ agentId: "a1", name: "tester", sessionId: "worker1" }],
    }];
    const result = buildAgentList(events, new Map(), { teams });
    const worker = result.find(a => a.sessionId === "worker1");
    assert.notEqual(worker?.status, "waiting");
    assert.equal(worker?.permissionMessage, null);
  });

  it("matches worker permission by prefix when names differ (e.g., tester vs tester2)", () => {
    const t1 = "2026-01-01T00:00:01Z";
    const events: LogEvent[] = [
      { event: "SessionStart", session_id: "parent", ts: t1, cwd: "/p" },
      { event: "SessionStart", session_id: "worker1", ts: t1, cwd: "/p" },
      { event: "Notification", session_id: "parent", ts: nowIso, data: {
        notification_type: "worker_permission_prompt",
        message: "tester needs permission for Glob",
      } },
    ];
    const teams: TeamInfo[] = [{
      name: "test-team",
      description: "",
      createdAt: 0,
      leadSessionId: "parent",
      members: [{ agentId: "a1", name: "tester2", sessionId: "worker1" }],
    }];
    const result = buildAgentList(events, new Map(), { teams });
    const worker = result.find(a => a.sessionId === "worker1");
    assert.equal(worker?.status, "waiting");
    assert.equal(worker?.permissionMessage, "tester needs permission for Glob");
  });

  it("detects waiting from dangling PreToolUse for idle team member (not lead)", () => {
    const t1 = "2026-01-01T00:00:01Z";
    const events: LogEvent[] = [
      { event: "SessionStart", session_id: "parent", ts: t1, cwd: "/p" },
      { event: "SessionStart", session_id: "worker1", ts: t1, cwd: "/p" },
      // worker1 has PreToolUse without PostToolUse (dangling), old timestamp → idle
      { event: "PreToolUse", session_id: "worker1", ts: oldIso, data: { tool_name: "Glob", tool_use_id: "tu1" } },
    ];
    const teams: TeamInfo[] = [{
      name: "test-team",
      description: "",
      createdAt: 0,
      leadSessionId: "parent",
      members: [
        { agentId: "lead", name: "team-lead", sessionId: "parent" },
        { agentId: "a1", name: "tester", sessionId: "worker1" },
      ],
    }];
    const result = buildAgentList(events, new Map(), { teams });
    const worker = result.find(a => a.sessionId === "worker1");
    assert.equal(worker?.status, "waiting");
    assert.equal(worker?.permissionMessage, "Waiting for permission: Glob");
  });

  it("does not apply dangling PreToolUse to active team member (tool in progress)", () => {
    const t1 = "2026-01-01T00:00:01Z";
    const events: LogEvent[] = [
      { event: "SessionStart", session_id: "parent", ts: t1, cwd: "/p" },
      { event: "SessionStart", session_id: "worker1", ts: t1, cwd: "/p" },
      // worker1 has recent dangling PreToolUse → "active" status, not "waiting"
      { event: "PreToolUse", session_id: "worker1", ts: nowIso, data: { tool_name: "Bash", tool_use_id: "tu1" } },
    ];
    const teams: TeamInfo[] = [{
      name: "test-team",
      description: "",
      createdAt: 0,
      leadSessionId: "parent",
      members: [
        { agentId: "lead", name: "team-lead", sessionId: "parent" },
        { agentId: "a1", name: "tester", sessionId: "worker1" },
      ],
    }];
    const result = buildAgentList(events, new Map(), { teams });
    const worker = result.find(a => a.sessionId === "worker1");
    assert.equal(worker?.status, "active");
  });

  it("does not apply dangling PreToolUse to team lead", () => {
    const t1 = "2026-01-01T00:00:01Z";
    const events: LogEvent[] = [
      { event: "SessionStart", session_id: "parent", ts: t1, cwd: "/p" },
      { event: "PreToolUse", session_id: "parent", ts: nowIso, data: { tool_name: "Bash", tool_use_id: "tu1" } },
    ];
    const teams: TeamInfo[] = [{
      name: "test-team",
      description: "",
      createdAt: 0,
      leadSessionId: "parent",
      members: [{ agentId: "lead", name: "team-lead", sessionId: "parent" }],
    }];
    const result = buildAgentList(events, new Map(), { teams });
    const lead = result.find(a => a.sessionId === "parent");
    // Lead should NOT be overridden to waiting by dangling PreToolUse
    assert.notEqual(lead?.status, "waiting");
  });

  it("does not apply dangling PreToolUse when PostToolUse resolves it", () => {
    const t1 = "2026-01-01T00:00:01Z";
    const t2 = "2026-01-01T00:00:02Z";
    const events: LogEvent[] = [
      { event: "SessionStart", session_id: "parent", ts: t1, cwd: "/p" },
      { event: "SessionStart", session_id: "worker1", ts: t1, cwd: "/p" },
      { event: "PreToolUse", session_id: "worker1", ts: t1, data: { tool_name: "Glob", tool_use_id: "tu1" } },
      { event: "PostToolUse", session_id: "worker1", ts: t2, data: { tool_name: "Glob", tool_use_id: "tu1" } },
    ];
    const teams: TeamInfo[] = [{
      name: "test-team",
      description: "",
      createdAt: 0,
      leadSessionId: "parent",
      members: [
        { agentId: "lead", name: "team-lead", sessionId: "parent" },
        { agentId: "a1", name: "tester", sessionId: "worker1" },
      ],
    }];
    const result = buildAgentList(events, new Map(), { teams });
    const worker = result.find(a => a.sessionId === "worker1");
    assert.notEqual(worker?.status, "waiting");
  });

  it("worker_permission_prompt does not make parent stuck in waiting", () => {
    const t1 = "2026-01-01T00:00:01Z";
    const t2 = "2026-01-01T00:00:02Z";
    const t3 = "2026-01-01T00:00:03Z";
    const events: LogEvent[] = [
      { event: "SessionStart", session_id: "parent", ts: t1, cwd: "/p" },
      { event: "PostToolUse", session_id: "parent", ts: t2, data: { tool_name: "Bash" } },
      // worker_permission_prompt comes AFTER parent's last resolve event
      { event: "Notification", session_id: "parent", ts: t3, data: {
        notification_type: "worker_permission_prompt",
        message: "tester needs permission for Glob",
      } },
    ];
    const result = buildAgentList(events, new Map());
    const parent = result.find(a => a.sessionId === "parent");
    // Parent should NOT be stuck in "waiting" due to worker_permission_prompt
    assert.notEqual(parent?.status, "waiting");
  });

  it("does not affect agents when no teams are provided", () => {
    const events: LogEvent[] = [
      { event: "SessionStart", session_id: "s1", ts: nowIso, cwd: "/p" },
    ];
    const result = buildAgentList(events, new Map());
    assert.equal(result[0].status, "active");
  });

  it("sorts agents by status order then lastActivity", () => {
    const events: LogEvent[] = [
      // ended session
      { event: "SessionStart", session_id: "ended1", ts: oldIso, cwd: "/p1" },
      { event: "SessionEnd", session_id: "ended1", ts: oldIso },
      // idle session
      { event: "SessionStart", session_id: "idle1", ts: oldIso, cwd: "/p2" },
      // active session
      { event: "SessionStart", session_id: "active1", ts: nowIso, cwd: "/p3" },
    ];
    const result = buildAgentList(events, new Map(), { includeEnded: true });
    assert.equal(result[0].status, "active");
    assert.equal(result[1].status, "idle");
    assert.equal(result[2].status, "ended");
  });

  it("includes ended team member session even without includeEnded", () => {
    const events: LogEvent[] = [
      { event: "SessionStart", session_id: "lead1", ts: nowIso, cwd: "/proj" },
      { event: "SessionStart", session_id: "member1", ts: oldIso, cwd: "/proj" },
      { event: "SessionEnd", session_id: "member1", ts: oldIso },
    ];
    const teams: TeamInfo[] = [{
      name: "test-team", description: "", createdAt: 0, leadSessionId: "lead1",
      members: [
        { agentId: "lead@test-team", name: "lead", cwd: "/proj", joinedAt: 0, sessionId: "lead1" },
        { agentId: "worker@test-team", name: "worker", cwd: "/proj", joinedAt: 0, sessionId: "member1" },
      ],
    }];
    const result = buildAgentList(events, new Map(), { teams });
    assert.equal(result.length, 2);
    const member = result.find(a => a.sessionId === "member1");
    assert.ok(member, "ended team member should be included");
    assert.equal(member!.status, "ended");
  });

  it("still filters ended non-team sessions", () => {
    const events: LogEvent[] = [
      { event: "SessionStart", session_id: "lead1", ts: nowIso, cwd: "/proj" },
      { event: "SessionStart", session_id: "member1", ts: oldIso, cwd: "/proj" },
      { event: "SessionEnd", session_id: "member1", ts: oldIso },
      { event: "SessionStart", session_id: "random1", ts: oldIso, cwd: "/other" },
      { event: "SessionEnd", session_id: "random1", ts: oldIso },
    ];
    const teams: TeamInfo[] = [{
      name: "test-team", description: "", createdAt: 0, leadSessionId: "lead1",
      members: [
        { agentId: "lead@test-team", name: "lead", cwd: "/proj", joinedAt: 0, sessionId: "lead1" },
        { agentId: "worker@test-team", name: "worker", cwd: "/proj", joinedAt: 0, sessionId: "member1" },
      ],
    }];
    const result = buildAgentList(events, new Map(), { teams });
    assert.ok(!result.find(a => a.sessionId === "random1"), "non-team ended session should be filtered");
    assert.ok(result.find(a => a.sessionId === "member1"), "team member ended session should be included");
  });
});

// ---------------------------------------------------------------------------
// getCachedSummary / setCachedSummary tests
// ---------------------------------------------------------------------------
describe("getCachedSummary / setCachedSummary", () => {
  it("returns null for unknown session", () => {
    assert.equal(getCachedSummary("nonexistent-session-id"), null);
  });

  it("stores and retrieves summary", () => {
    setCachedSummary("cache-test-sess", "This is a summary");
    assert.equal(getCachedSummary("cache-test-sess"), "This is a summary");
  });
});

// ---------------------------------------------------------------------------
// buildChatContext tests (via data.ts direct import)
// ---------------------------------------------------------------------------
describe("buildChatContext (direct)", () => {
  it("builds context from summary with tools and sessions", () => {
    const events: LogEvent[] = [
      { event: "SessionStart", session_id: "s1", ts: "2024-01-01T00:00:00Z", cwd: "/p" },
      { event: "PreToolUse", session_id: "s1", ts: "2024-01-01T00:01:00Z", data: { tool_name: "Read", tool_use_id: "t1" } },
      { event: "PostToolUse", session_id: "s1", ts: "2024-01-01T00:01:01Z", data: { tool_name: "Read", tool_use_id: "t1" } },
      { event: "SessionEnd", session_id: "s1", ts: "2024-01-01T00:02:00Z" },
    ];
    const summary = buildSummary(events);
    const context = buildChatContext(summary);
    assert.ok(context.includes("Total events: 4"));
    assert.ok(context.includes("Read"));
    assert.ok(context.includes("s1"));
  });
});
