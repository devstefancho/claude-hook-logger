import { describe, it, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  isValidFilename,
  isBuiltinCommand,
  parseLogFile,
  buildSummary,
  createServer,
} from "../viewer/server.mjs";
import {
  startServer,
  stopServer,
  fetchJson,
  fetchRaw,
} from "./helpers/server-helper.mjs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "server-test-"));
}

function writeJsonl(dir, filename, events) {
  fs.writeFileSync(
    path.join(dir, filename),
    events.map((e) => JSON.stringify(e)).join("\n") + "\n",
  );
}

const MINIMAL_HTML = "<html><body>OK</body></html>";

function writeTmpHtml(dir) {
  const htmlPath = path.join(dir, "index.html");
  fs.writeFileSync(htmlPath, MINIMAL_HTML);
  return htmlPath;
}

// ---------------------------------------------------------------------------
// 1. isValidFilename tests
// ---------------------------------------------------------------------------
describe("isValidFilename", () => {
  it('accepts "hook-events.jsonl"', () => {
    assert.equal(isValidFilename("hook-events.jsonl"), true);
  });

  it('accepts "hook-events.2024-01-15.jsonl"', () => {
    assert.equal(isValidFilename("hook-events.2024-01-15.jsonl"), true);
  });

  it('accepts "hook-events-backup.jsonl"', () => {
    assert.equal(isValidFilename("hook-events-backup.jsonl"), true);
  });

  it("rejects directory traversal ../etc/passwd", () => {
    assert.equal(isValidFilename("../etc/passwd"), false);
  });

  it("rejects directory traversal hook-events/../../etc", () => {
    assert.equal(isValidFilename("hook-events/../../etc"), false);
  });

  it("rejects empty string", () => {
    assert.equal(isValidFilename(""), false);
  });

  it("rejects null", () => {
    assert.equal(isValidFilename(null), false);
  });

  it("rejects undefined", () => {
    assert.equal(isValidFilename(undefined), false);
  });

  it("rejects pattern mismatch random-file.txt", () => {
    assert.equal(isValidFilename("random-file.txt"), false);
  });
});

// ---------------------------------------------------------------------------
// 2. parseLogFile tests
// ---------------------------------------------------------------------------
describe("parseLogFile", () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTmpDir();
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("parses valid JSONL with multiple lines", () => {
    const events = [
      { event: "SessionStart", ts: "2024-01-01T00:00:00Z" },
      { event: "PreToolUse", ts: "2024-01-01T00:00:01Z" },
    ];
    writeJsonl(tmpDir, "valid.jsonl", events);
    const result = parseLogFile(tmpDir, "valid.jsonl");
    assert.equal(result.length, 2);
    assert.equal(result[0].event, "SessionStart");
    assert.equal(result[1].event, "PreToolUse");
  });

  it("returns empty array for empty file", () => {
    fs.writeFileSync(path.join(tmpDir, "empty.jsonl"), "");
    const result = parseLogFile(tmpDir, "empty.jsonl");
    assert.deepEqual(result, []);
  });

  it("returns empty array for non-existent file", () => {
    const result = parseLogFile(tmpDir, "nope.jsonl");
    assert.deepEqual(result, []);
  });

  it("skips malformed JSON lines and keeps good ones", () => {
    const content = '{"event":"A"}\nBAD LINE\n{"event":"B"}\n';
    fs.writeFileSync(path.join(tmpDir, "mixed.jsonl"), content);
    const result = parseLogFile(tmpDir, "mixed.jsonl");
    assert.equal(result.length, 2);
    assert.equal(result[0].event, "A");
    assert.equal(result[1].event, "B");
  });

  it("skips empty and blank lines", () => {
    const content = '{"event":"A"}\n\n   \n{"event":"B"}\n\n';
    fs.writeFileSync(path.join(tmpDir, "blanks.jsonl"), content);
    const result = parseLogFile(tmpDir, "blanks.jsonl");
    assert.equal(result.length, 2);
  });
});

// ---------------------------------------------------------------------------
// 3. buildSummary tests
// ---------------------------------------------------------------------------
describe("buildSummary", () => {
  it("returns zeroed summary for empty events array", () => {
    const s = buildSummary([]);
    assert.equal(s.totalEvents, 0);
    assert.equal(s.sessionCount, 0);
    assert.equal(s.liveSessionCount, 0);
    assert.equal(s.toolCount, 0);
    assert.equal(s.interruptCount, 0);
    assert.equal(s.orphanCount, 0);
    assert.deepEqual(s.sessions, []);
    assert.deepEqual(s.toolUsage, []);
    assert.deepEqual(s.skillUsage, []);
    assert.deepEqual(s.orphanIds, []);
  });

  it("tracks single session lifecycle correctly", () => {
    const events = [
      { event: "SessionStart", session_id: "s1", ts: "2024-01-01T00:00:00Z", cwd: "/home" },
      { event: "PreToolUse", session_id: "s1", ts: "2024-01-01T00:00:01Z", data: { tool_name: "Read", tool_use_id: "t1" } },
      { event: "PostToolUse", session_id: "s1", ts: "2024-01-01T00:00:02Z", data: { tool_name: "Read", tool_use_id: "t1" } },
      { event: "SessionEnd", session_id: "s1", ts: "2024-01-01T00:00:03Z" },
    ];
    const s = buildSummary(events);
    assert.equal(s.totalEvents, 4);
    assert.equal(s.sessionCount, 1);
    assert.equal(s.liveSessionCount, 0);
    assert.equal(s.sessions[0].hasSessionStart, true);
    assert.equal(s.sessions[0].hasSessionEnd, true);
    assert.equal(s.sessions[0].isLive, false);
    assert.equal(s.sessions[0].eventCount, 4);
  });

  it("detects live session (SessionStart without SessionEnd)", () => {
    const events = [
      { event: "SessionStart", session_id: "s1", ts: "2024-01-01T00:00:00Z" },
      { event: "PreToolUse", session_id: "s1", ts: "2024-01-01T00:00:01Z", data: { tool_name: "Bash", tool_use_id: "t1" } },
      { event: "PostToolUse", session_id: "s1", ts: "2024-01-01T00:00:02Z", data: { tool_name: "Bash", tool_use_id: "t1" } },
    ];
    const s = buildSummary(events);
    assert.equal(s.liveSessionCount, 1);
    assert.equal(s.sessions[0].isLive, true);
  });

  it("counts multiple sessions correctly", () => {
    const events = [
      { event: "SessionStart", session_id: "s1", ts: "2024-01-01T00:00:00Z" },
      { event: "SessionEnd", session_id: "s1", ts: "2024-01-01T00:00:01Z" },
      { event: "SessionStart", session_id: "s2", ts: "2024-01-01T00:01:00Z" },
      { event: "SessionEnd", session_id: "s2", ts: "2024-01-01T00:01:01Z" },
    ];
    const s = buildSummary(events);
    assert.equal(s.sessionCount, 2);
  });

  it("sorts tool usage by count descending", () => {
    const events = [
      { event: "PreToolUse", session_id: "s1", ts: "2024-01-01T00:00:00Z", data: { tool_name: "Read", tool_use_id: "t1" } },
      { event: "PreToolUse", session_id: "s1", ts: "2024-01-01T00:00:01Z", data: { tool_name: "Write", tool_use_id: "t2" } },
      { event: "PreToolUse", session_id: "s1", ts: "2024-01-01T00:00:02Z", data: { tool_name: "Read", tool_use_id: "t3" } },
      { event: "PreToolUse", session_id: "s1", ts: "2024-01-01T00:00:03Z", data: { tool_name: "Read", tool_use_id: "t4" } },
      { event: "PostToolUse", session_id: "s1", ts: "2024-01-01T00:00:04Z", data: { tool_name: "Read", tool_use_id: "t1" } },
      { event: "PostToolUse", session_id: "s1", ts: "2024-01-01T00:00:05Z", data: { tool_name: "Write", tool_use_id: "t2" } },
      { event: "PostToolUse", session_id: "s1", ts: "2024-01-01T00:00:06Z", data: { tool_name: "Read", tool_use_id: "t3" } },
      { event: "PostToolUse", session_id: "s1", ts: "2024-01-01T00:00:07Z", data: { tool_name: "Read", tool_use_id: "t4" } },
    ];
    const s = buildSummary(events);
    assert.equal(s.toolUsage[0].name, "Read");
    assert.equal(s.toolUsage[0].count, 6); // 3 Pre + 3 Post reference Read
    assert.equal(s.toolUsage[1].name, "Write");
    assert.equal(s.toolUsage[1].count, 2); // 1 Pre + 1 Post reference Write
  });

  it("detects orphans (PreToolUse without PostToolUse)", () => {
    const events = [
      { event: "SessionStart", session_id: "s1", ts: "2024-01-01T00:00:00Z" },
      { event: "PreToolUse", session_id: "s1", ts: "2024-01-01T00:00:01Z", data: { tool_name: "Bash", tool_use_id: "orphan1" } },
      { event: "PreToolUse", session_id: "s1", ts: "2024-01-01T00:00:02Z", data: { tool_name: "Read", tool_use_id: "ok1" } },
      { event: "PostToolUse", session_id: "s1", ts: "2024-01-01T00:00:03Z", data: { tool_name: "Read", tool_use_id: "ok1" } },
    ];
    const s = buildSummary(events);
    assert.equal(s.orphanCount, 1);
    assert.ok(s.orphanIds.includes("orphan1"));
    assert.equal(s.sessions[0].orphanCount, 1);
  });

  it("detects interrupts (Stop with stop_hook_active)", () => {
    const events = [
      { event: "SessionStart", session_id: "s1", ts: "2024-01-01T00:00:00Z" },
      { event: "Stop", session_id: "s1", ts: "2024-01-01T00:00:01Z", data: { stop_hook_active: true } },
    ];
    const s = buildSummary(events);
    assert.equal(s.interruptCount, 1);
    assert.equal(s.sessions[0].hasInterrupt, true);
  });

  it("sorts sessions by lastTs (most recent first)", () => {
    const events = [
      { event: "SessionStart", session_id: "old", ts: "2024-01-01T00:00:00Z" },
      { event: "SessionEnd", session_id: "old", ts: "2024-01-01T00:00:01Z" },
      { event: "SessionStart", session_id: "new", ts: "2024-01-02T00:00:00Z" },
      { event: "SessionEnd", session_id: "new", ts: "2024-01-02T00:00:01Z" },
    ];
    const s = buildSummary(events);
    assert.equal(s.sessions[0].id, "new");
    assert.equal(s.sessions[1].id, "old");
  });

  it('groups events without session_id under "unknown"', () => {
    const events = [
      { event: "PreToolUse", ts: "2024-01-01T00:00:00Z", data: { tool_name: "Read", tool_use_id: "t1" } },
      { event: "PostToolUse", ts: "2024-01-01T00:00:01Z", data: { tool_name: "Read", tool_use_id: "t1" } },
    ];
    const s = buildSummary(events);
    assert.equal(s.sessionCount, 1);
    assert.equal(s.sessions[0].id, "unknown");
  });

  it("counts individual skills separately in skillUsage", () => {
    const events = [
      { event: "PreToolUse", session_id: "s1", ts: "2024-01-01T00:00:00Z", data: { tool_name: "Skill", tool_use_id: "sk1", tool_input_summary: "commit" } },
      { event: "PreToolUse", session_id: "s1", ts: "2024-01-01T00:00:01Z", data: { tool_name: "Skill", tool_use_id: "sk2", tool_input_summary: "commit" } },
      { event: "PreToolUse", session_id: "s1", ts: "2024-01-01T00:00:02Z", data: { tool_name: "Skill", tool_use_id: "sk3", tool_input_summary: "review-pr" } },
    ];
    const s = buildSummary(events);
    assert.equal(s.skillUsage.length, 2);
    assert.equal(s.skillUsage[0].name, "commit");
    assert.equal(s.skillUsage[0].count, 2);
    assert.equal(s.skillUsage[1].name, "review-pr");
    assert.equal(s.skillUsage[1].count, 1);
  });

  it("sorts skillUsage by count descending", () => {
    const events = [
      { event: "PreToolUse", session_id: "s1", ts: "2024-01-01T00:00:00Z", data: { tool_name: "Skill", tool_use_id: "sk1", tool_input_summary: "review-pr" } },
      { event: "PreToolUse", session_id: "s1", ts: "2024-01-01T00:00:01Z", data: { tool_name: "Skill", tool_use_id: "sk2", tool_input_summary: "commit" } },
      { event: "PreToolUse", session_id: "s1", ts: "2024-01-01T00:00:02Z", data: { tool_name: "Skill", tool_use_id: "sk3", tool_input_summary: "commit" } },
      { event: "PreToolUse", session_id: "s1", ts: "2024-01-01T00:00:03Z", data: { tool_name: "Skill", tool_use_id: "sk4", tool_input_summary: "commit" } },
    ];
    const s = buildSummary(events);
    assert.equal(s.skillUsage[0].name, "commit");
    assert.equal(s.skillUsage[0].count, 3);
    assert.equal(s.skillUsage[1].name, "review-pr");
    assert.equal(s.skillUsage[1].count, 1);
  });

  it("returns empty skillUsage when no Skill events", () => {
    const events = [
      { event: "PreToolUse", session_id: "s1", ts: "2024-01-01T00:00:00Z", data: { tool_name: "Read", tool_use_id: "t1" } },
      { event: "PostToolUse", session_id: "s1", ts: "2024-01-01T00:00:01Z", data: { tool_name: "Read", tool_use_id: "t1" } },
    ];
    const s = buildSummary(events);
    assert.deepEqual(s.skillUsage, []);
  });

  it('uses "unknown" when tool_input_summary is missing for Skill', () => {
    const events = [
      { event: "PreToolUse", session_id: "s1", ts: "2024-01-01T00:00:00Z", data: { tool_name: "Skill", tool_use_id: "sk1" } },
    ];
    const s = buildSummary(events);
    assert.equal(s.skillUsage.length, 1);
    assert.equal(s.skillUsage[0].name, "unknown");
    assert.equal(s.skillUsage[0].count, 1);
  });

  it("handles mixed events (complete + orphan + interrupt) correctly", () => {
    const events = [
      { event: "SessionStart", session_id: "s1", ts: "2024-01-01T00:00:00Z", cwd: "/project" },
      { event: "PreToolUse", session_id: "s1", ts: "2024-01-01T00:00:01Z", data: { tool_name: "Read", tool_use_id: "t1" } },
      { event: "PostToolUse", session_id: "s1", ts: "2024-01-01T00:00:02Z", data: { tool_name: "Read", tool_use_id: "t1" } },
      { event: "PreToolUse", session_id: "s1", ts: "2024-01-01T00:00:03Z", data: { tool_name: "Bash", tool_use_id: "orphan1" } },
      { event: "Stop", session_id: "s1", ts: "2024-01-01T00:00:04Z", data: { stop_hook_active: true } },
    ];
    const s = buildSummary(events);
    assert.equal(s.totalEvents, 5);
    assert.equal(s.sessionCount, 1);
    assert.equal(s.orphanCount, 1);
    assert.equal(s.interruptCount, 1);
    assert.equal(s.liveSessionCount, 1); // no SessionEnd
    assert.ok(s.orphanIds.includes("orphan1"));
    assert.equal(s.sessions[0].orphanCount, 1);
    assert.equal(s.sessions[0].hasInterrupt, true);
    assert.equal(s.sessions[0].isLive, true);
  });
});

// ---------------------------------------------------------------------------
// 4. isBuiltinCommand tests
// ---------------------------------------------------------------------------
describe("isBuiltinCommand", () => {
  it("recognizes /help as built-in", () => {
    assert.equal(isBuiltinCommand("/help"), true);
  });

  it("recognizes /clear as built-in", () => {
    assert.equal(isBuiltinCommand("/clear"), true);
  });

  it("recognizes /compact with arguments as built-in", () => {
    assert.equal(isBuiltinCommand("/compact some args"), true);
  });

  it("is case-insensitive", () => {
    assert.equal(isBuiltinCommand("/HELP"), true);
    assert.equal(isBuiltinCommand("/Help"), true);
  });

  it("does not match custom slash commands", () => {
    assert.equal(isBuiltinCommand("/git-worktree"), false);
    assert.equal(isBuiltinCommand("/smart-commit"), false);
    assert.equal(isBuiltinCommand("/devstefancho:test-commit-push-pr-clean"), false);
  });
});

// ---------------------------------------------------------------------------
// 5. buildSummary – UserPromptSubmit slash command counting
// ---------------------------------------------------------------------------
describe("buildSummary – slash command counting", () => {
  it("counts UserPromptSubmit slash commands in skillUsage", () => {
    const events = [
      { event: "UserPromptSubmit", session_id: "s1", ts: "2024-01-01T00:00:00Z", data: { prompt: "/git-worktree create feat/x" } },
      { event: "UserPromptSubmit", session_id: "s1", ts: "2024-01-01T00:00:01Z", data: { prompt: "/git-worktree list" } },
      { event: "UserPromptSubmit", session_id: "s1", ts: "2024-01-01T00:00:02Z", data: { prompt: "/smart-commit" } },
    ];
    const s = buildSummary(events);
    assert.equal(s.skillUsage.length, 2);
    const gitWorktree = s.skillUsage.find(x => x.name === "git-worktree");
    const smartCommit = s.skillUsage.find(x => x.name === "smart-commit");
    assert.equal(gitWorktree.count, 2);
    assert.equal(smartCommit.count, 1);
  });

  it("combines PreToolUse Skill and UserPromptSubmit for the same skill name", () => {
    const events = [
      { event: "PreToolUse", session_id: "s1", ts: "2024-01-01T00:00:00Z", data: { tool_name: "Skill", tool_use_id: "sk1", tool_input_summary: "commit" } },
      { event: "UserPromptSubmit", session_id: "s1", ts: "2024-01-01T00:00:01Z", data: { prompt: "/commit" } },
      { event: "UserPromptSubmit", session_id: "s1", ts: "2024-01-01T00:00:02Z", data: { prompt: "/commit -m fix" } },
    ];
    const s = buildSummary(events);
    assert.equal(s.skillUsage.length, 1);
    assert.equal(s.skillUsage[0].name, "commit");
    assert.equal(s.skillUsage[0].count, 3);
  });

  it("excludes built-in commands like /help from skillUsage", () => {
    const events = [
      { event: "UserPromptSubmit", session_id: "s1", ts: "2024-01-01T00:00:00Z", data: { prompt: "/help" } },
      { event: "UserPromptSubmit", session_id: "s1", ts: "2024-01-01T00:00:01Z", data: { prompt: "/clear" } },
      { event: "UserPromptSubmit", session_id: "s1", ts: "2024-01-01T00:00:02Z", data: { prompt: "/compact" } },
      { event: "UserPromptSubmit", session_id: "s1", ts: "2024-01-01T00:00:03Z", data: { prompt: "/git-worktree list" } },
    ];
    const s = buildSummary(events);
    assert.equal(s.skillUsage.length, 1);
    assert.equal(s.skillUsage[0].name, "git-worktree");
  });

  it("ignores UserPromptSubmit with non-slash prompts", () => {
    const events = [
      { event: "UserPromptSubmit", session_id: "s1", ts: "2024-01-01T00:00:00Z", data: { prompt: "please fix the bug" } },
      { event: "UserPromptSubmit", session_id: "s1", ts: "2024-01-01T00:00:01Z", data: { prompt: "" } },
      { event: "UserPromptSubmit", session_id: "s1", ts: "2024-01-01T00:00:02Z", data: {} },
    ];
    const s = buildSummary(events);
    assert.deepEqual(s.skillUsage, []);
  });

  it("handles namespaced slash commands like /devstefancho:test-commit-push-pr-clean", () => {
    const events = [
      { event: "UserPromptSubmit", session_id: "s1", ts: "2024-01-01T00:00:00Z", data: { prompt: "/devstefancho:test-commit-push-pr-clean" } },
    ];
    const s = buildSummary(events);
    assert.equal(s.skillUsage.length, 1);
    assert.equal(s.skillUsage[0].name, "devstefancho:test-commit-push-pr-clean");
    assert.equal(s.skillUsage[0].count, 1);
  });
});

// ---------------------------------------------------------------------------
// 6. HTTP endpoint tests
// ---------------------------------------------------------------------------
describe("HTTP endpoints", () => {
  let tmpDir;
  let htmlPath;
  let server;
  let port;
  let baseUrl;

  before(async () => {
    tmpDir = makeTmpDir();
    htmlPath = writeTmpHtml(tmpDir);

    // Write a sample log file
    const events = [
      { event: "SessionStart", session_id: "s1", ts: "2024-01-01T00:00:00Z", cwd: "/project" },
      { event: "PreToolUse", session_id: "s1", ts: "2024-01-01T00:00:01Z", data: { tool_name: "Read", tool_use_id: "t1" } },
      { event: "PostToolUse", session_id: "s1", ts: "2024-01-01T00:00:02Z", data: { tool_name: "Read", tool_use_id: "t1" } },
      { event: "SessionEnd", session_id: "s1", ts: "2024-01-01T00:00:03Z" },
    ];
    writeJsonl(tmpDir, "hook-events.jsonl", events);

    ({ server, port, baseUrl } = await startServer(tmpDir, htmlPath));
  });

  after(async () => {
    await stopServer(server);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("GET / returns 200 with text/html content-type", async () => {
    const { status, headers, text } = await fetchRaw(baseUrl, "/");
    assert.equal(status, 200);
    assert.ok(headers.get("content-type").includes("text/html"));
    assert.ok(text.includes("<html>"));
  });

  it("GET /api/files returns 200 with files array", async () => {
    const { status, body } = await fetchJson(baseUrl, "/api/files");
    assert.equal(status, 200);
    assert.ok(Array.isArray(body.files));
    assert.ok(body.files.includes("hook-events.jsonl"));
  });

  it("GET /api/events returns 200 with events and count", async () => {
    const { status, body } = await fetchJson(baseUrl, "/api/events");
    assert.equal(status, 200);
    assert.ok(Array.isArray(body.events));
    assert.equal(body.count, 4);
    assert.equal(body.events.length, 4);
  });

  it("GET /api/events?file=../etc/passwd returns 400 error", async () => {
    const { status, body } = await fetchJson(baseUrl, "/api/events?file=../etc/passwd");
    assert.equal(status, 400);
    assert.ok(body.error);
  });

  it("GET /api/summary returns 200 with summary object including skillUsage", async () => {
    const { status, body } = await fetchJson(baseUrl, "/api/summary");
    assert.equal(status, 200);
    assert.equal(body.totalEvents, 4);
    assert.equal(body.sessionCount, 1);
    assert.ok(Array.isArray(body.sessions));
    assert.ok(Array.isArray(body.toolUsage));
    assert.ok(Array.isArray(body.skillUsage));
  });

  it("GET /api/summary?file=invalid returns 400 error", async () => {
    const { status, body } = await fetchJson(baseUrl, "/api/summary?file=invalid");
    assert.equal(status, 400);
    assert.ok(body.error);
  });

  it("GET /nonexistent returns 404", async () => {
    const { status, body } = await fetchJson(baseUrl, "/nonexistent");
    assert.equal(status, 404);
    assert.ok(body.error);
  });
});
